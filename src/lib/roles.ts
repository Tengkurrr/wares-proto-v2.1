/**
 * Peran WARES v2 (3-tier) menggantikan `is_admin` biner v1.
 * Matriks hak akses mengikuti slide: L = lihat, I = input/ubah, - = tak ada akses.
 */
import type { Profile } from "./types";

export type Peran = "maintenance" | "warehouse" | "admin";

export const DAFTAR_PERAN: { id: Peran; label: string }[] = [
  { id: "maintenance", label: "Maintenance" },
  { id: "warehouse", label: "Warehouse" },
  { id: "admin", label: "Admin" },
];

export function isPeran(v: unknown): v is Peran {
  return v === "maintenance" || v === "warehouse" || v === "admin";
}

/** Peran efektif dari profil: kolom `role` bila ada, jika tidak turunkan dari is_admin. */
export function peranDariProfile(profile: Pick<Profile, "is_admin" | "role">): Peran {
  if (isPeran(profile.role)) return profile.role;
  return profile.is_admin ? "admin" : "maintenance";
}

/* ---- Predikat akses per fitur (dipakai nav, guard halaman, tombol aksi) ---- */

export const bisaLihatBiaya = (p: Peran) => p === "warehouse" || p === "admin"; // maintenance: -
export const bisaUbahParameter = (p: Peran) => p === "admin";
export const bisaLihatParameter = (p: Peran) => p === "warehouse" || p === "admin";

export const bisaBuatRequest = (p: Peran) => p === "maintenance" || p === "admin";
export const bisaUbahStatusRequest = (p: Peran) => p === "warehouse" || p === "admin";

export const bisaInputTransaksi = (p: Peran) => p === "warehouse";
export const bisaKoreksiTransaksi = (p: Peran) => p === "admin";

export const bisaInputMasterData = (p: Peran) => p === "warehouse" || p === "admin";
export const bisaInputStok = (p: Peran) => p === "warehouse" || p === "admin";
