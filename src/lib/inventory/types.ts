/**
 * Tipe untuk modul Inventory (WARES v2).
 *
 * Arah data modul ini SAMA dengan Dashboard KPI, bukan seperti stok v1:
 * spreadsheet "WARES Reliability x Inventory Management" adalah sumber kebenaran
 * hasil model (reliability → kebutuhan sparepart → kebijakan (R,S)), website
 * hanya mencerminkan. Yang ditulis balik ke sheet hanya transaksi & material
 * request; proyeksi/ROP/biaya tetap dihitung oleh rumus Excel, tidak di app.
 */

export type StatusStok = "Kritis" | "Pesan sekarang" | "Cukup";

/** Satu baris per SKU pada sheet DASHBOARD (status persediaan di tanggal acuan). */
export type ItemDashboard = {
  no: number;
  mesin: string;
  sparepart: string;
  ecr: string;
  satuan: string;
  leadTime: number;
  kebutuhanPM: number;
  kuantilRM: number;
  targetS: number;
  stokFisik: number;
  pesananJalan: number;
  posisiPersediaan: number;
  kebutuhanL: number;
  status: StatusStok | string;
  jumlahPesan: number;
  perkiraanTiba: string;
  tindakLanjut: string;
};

export type RingkasanDashboard = {
  totalSku: number;
  kritis: number;
  pesanSekarang: number;
  cukup: number;
  persenCukup: number;
  nilaiPesanan: number;
  tanggalAcuan: string;
  periodeReviewHari: number;
  serviceLevel: number;
};

export type BarisMesin = {
  mesin: string;
  kritis: number;
  pesanSekarang: number;
  cukup: number;
  total: number;
};

export type DashboardInventory = {
  ringkasan: RingkasanDashboard;
  perMesin: BarisMesin[];
  items: ItemDashboard[];
};

/** Satu baris per SKU kritis/essential pada sheet RM_HASIL (reliability → ROP/SS). */
export type ItemRmHasil = {
  no: number;
  kategori: string;
  kriteria: string;
  namaBarang: string;
  leadTime: number;
  serviceLevel: number;
  totalKeluar35: number;
  rataPerMinggu: number;
  stdPerMinggu: number;
  muLT: number;
  sigmaLT: number;
  z: number;
  ropRekomendasi: number;
  ssRekomendasi: number;
  dasar: string;
};

export type DemandItem = {
  nama: string;
  mingguan: number[];
};

export type DataDemand = {
  minggu: number[];
  items: DemandItem[];
};

export type PolaItem = {
  nama: string;
  bagian: string;
  tipe: string;
  pola: string;
  adi: number;
  cv2: number;
};

export type SeriesProyeksi = {
  nama: string;
  bagian: string;
  stok: number[];
};

export type ProyeksiStok = {
  reviewDates: string[];
  nilaiStok: number[];
  jumlahKurang: number[];
  series: SeriesProyeksi[];
};

/** Baris gabungan untuk halaman Detail SKU (A2): status + reliability + pola + demand. */
export type DetailSkuRow = {
  no: number;
  sparepart: string;
  mesin: string;
  satuan: string;
  kriteria: string;
  pola: string;
  leadTime: number;
  ropRekomendasi: number;
  ssRekomendasi: number;
  dasar: string;
  totalKeluar35: number;
  rataPerMinggu: number;
  status: string;
  targetS: number;
  stokFisik: number;
  demand35: number[];
};

/** A4 — Rencana pesanan (OP_ORDER): qty pesan per SKU per review mingguan. */
export type OpOrderSeri = {
  nama: string;
  bagian: string;
  qty: number[];
};

export type OpOrder = {
  reviewDates: string[];
  totalUnit: number[];
  jumlahSku: number[];
  nilaiPesanan: number[];
  series: OpOrderSeri[];
};

/** A6 — Biaya & evaluasi (OP_RENCANA): parameter kebijakan + output tahun acuan. */
export type OpRencanaParams = {
  periodeReviewHari: number;
  tanggalReviewPertama: string;
  akhirHorizon: string;
  serviceLevel: number;
  biayaPesanK: number;
  biayaSimpanTahun: number;
  tahunAcuan: number;
  jumlahReview: number;
};

export type OpRencanaRingkasan = {
  jumlahPO: number;
  totalUnitDipesan: number;
  nilaiPesanan: number;
  biayaPesan: number;
  rataNilaiStok: number;
  biayaSimpan: number;
  kejadianKekurangan: number;
  totalKekuranganUnit: number;
  biayaPesanSimpan: number;
};

export type OpRencanaItem = {
  no: number;
  bagian: string;
  nama: string;
  satuan: string;
  leadTime: number;
  harga: number;
  biayaSimpanUnit: number;
  stokAwal: number;
  totalDipesan: number;
  dipesanTahunAcuan: number;
  jumlahOrder: number;
  rataStok: number;
  kekurangan: number;
};

export type OpRencana = {
  params: OpRencanaParams;
  ringkasan: OpRencanaRingkasan;
  items: OpRencanaItem[];
};

/** A5 — Jadwal PM & overhaul (PM_OVERHAUL): kalender overhaul + kebutuhan sparepart per periode. */
export type OverhaulMesin = {
  mesin: string;
  tanggal: string;
};

export type PmConfig = {
  siklusC: number;
  jumlahMesinG: number;
  modeTampilan: string;
  tanggalAwal: string;
  jumlahPeriode: number;
  overhaulPertama: OverhaulMesin[];
};

export type PmPeriode = {
  no: number;
  awal: string;
  akhir: string;
};

export type PmTotalPerPeriode = {
  totalUnit: number[];
  dariOverhaul: number[];
  dariPenggantian: number[];
};

export type PmItem = {
  no: number;
  bagian: string;
  nama: string;
  satuan: string;
  qtyTerpasang: number;
  jumlahMesin: number;
  intervalSKU: number;
  overhaulPertama: string;
  penggantianTambahan: number;
  totalUnitTampilan: number;
  perPeriode: number[];
};

export type PmOverhaul = {
  config: PmConfig;
  periods: PmPeriode[];
  totalPerPeriode: PmTotalPerPeriode;
  items: PmItem[];
};

/** Status sumber data: menandai apakah angka berasal dari Excel/Sheets atau fixture. */
export type SumberData = "sheets" | "fixture";
