import type { MasterDataSource } from "@/lib/master-data-types";

export const MASTER_SOURCE_ENV = "MASTER_SOURCE";

export type MasterSourceInspection =
  | { ok: true; source: MasterDataSource; raw: string }
  | {
      ok: false;
      source: null;
      raw: string | null;
      reason: "MISSING" | "INVALID";
    };

/**
 * Membaca konfigurasi tanpa memilih sumber secara diam-diam.
 *
 * Master Data sudah mempunyai dua penyimpanan yang sama-sama terlihat valid.
 * Fallback implisit berbahaya karena deployment yang salah konfigurasi dapat
 * membaca spreadsheet lama atau tabel Postgres kosong tanpa disadari admin.
 */
export function inspectMasterSource(rawValue = process.env.MASTER_SOURCE): MasterSourceInspection {
  const raw = rawValue?.trim() ?? "";
  if (!raw) return { ok: false, source: null, raw: null, reason: "MISSING" };

  const normalized = raw.toLowerCase();
  if (normalized === "postgres" || normalized === "sheets") {
    return { ok: true, source: normalized, raw };
  }

  return { ok: false, source: null, raw, reason: "INVALID" };
}
