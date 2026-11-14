import "server-only";

import { getStockMetadata, type MasterDataItem, type StockItem, type StockSnapshot } from "@/lib/google-sheets/client";
import { getCachedStockSnapshot } from "@/lib/google-sheets/stock-cache";
import { readMasterData } from "@/lib/master-data/source";
import { createClient } from "@/lib/supabase/server";

/**
 * Sumber stok aktif, dipilih lewat env `STOCK_SOURCE`.
 *
 * - `sheets`  (default): perilaku lama — stok dibaca/ditulis lewat Google Sheets.
 * - `postgres`: stok berjalan dari jurnal Postgres `stock_ledger` (kilat, tanpa
 *   lock Apps Script). Sheets tetap dipakai sebagai mirror/laporan.
 *
 * Flag ini membuat peralihan bisa dinyalakan/dimatikan tanpa deploy ulang kode dan
 * langsung reversibel bila ada masalah. Lihat migrasi
 * `supabase/migrations/2026-08-03-stock-ledger.sql`.
 */
export type StockSource = "postgres" | "sheets";

export function getStockSource(): StockSource {
  return process.env.STOCK_SOURCE?.trim().toLowerCase() === "postgres" ? "postgres" : "sheets";
}

/** Snapshot stok dari sumber aktif, selalu berbentuk `StockSnapshot`. */
export async function readStockSnapshot(): Promise<StockSnapshot> {
  if (getStockSource() === "postgres") {
    return readSnapshotFromPostgres();
  }
  return getCachedStockSnapshot();
}

/** Daftar keterangan MASUK untuk dropdown Input Stok, dari sumber aktif. */
export async function readStockKeterangan(): Promise<{ keterangan: string[] }> {
  if (getStockSource() === "postgres") {
    const snapshot = await readSnapshotFromPostgres();
    return { keterangan: snapshot.keterangan };
  }
  return getStockMetadata();
}

async function readSnapshotFromPostgres(): Promise<StockSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_snapshot");
  if (error) {
    throw new Error(error.message || "Gagal membaca stok dari database.");
  }
  const snapshot = (data as StockSnapshot | null) ?? {
    items: [],
    keterangan: [],
    reportSheet: "",
    generatedAt: new Date().toISOString(),
  };

  // Overlay MASTER DATA: membawa rack/area terbaru, menyembunyikan material
  // NONAKTIF, dan memunculkan material baru dengan stok 0. Sumbernya mengikuti
  // `MASTER_SOURCE` — Postgres (milidetik) atau Sheets ber-cache 60 detik.
  try {
    const master = await readMasterData();
    snapshot.items = gabungkanMasterData(snapshot.items, master);
  } catch (error) {
    // Bila mirror Sheets sedang gangguan, stok Postgres tetap dapat dibaca.
    console.warn("Master Data Sheets belum dapat memperkaya snapshot Postgres", error);
    snapshot.items = snapshot.items.map((item) => ({
      ...item,
      rack: item.rack ?? null,
      area: item.area ?? "",
    }));
  }
  return snapshot;
}

function kunciBarang(kode: string | null | undefined, nama: string) {
  const normalizedCode = kode?.trim().toUpperCase();
  return normalizedCode
    ? `CODE:${normalizedCode}`
    : `NAME:${nama.trim().replace(/\s+/g, " ").toUpperCase()}`;
}

function gabungkanMasterData(items: StockItem[], master: MasterDataItem[]): StockItem[] {
  const byKey = new Map(
    master.map((item) => [kunciBarang(item.material_number, item.nama_barang), item] as const)
  );
  const terlihat = new Set<string>();
  const hasil: StockItem[] = [];

  for (const item of items) {
    const key = kunciBarang(item.kode_barang, item.nama_barang);
    const detail = byKey.get(key);
    if (detail?.status === "NONAKTIF") continue;
    terlihat.add(key);
    hasil.push({
      ...item,
      kode_barang: detail?.material_number || item.kode_barang,
      nama_barang: detail?.nama_barang || item.nama_barang,
      kategori: detail?.kategori || item.kategori,
      lokasi: detail?.lokasi || item.lokasi,
      satuan: detail?.satuan || item.satuan,
      rack: detail?.rack ?? item.rack ?? null,
      area: detail?.area || item.area || "",
    });
  }

  // Material baru harus langsung terlihat dengan stok 0, sebelum transaksi
  // MASUK pertamanya membuat baris pada stock_ledger.
  for (const detail of master) {
    const key = kunciBarang(detail.material_number, detail.nama_barang);
    if (detail.status === "NONAKTIF" || terlihat.has(key)) continue;
    hasil.push({
      kode_barang: detail.material_number || null,
      nama_barang: detail.nama_barang,
      kategori: detail.kategori,
      lokasi: detail.lokasi,
      satuan: detail.satuan || "",
      stok: 0,
      rack: detail.rack,
      area: detail.area,
    });
  }

  return hasil.sort((a, b) => a.nama_barang.localeCompare(b.nama_barang, "id"));
}
