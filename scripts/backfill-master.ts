/**
 * Backfill Master Data: Google Sheets → Postgres (`public.master_items`).
 * Jalankan: npm run backfill:master
 *
 * Apa yang dilakukan:
 *   1. Baca seluruh MASTER DATA dari Apps Script (action `master.list`).
 *   2. Upsert ke `master_items` berdasarkan material_number.
 *
 * Aman diulang: memakai upsert, jadi menjalankan dua kali tidak menggandakan
 * baris. Material yang sudah ada di Postgres akan DIPERBARUI mengikuti Sheets —
 * jalankan ini hanya SEBELUM menyalakan MASTER_SOURCE=postgres, atau saat memang
 * ingin menyamakan ulang dari spreadsheet.
 *
 * Butuh di .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GOOGLE_SHEETS_API_URL, GOOGLE_SHEETS_API_SECRET.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
loadEnv({ path: resolve(root, ".env.local") });

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function fail(msg: string): never {
  console.error(`${c.red}✖ ${msg}${c.reset}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEETS_URL = process.env.GOOGLE_SHEETS_API_URL?.trim();
const SHEETS_SECRET = process.env.GOOGLE_SHEETS_API_SECRET?.trim();
const EXPECTED_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

if (!SUPABASE_URL || !SERVICE_ROLE) {
  fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local.");
}
if (!SHEETS_URL || !SHEETS_SECRET) {
  fail("GOOGLE_SHEETS_API_URL / GOOGLE_SHEETS_API_SECRET belum diisi di .env.local.");
}
if (!EXPECTED_SPREADSHEET_ID) {
  fail("GOOGLE_SHEETS_SPREADSHEET_ID wajib diisi agar backfill tidak dapat membaca workbook yang salah.");
}

type MasterSheetItem = {
  id: string | number;
  no: number;
  kategori: string;
  material_number: string;
  rack: number | null;
  klasifikasi: string;
  area: string;
  nama_barang: string;
  lokasi: string;
  satuan?: string;
  status: "AKTIF" | "NONAKTIF";
};

type SheetsHealth = {
  service: string;
  apiVersion?: string;
  timeZone: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  masterSheetReady?: boolean;
  rackSheetReady?: boolean;
  rackSource?: "workbook" | "external" | "embedded";
  rackCount?: number;
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function coba<T>(nama: string, fn: () => Promise<T>, n = 4): Promise<T> {
  let terakhir: unknown;
  for (let i = 0; i < n; i += 1) {
    try {
      return await fn();
    } catch (err) {
      terakhir = err;
      if (i < n - 1) {
        const jeda = 1000 * Math.pow(2, i);
        console.log(
          `${c.yellow}  ${nama}: ${err instanceof Error ? err.message : String(err)} — coba lagi dalam ${jeda / 1000}s…${c.reset}`
        );
        await new Promise((r) => setTimeout(r, jeda));
      }
    }
  }
  throw terakhir;
}

async function panggilSheets<T>(action: string): Promise<T> {
  const respons = await coba(`Sheets ${action}`, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(SHEETS_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SHEETS_SECRET, action, payload: {} }),
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  });

  const body = (await respons.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } }
    | null;
  if (!body || !body.ok) {
    fail(
      `Google Sheets menolak permintaan: ${(body as { error?: { message?: string } })?.error?.message ?? "tak diketahui"}`
    );
  }
  return body.data;
}

async function ambilMasterSheets(): Promise<MasterSheetItem[]> {
  console.log(`${c.dim}→ Membaca MASTER DATA dari Google Sheets…${c.reset}`);
  const data = await panggilSheets<{ items: MasterSheetItem[] }>("master.list");
  const items = data.items ?? [];
  console.log(`${c.dim}  ${items.length} material terbaca.${c.reset}`);
  return items;
}

/** "row:24" atau 24 → 24 (nomor baris di sheet, dipakai mirror). */
function barisSheet(id: string | number): number | null {
  const teks = String(id ?? "").trim();
  const cocok = teks.match(/^(?:row:)?(\d+)$/);
  return cocok ? Number(cocok[1]) : null;
}

async function main() {
  console.log(`\n${c.bold}WARES — backfill Master Data (Sheets → Postgres)${c.reset}`);
  console.log(`${c.dim}${SUPABASE_URL}${c.reset}\n`);

  console.log(`${c.dim}→ Memastikan Apps Script terhubung ke workbook yang benar…${c.reset}`);
  const health = await panggilSheets<SheetsHealth>("health");
  if (!health.spreadsheetId) {
    fail(
      "Deployment Apps Script belum mengirim identitas spreadsheet. Salin Code.gs terbaru, buat versi deployment baru, lalu ulangi backfill."
    );
  }
  if (EXPECTED_SPREADSHEET_ID && health.spreadsheetId !== EXPECTED_SPREADSHEET_ID) {
    fail(
      `URL Apps Script mengarah ke ${health.spreadsheetName ?? health.spreadsheetId} (${health.spreadsheetId}), bukan spreadsheet ${EXPECTED_SPREADSHEET_ID}.`
    );
  }
  if (health.masterSheetReady === false) {
    fail("Sheet MASTER DATA tidak ditemukan pada workbook Apps Script.");
  }
  if (health.rackSheetReady === false) {
    fail("Daftar RACK GUDANG belum lengkap; API harus mengembalikan tepat 50 Rack.");
  }
  console.log(
    `${c.green}  ${health.spreadsheetName ?? "Spreadsheet"} (${health.spreadsheetId}) — Apps Script ${health.apiVersion ?? "versi aktif"}; Rack ${health.rackSource ?? "aktif"}${health.rackCount == null ? "" : ` (${health.rackCount})`}${c.reset}`
  );

  const items = await ambilMasterSheets();
  if (items.length === 0) fail("MASTER DATA kosong; dibatalkan agar tidak menghapus data.");

  const pemeriksaanTabel = await supabase
    .from("master_items")
    .select("id", { count: "exact", head: true });
  if (pemeriksaanTabel.error) {
    fail(
      `Tabel master_items belum siap (${pemeriksaanTabel.error.message}). Jalankan migrasi supabase/migrations/2026-08-10-master-items-postgres.sql terlebih dahulu.`
    );
  }

  // Material number ganda akan menabrak unique index. Yang terakhir menang,
  // sama seperti perilaku pembacaan spreadsheet.
  const perNomor = new Map<string, MasterSheetItem>();
  let ganda = 0;
  for (const item of items) {
    const kunci = (item.material_number ?? "").trim().toUpperCase();
    if (!kunci) continue;
    if (perNomor.has(kunci)) ganda += 1;
    perNomor.set(kunci, item);
  }
  if (ganda > 0) {
    console.log(`${c.yellow}  ${ganda} material number ganda di spreadsheet — yang terakhir dipakai.${c.reset}`);
  }
  const tanpaNomor = items.length - items.filter((i) => (i.material_number ?? "").trim()).length;
  if (tanpaNomor > 0) {
    console.log(`${c.yellow}  ${tanpaNomor} baris tanpa material number dilewati.${c.reset}`);
  }

  const waktuBackfill = new Date().toISOString();
  const baris = [...perNomor.values()].map((item, index) => ({
    no: Number(item.no) || index + 1,
    material_number: String(item.material_number).trim(),
    nama_barang: String(item.nama_barang ?? "").trim(),
    kategori: String(item.kategori ?? "").trim(),
    klasifikasi: String(item.klasifikasi ?? "").trim(),
    lokasi: String(item.lokasi ?? "").trim(),
    rack: item.rack == null ? null : Number(item.rack),
    area: String(item.area ?? "").trim(),
    satuan: String(item.satuan ?? "").trim(),
    status: item.status === "NONAKTIF" ? "NONAKTIF" : "AKTIF",
    sheet_row: barisSheet(item.id),
    sheet_sync_status: "synced",
    sheet_sync_error: null,
    sheet_synced_at: waktuBackfill,
  }));

  console.log(`${c.dim}→ Menulis ${baris.length} material ke Postgres…${c.reset}`);
  const CHUNK = 500;
  for (let i = 0; i < baris.length; i += CHUNK) {
    const bagian = baris.slice(i, i + CHUNK);
    const nomor = i / CHUNK + 1;
    await coba(`upsert batch ${nomor}`, async () => {
      const { error } = await supabase
        .from("master_items")
        .upsert(bagian, { onConflict: "material_number_normalized", ignoreDuplicates: false });
      if (error?.code === "42P10") {
        fail(
          "Indeks upsert Master Data belum terpasang. Jalankan ulang migrasi 2026-08-10-master-items-postgres.sql, lalu ulangi backfill."
        );
      }
      if (error) throw new Error(error.message);
    });
    console.log(`${c.dim}  batch ${nomor}: ${bagian.length} material${c.reset}`);
  }

  const { count } = await coba("hitung akhir", async () => {
    const res = await supabase.from("master_items").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(res.error.message);
    return res;
  });

  console.log(`\n${c.green}${c.bold}Selesai.${c.reset} ${count} material di master_items.`);
  console.log(
    `Langkah berikut: set ${c.bold}MASTER_SOURCE=postgres${c.reset} di Vercel, lalu Redeploy. ` +
      `Balik ke ${c.bold}sheets${c.reset} kapan pun bila perlu.\n`
  );
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
