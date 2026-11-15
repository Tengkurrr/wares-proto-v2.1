/**
 * Mode lokal (review tanpa database).
 *
 * Saat `NEXT_PUBLIC_WARES_LOCAL=1`, seluruh app WARES v2 dapat dijalankan di
 * localhost tanpa Supabase/Apps Script: auth distub (profil demo + peran dari
 * cookie), dan sumber data memakai fixture 99 item. Dipakai untuk mereview UI &
 * alur sebelum integrasi database/spreadsheet sungguhan.
 *
 * Flag NEXT_PUBLIC agar terbaca sama di middleware (edge), server component,
 * route handler, dan komponen klien.
 */
export function isLocalMode(): boolean {
  return process.env.NEXT_PUBLIC_WARES_LOCAL === "1";
}

/** Nama cookie peran untuk pengalih peran dev-only di mode lokal. */
export const COOKIE_PERAN = "wares-peran";
