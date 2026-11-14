import { createHash } from "crypto";

import { GoogleSheetsError } from "@/lib/google-sheets/client";
import type { RequestValues } from "@/lib/schemas";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SYNC_TOKEN_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$/i;

/** Fallback untuk client lama; UI baru mengirim X-Sync-Token UUID sendiri. */
export function deterministicSyncToken(requestId: string, values: RequestValues) {
  return createHash("sha256")
    .update(JSON.stringify({ requestId, values }))
    .digest("hex");
}

export function getSyncToken(request: Request, requestId: string, values: RequestValues) {
  const header = request.headers.get("X-Sync-Token")?.trim();
  if (header && !UUID_PATTERN.test(header)) return null;
  return header || deterministicSyncToken(requestId, values);
}

export function rpcItems(values: RequestValues) {
  return values.items.map((item) => ({
    catalog_item_id: item.catalog_item_id,
    kode_barang: item.kode_barang,
    kategori_barang: item.kategori_barang,
    lokasi_barang: item.lokasi_barang,
    nama_barang: item.nama_barang,
    satuan: item.satuan,
    jumlah_permintaan: item.jumlah_permintaan,
    jumlah_diberikan: item.jumlah_diberikan,
  }));
}

/** Error ini pasti terjadi sebelum jurnal ditulis; sisanya harus dikonfirmasi. */
export function isDefinitiveSheetsError(error: unknown) {
  return error instanceof GoogleSheetsError && new Set([
    "INVALID_INPUT",
    "INVALID_DATE",
    "INVALID_QUANTITY",
    "UNKNOWN_MATERIAL",
    "INSUFFICIENT_STOCK",
    "NOT_CONFIGURED",
    "UNAUTHORIZED",
    "UNKNOWN_ACTION",
  ]).has(error.code);
}

export function sheetsErrorHttpStatus(error: GoogleSheetsError) {
  if (["INVALID_INPUT", "INVALID_DATE", "INVALID_QUANTITY", "UNKNOWN_MATERIAL"].includes(error.code)) return 400;
  if (error.code === "INSUFFICIENT_STOCK") return 409;
  if (["LOCK_TIMEOUT", "NOT_CONFIGURED"].includes(error.code)) return 503;
  if (error.code === "UNAUTHORIZED") return 502;
  return 502;
}
