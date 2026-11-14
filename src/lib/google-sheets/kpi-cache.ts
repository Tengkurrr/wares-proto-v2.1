import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

import { getKpiData, type KpiSheetPayload } from "./client";

/**
 * Cache data Dashboard KPI.
 *
 * Angkanya diisi admin secara manual dan praktis hanya berubah beberapa kali
 * per bulan, sedangkan Apps Script butuh 1–3 detik untuk membalas. TTL 60 detik
 * membuat dashboard terasa seketika tanpa membuat perubahan di spreadsheet
 * tertahan lama; tombol Muat ulang pada kartu KPI memaksa pembacaan segar.
 */

const KPI_TAG = "wares-kpi-dashboard";
const REVALIDATE_DETIK = 60;

const bacaKpiTerCache = unstable_cache(
  async (): Promise<KpiSheetPayload> => getKpiData(),
  ["wares-kpi-dashboard"],
  { revalidate: REVALIDATE_DETIK, tags: [KPI_TAG] }
);

export function getCachedKpiData(): Promise<KpiSheetPayload> {
  return bacaKpiTerCache();
}

/** Dipakai tombol Muat ulang agar admin bisa melihat hasil editnya langsung. */
export function invalidateKpiCache() {
  try {
    revalidateTag(KPI_TAG);
  } catch {
    // Revalidasi hanya optimasi kesegaran; TTL 60 detik tetap jadi batas aman.
  }
}
