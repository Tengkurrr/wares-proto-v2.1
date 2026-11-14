export type StatusMaterial = "AKTIF" | "NONAKTIF";
export type MasterDataSource = "postgres" | "sheets";

export type RackOption = {
  rack: number;
  area: string;
};

export type MasterDataItem = {
  id: string | number;
  no: number;
  kategori: string;
  material_number: string;
  rack: number | null;
  klasifikasi: string;
  area: string;
  nama_barang: string;
  lokasi: string;
  status: StatusMaterial;
};
