/** Jenis pekerjaan — juga dipakai sebagai filter katalog dan checkbox di PDF. */
export const KATEGORI = [
  "BAGGING MACHINE",
  "LAS FABRIKASI",
  "LISTRIK",
  "MEKANIK",
  "MESIN BAGCODING",
  "MESIN JAHIT",
  "ROBOTIC",
  "SIPIL",
  "TOOLS",
  "UMUM",
] as const;

export type Kategori = (typeof KATEGORI)[number];

/**
 * Daftar lokasi pekerjaan yang bisa dipilih (searchable, tidak bebas ketik).
 * Diturunkan dari lokasi nyata pada katalog gudang; tambah di sini bila ada lokasi baru.
 *
 * Urutan: area produksi/gudang lebih dulu (paling sering dipakai), lalu kantor
 * dan workshop. "Gudang Phonska 4" hanya muncul sekali walau ada di dua daftar.
 */
export const LOKASI = [
  "Urea 1A",
  "ZA",
  "Urea 1B",
  "Gudang Phonska 1",
  "Gudang Phonska 2/3",
  "Gudang Phonska 4",
  "Gudang Phonska 5",
  "Gudang 50k",
  "Gudang 20k",
  "Jembatan Timbang",
  "GNPC Office",
  "Workshop Pengembangan",
  "Workshop Sparepart",
] as const;

export type Lokasi = (typeof LOKASI)[number];

export const BRAND = {
  green: "#00A547",
  greenDark: "#00813A",
  greenLight: "#E7F6EE",
  gold: "#FBC800",
  ink: "#1A1A1A",
  muted: "#6B7280",
  border: "#E5E7EB",
} as const;

