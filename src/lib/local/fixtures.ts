import "server-only";

import type { MasterDataItem, StockItem, StockSnapshot } from "@/lib/google-sheets/client";

import catalog from "./catalog.json";

type Katalog = {
  no: number;
  material_number: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  stok: number;
  rack: number;
  area: string;
  klasifikasi: string;
  lokasi: string;
  status: string;
};

const ITEMS = (catalog as { items: Katalog[] }).items;

/** Snapshot stok 99 item untuk mode lokal (dipakai /api/stock → Informasi Stok,
 *  item-picker Buat Permintaan, requisition-form). */
export function localStockSnapshot(): StockSnapshot {
  const items: StockItem[] = ITEMS.map((it) => ({
    kode_barang: it.material_number,
    nama_barang: it.nama_barang,
    kategori: it.kategori,
    lokasi: it.lokasi,
    satuan: it.satuan,
    stok: it.stok,
    rack: it.rack,
    area: it.area,
  }));
  return {
    items,
    keterangan: [],
    reportSheet: "LOKAL (fixture 99 item)",
    generatedAt: new Date().toISOString(),
  };
}

/** Daftar Master Data 99 item untuk mode lokal (/api/master-data). */
export function localMasterItems(): MasterDataItem[] {
  return ITEMS.map((it) => ({
    id: it.material_number,
    no: it.no,
    kategori: it.kategori,
    material_number: it.material_number,
    rack: it.rack,
    klasifikasi: it.klasifikasi,
    area: it.area,
    nama_barang: it.nama_barang,
    lokasi: it.lokasi,
    status: it.status === "NONAKTIF" ? "NONAKTIF" : "AKTIF",
    satuan: it.satuan,
  }));
}
