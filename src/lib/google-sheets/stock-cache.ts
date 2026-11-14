import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

import { getStockSnapshot, type StockSnapshot } from "./client";

/**
 * Cache snapshot stok Google Sheets.
 *
 * Panggilan langsung ke Apps Script memakan waktu 1–3 detik (kadang lebih saat
 * lock-nya berebut), sementara `/api/stock` dipanggil dari banyak tempat —
 * info stok, form buat-permintaan, dan combobox barang tiap kali dibuka. Tanpa
 * cache, setiap panggilan itu menabrak Sheets dan terasa lemot.
 *
 * `unstable_cache` menyimpan hasilnya di Data Cache Next yang persisten antar
 * invocation di Vercel (bukan sekadar memori satu instance). Dengan
 * `revalidate: 15`, snapshot dianggap segar 15 detik; sesudah itu Next memakai
 * stale-while-revalidate bawaannya — pembaca langsung menerima snapshot lama
 * sementara penyegaran berjalan di latar. Jadi setelah muat pertama, tidak ada
 * pembaca yang menunggu Sheets, dan angka paling lama tertinggal ~15 detik.
 */

const STOCK_TAG = "wares-stock-snapshot";
const REVALIDATE_DETIK = 15;

const bacaSnapshotTerCache = unstable_cache(
  async (): Promise<StockSnapshot> => getStockSnapshot(),
  ["wares-stock-snapshot"],
  { revalidate: REVALIDATE_DETIK, tags: [STOCK_TAG] }
);

/** Snapshot stok dari cache. Error Sheets tidak ikut disimpan, jadi aman diulang. */
export function getCachedStockSnapshot(): Promise<StockSnapshot> {
  return bacaSnapshotTerCache();
}

/**
 * Tandai cache stok basi setelah ada tulisan (permintaan baru/edit, input stok)
 * supaya pembacaan berikutnya mengambil angka terbaru dari Sheets. Aman dipanggil
 * di route handler; kalau di luar konteks yang mendukung, kegagalannya ditelan
 * agar tidak menggagalkan transaksi utama yang sudah berhasil.
 */
export function invalidateStockCache() {
  try {
    revalidateTag(STOCK_TAG);
  } catch {
    // Revalidasi hanya optimasi kesegaran; TTL 15 detik tetap menjadi batas aman.
  }
}
