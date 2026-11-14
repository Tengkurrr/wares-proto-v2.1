/**
 * Backfill saldo awal jurnal stok Postgres (opsi B: sumber stok pindah ke Postgres).
 * Jalankan: npm run backfill:stock
 *
 * Apa yang dilakukan:
 *   1. Ambil snapshot stok TERKINI dari Google Sheets (sumber lama).
 *   2. Hapus HANYA baris ref_type='saldo_awal' — transaksi masuk/keluar yang nyata
 *      tetap utuh, jadi skrip ini tidak pernah menghapus riwayat stok.
 *   3. Tulis ulang satu baris "saldo_awal" per barang = stok bersih saat ini.
 *
 * Sesudah ini, stok berjalan = saldo awal + MASUK baru (Input Stok) − KELUAR baru
 * (request_items, via trigger). Karena saldo awal SUDAH bersih (MASUK−KELUAR masa
 * lalu dari Sheets), permintaan lama tidak ikut dikurangi dua kali.
 *
 * KAPAN dijalankan: tepat SEBELUM menyalakan STOCK_SOURCE=postgres, saat transaksi
 * dihentikan sementara (lihat WARES_AUDIT_REPORT.md). Aman diulang (idempoten:
 * selalu mengosongkan lalu mengisi ulang).
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

if (!SUPABASE_URL || !SERVICE_ROLE) {
  fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local.");
}
if (!SHEETS_URL || !SHEETS_SECRET) {
  fail("GOOGLE_SHEETS_API_URL / GOOGLE_SHEETS_API_SECRET belum diisi di .env.local.");
}

type StockItem = {
  kode_barang: string | null;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function itemKey(kode: string | null, nama: string): string {
  const k = (kode ?? "").trim();
  return k !== "" ? k : nama.trim().toLowerCase();
}

/**
 * Coba jalankan async operation beberapa kali dengan backoff eksponensial.
 * Untuk operasi jaringan yang kadang gagal sesaat (Sheets/Supabase timeout).
 */
async function coba<T>(nama: string, fn: () => Promise<T>, n = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < n; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const pesan = err instanceof Error ? err.message : String(err);
      if (i < n - 1) {
        const jeda = 1000 * Math.pow(2, i); // 1s, 2s, 4s
        console.log(`${c.yellow}  ${nama}: ${pesan} — coba lagi dalam ${jeda / 1000}s…${c.reset}`);
        await new Promise((r) => setTimeout(r, jeda));
      }
    }
  }
  throw lastErr;
}

async function ambilSnapshotSheets(): Promise<StockItem[]> {
  console.log(`${c.dim}→ Membaca snapshot stok dari Google Sheets…${c.reset}`);

  const response = await coba("Sheets fetch", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(SHEETS_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SHEETS_SECRET, action: "stock.get", payload: {} }),
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  });

  const body = (await response.json().catch(() => null)) as
    | { ok: true; data: { items: StockItem[] } }
    | { ok: false; error?: { message?: string } }
    | null;
  if (!body || !body.ok) {
    fail(`Google Sheets menolak permintaan: ${(body as { error?: { message?: string } })?.error?.message ?? "tak diketahui"}`);
  }
  const items = body.data.items ?? [];
  console.log(`${c.dim}  ${items.length} barang terbaca.${c.reset}`);
  return items;
}

async function main() {
  console.log(`\n${c.bold}WARES — backfill saldo awal stok (Sheets → Postgres)${c.reset}`);
  console.log(`${c.dim}${SUPABASE_URL}${c.reset}\n`);

  const items = await ambilSnapshotSheets();
  if (items.length === 0) fail("Snapshot kosong; batalkan agar stok tidak jadi nol.");

  // HANYA baris saldo awal yang diganti. Transaksi nyata (Input Stok = "masuk",
  // pengambilan lewat request_items = "keluar") SENGAJA dipertahankan supaya
  // menjalankan ulang skrip ini tidak pernah menghapus riwayat stok yang sudah ada.
  console.log(`${c.dim}→ Mengganti baris saldo awal (transaksi lain dipertahankan)…${c.reset}`);
  const { count: sebelum } = await coba("hitung ledger", async () => {
    const res = await supabase.from("stock_ledger").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(res.error.message);
    return res;
  });
  await coba("hapus saldo awal lama", async () => {
    const { error } = await supabase.from("stock_ledger").delete().eq("ref_type", "saldo_awal");
    if (error) throw new Error(error.message);
  });
  const { count: transaksiTersisa } = await coba("hitung transaksi tersisa", async () => {
    const res = await supabase.from("stock_ledger").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(res.error.message);
    return res;
  });
  console.log(
    `${c.dim}  ${sebelum ?? 0} baris sebelumnya · ${transaksiTersisa ?? 0} transaksi dipertahankan.${c.reset}`
  );

  const now = new Date().toISOString();
  const rows = items.map((it) => {
    const stok = Number(it.stok) || 0;
    const negatif = stok < 0;
    return {
      jenis: negatif ? "keluar" : "masuk",
      item_key: itemKey(it.kode_barang, it.nama_barang),
      kode_barang: (it.kode_barang ?? "").trim() || null,
      nama_barang: it.nama_barang,
      kategori: it.kategori ?? "",
      lokasi: it.lokasi ?? "",
      satuan: it.satuan ?? "",
      jumlah: Math.abs(stok),
      keterangan: "Saldo awal",
      ref_type: "saldo_awal",
      ref_id: null as string | null,
      transaction_id: null as string | null,
      occurred_at: now,
      created_by: null as string | null,
    };
  });

  console.log(`${c.dim}→ Menulis ${rows.length} baris saldo awal…${c.reset}`);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const nomor = i / CHUNK + 1;
    await coba(`insert batch ${nomor}`, async () => {
      const { error } = await supabase.from("stock_ledger").insert(batch);
      if (error) throw new Error(error.message);
    });
    console.log(`${c.dim}  batch ${nomor}: ${batch.length} baris${c.reset}`);
  }

  const { count } = await coba("count final", async () => {
    const res = await supabase.from("stock_ledger").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(res.error.message);
    return res;
  });

  console.log(`\n${c.green}${c.bold}Selesai.${c.reset} ${count} baris di stock_ledger.`);
  console.log(
    `Langkah berikut: set ${c.bold}STOCK_SOURCE=postgres${c.reset} di Vercel (dan .env.local), ` +
      `lalu redeploy. Balik ke ${c.bold}sheets${c.reset} kapan pun bila perlu.\n`
  );
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
