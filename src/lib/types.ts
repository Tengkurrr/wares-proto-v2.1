export type Profile = {
  id: string;
  username: string;
  nama_lengkap: string;
  no_hp: string | null;
  email_kerja: string | null;
  is_admin: boolean;
  created_at: string;
};

export type CatalogItem = {
  id: number;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
  rack: number | null;
  area: string;
};

export type RequestRow = {
  id: string;
  user_id: string;
  pekerjaan: string;
  lokasi_pekerjaan: string;
  kategori: string[];
  /** Nama petugas yang menyerahkan barang — diketik manual, bukan dari akun login. */
  nama_penyerah: string;
  /** Nama karyawan penerima barang — diketik manual. */
  nama_penerima: string;
  /** Kolom lama yang dipertahankan untuk data yang sudah ada. Bukan status persetujuan. */
  status: string;
  created_at: string;
  updated_at: string;
};

export type RequestItemRow = {
  id: string;
  request_id: string;
  catalog_item_id: number | null;
  kode_barang: string | null;
  kategori_barang: string;
  lokasi_barang: string;
  nama_barang: string;
  satuan: string;
  jumlah_permintaan: number;
  jumlah_diberikan: number;
  /** @deprecated Gunakan jumlah_permintaan atau jumlah_diberikan sesuai konteks. */
  jumlah: number;
  urutan: number;
};

/** Bentuk data yang dipakai komponen preview & PDF. */
export type SuratData = {
  pekerjaan: string;
  lokasi: string;
  kategori: string[];
  namaPenerima: string;
  namaPenyerah: string;
  tanggal: string;
  items: {
    nama_barang: string;
    satuan: string;
    jumlahPermintaan: number;
    jumlahDiberikan: number;
  }[];
};
