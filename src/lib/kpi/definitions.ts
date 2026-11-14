/**
 * Definisi 8 KPI inti manajemen sparepart.
 *
 * Berkas ini sengaja MURNI (tanpa `server-only`, tanpa I/O) supaya rumusnya bisa
 * dipakai bersama oleh komponen klien, route API, dan unit test — satu sumber
 * kebenaran, sehingga angka di kartu dashboard tidak mungkin berbeda dari angka
 * yang dihitung di tempat lain.
 *
 * PENTING: urutan dan label kolom di sini harus SAMA dengan header sheet
 * "Dashboard KPI" yang dibuat `setupDashboardKpi()` di google-apps-script/Code.gs.
 * Apps Script tidak bisa mengimpor modul TypeScript, jadi kedua daftar itu
 * dirawat berpasangan; `KPI_KOLOM_INPUT` di bawah adalah acuannya.
 */

/** Pengukuran KPI dimulai Juli 2026 sesuai keputusan pemilik proses. */
export const KPI_BULAN_MULAI = "2026-07";

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** 16 angka mentah yang diisi admin di spreadsheet — 2 per KPI. */
export const KPI_FIELDS = [
  "permintaan_terpenuhi",
  "total_permintaan",
  "critical_tersedia",
  "critical_wajib",
  "item_stockout",
  "total_item_diminta",
  "total_hari_penyediaan",
  "jumlah_request_lead_time",
  "request_sesuai_sla",
  "total_request_sla",
  "wo_tertunda_sparepart",
  "total_wo_maintenance",
  "item_stok_akurat",
  "total_item_diperiksa",
  "nilai_slow_dead_stock",
  "total_nilai_inventory",
] as const;

export type KpiField = (typeof KPI_FIELDS)[number];

/** Header kolom input di sheet, berpasangan dengan KPI_FIELDS di atas. */
export const KPI_KOLOM_INPUT: ReadonlyArray<{ field: KpiField; header: string }> = [
  { field: "permintaan_terpenuhi", header: "PERMINTAAN LANGSUNG TERPENUHI" },
  { field: "total_permintaan", header: "TOTAL PERMINTAAN" },
  { field: "critical_tersedia", header: "CRITICAL SPARE TERSEDIA" },
  { field: "critical_wajib", header: "TOTAL CRITICAL SPARE WAJIB" },
  { field: "item_stockout", header: "ITEM MENGALAMI STOCKOUT" },
  { field: "total_item_diminta", header: "TOTAL ITEM DIMINTA" },
  { field: "total_hari_penyediaan", header: "TOTAL HARI PENYEDIAAN" },
  { field: "jumlah_request_lead_time", header: "JUMLAH REQUEST (LEAD TIME)" },
  { field: "request_sesuai_sla", header: "REQUEST SELESAI SESUAI SLA" },
  { field: "total_request_sla", header: "TOTAL REQUEST (SLA)" },
  { field: "wo_tertunda_sparepart", header: "WO TERTUNDA KARENA SPAREPART" },
  { field: "total_wo_maintenance", header: "TOTAL WO MAINTENANCE" },
  { field: "item_stok_akurat", header: "ITEM STOK FISIK = STOK SISTEM" },
  { field: "total_item_diperiksa", header: "TOTAL ITEM DIPERIKSA" },
  { field: "nilai_slow_dead_stock", header: "NILAI SLOW/DEAD STOCK" },
  { field: "total_nilai_inventory", header: "TOTAL NILAI INVENTORY SPAREPART" },
];

export type KpiFormat = "persen" | "hari";
/** Arah yang dianggap membaik — dipakai untuk mewarnai delta antar bulan. */
export type KpiArah = "tinggi-baik" | "rendah-baik";

export type KpiDefinition = {
  id: string;
  nomor: number;
  nama: string;
  /** Nama pendek untuk kartu sempit. */
  namaSingkat: string;
  pembilang: KpiField;
  penyebut: KpiField;
  labelPembilang: string;
  labelPenyebut: string;
  format: KpiFormat;
  arah: KpiArah;
  /** Penjelasan singkat untuk panel detail. */
  penjelasan: string;
};

/**
 * Delapan KPI beserta rumusnya, disalin persis dari lembar "8 KPI INTI
 * MANAJEMEN SPAREPART". Pembilang dan penyebut selalu berupa angka mentah,
 * jadi persentasenya dihitung ulang — bukan diketik admin — dan tetap benar
 * ketika beberapa bulan digabung.
 */
export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: "sparepart-availability",
    nomor: 1,
    nama: "Sparepart Availability",
    namaSingkat: "Availability",
    pembilang: "permintaan_terpenuhi",
    penyebut: "total_permintaan",
    labelPembilang: "Permintaan yang langsung terpenuhi",
    labelPenyebut: "Total permintaan",
    format: "persen",
    arah: "tinggi-baik",
    penjelasan: "Seberapa sering barang yang diminta memang ada saat diminta.",
  },
  {
    id: "critical-spare-availability",
    nomor: 2,
    nama: "Critical Spare Availability",
    namaSingkat: "Critical Spare",
    pembilang: "critical_tersedia",
    penyebut: "critical_wajib",
    labelPembilang: "Critical spare tersedia",
    labelPenyebut: "Total critical spare yang wajib tersedia",
    format: "persen",
    arah: "tinggi-baik",
    penjelasan: "Kesiapan sparepart kritis yang wajib selalu ada di gudang.",
  },
  {
    id: "stockout-rate",
    nomor: 3,
    nama: "Stockout Rate",
    namaSingkat: "Stockout",
    pembilang: "item_stockout",
    penyebut: "total_item_diminta",
    labelPembilang: "Item yang mengalami stockout",
    labelPenyebut: "Total item yang diminta",
    format: "persen",
    arah: "rendah-baik",
    penjelasan: "Porsi item yang diminta tetapi stoknya kosong.",
  },
  {
    id: "provision-lead-time",
    nomor: 4,
    nama: "Provision Lead Time",
    namaSingkat: "Lead Time",
    pembilang: "total_hari_penyediaan",
    penyebut: "jumlah_request_lead_time",
    labelPembilang: "Σ (tanggal sparepart tersedia − tanggal request)",
    labelPenyebut: "Jumlah request",
    format: "hari",
    arah: "rendah-baik",
    penjelasan: "Rata-rata hari dari permintaan sampai sparepart tersedia.",
  },
  {
    id: "sla-fulfillment",
    nomor: 5,
    nama: "SLA Fulfillment",
    namaSingkat: "SLA",
    pembilang: "request_sesuai_sla",
    penyebut: "total_request_sla",
    labelPembilang: "Request selesai sesuai SLA",
    labelPenyebut: "Total request",
    format: "persen",
    arah: "tinggi-baik",
    penjelasan: "Porsi permintaan yang selesai dalam batas waktu yang dijanjikan.",
  },
  {
    id: "maintenance-delay",
    nomor: 6,
    nama: "Maintenance Delay due to Sparepart",
    namaSingkat: "Maint. Delay",
    pembilang: "wo_tertunda_sparepart",
    penyebut: "total_wo_maintenance",
    labelPembilang: "WO maintenance tertunda karena sparepart",
    labelPenyebut: "Total WO maintenance",
    format: "persen",
    arah: "rendah-baik",
    penjelasan: "Seberapa besar gudang menjadi penghambat pekerjaan maintenance.",
  },
  {
    id: "inventory-accuracy",
    nomor: 7,
    nama: "Inventory Accuracy",
    namaSingkat: "Akurasi Stok",
    pembilang: "item_stok_akurat",
    penyebut: "total_item_diperiksa",
    labelPembilang: "Item dengan stok fisik = stok sistem",
    labelPenyebut: "Total item diperiksa",
    format: "persen",
    arah: "tinggi-baik",
    penjelasan: "Kecocokan catatan sistem dengan barang yang benar-benar ada.",
  },
  {
    id: "slow-dead-stock",
    nomor: 8,
    nama: "Slow / Dead Stock",
    namaSingkat: "Slow/Dead",
    pembilang: "nilai_slow_dead_stock",
    penyebut: "total_nilai_inventory",
    labelPembilang: "Nilai slow/dead stock",
    labelPenyebut: "Total nilai inventory sparepart",
    format: "persen",
    arah: "rendah-baik",
    penjelasan: "Porsi nilai persediaan yang mengendap dan tidak berputar.",
  },
];

/** Empat KPI yang disorot lebih besar, sesuai blok "4 KPI UTAMA UNTUK FOKUS VP". */
export const KPI_UTAMA = [
  "sparepart-availability",
  "provision-lead-time",
  "maintenance-delay",
  "slow-dead-stock",
] as const;

export type KpiNilaiMentah = Record<KpiField, number>;

export type KpiBulan = {
  /** Kunci bulan `YYYY-MM`. */
  bulan: string;
  nilai: KpiNilaiMentah;
};

/**
 * Bentuk data KPI yang siap dipakai UI. Diletakkan di modul murni ini (bukan di
 * `source.ts` yang `server-only`) supaya komponen klien boleh mengimpor tipenya.
 */
export type KpiDataset = {
  bulan: KpiBulan[];
  /** Target opsional per id KPI; hanya terisi bila admin mengisinya di sheet. */
  target: Record<string, number>;
  sheetName: string;
  generatedAt: string;
};

export type KpiMuat =
  | { ok: true; data: KpiDataset }
  | { ok: false; kode: string; pesan: string };

export type KpiHasil = {
  definisi: KpiDefinition;
  pembilang: number;
  penyebut: number;
  /** `null` bila penyebut 0 — artinya belum ada data, bukan nilai nol. */
  nilai: number | null;
  /** Terisi bila pembilang melebihi penyebut pada KPI persentase (salah input). */
  anomali: string | null;
};

export function nilaiMentahKosong(): KpiNilaiMentah {
  return Object.fromEntries(KPI_FIELDS.map((field) => [field, 0])) as KpiNilaiMentah;
}

/** Angka dari spreadsheet dibersihkan: negatif dan NaN tidak pernah masuk hitungan. */
export function angkaAman(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

export function labelBulan(bulan: string): string {
  const [tahun, bulanKe] = bulan.split("-");
  const nama = NAMA_BULAN[Number(bulanKe) - 1];
  return nama ? `${nama} ${tahun}` : bulan;
}

export function labelBulanSingkat(bulan: string): string {
  const [tahun, bulanKe] = bulan.split("-");
  const nama = NAMA_BULAN[Number(bulanKe) - 1];
  return nama ? `${nama.slice(0, 3)} ${tahun}` : bulan;
}

/**
 * Menjumlahkan angka mentah beberapa bulan.
 *
 * Inilah alasan spreadsheet menyimpan pembilang & penyebut, bukan persentase
 * jadi: rata-rata dari persentase bulanan SALAH ketika jumlah permintaan tiap
 * bulan berbeda. Menjumlahkan dulu baru membagi memberi angka gabungan yang benar.
 */
export function jumlahkanBulan(bulan: readonly KpiBulan[]): KpiNilaiMentah {
  const total = nilaiMentahKosong();
  for (const item of bulan) {
    for (const field of KPI_FIELDS) {
      total[field] += angkaAman(item.nilai[field]);
    }
  }
  return total;
}

export function hitungSatuKpi(definisi: KpiDefinition, nilai: KpiNilaiMentah): KpiHasil {
  const pembilang = angkaAman(nilai[definisi.pembilang]);
  const penyebut = angkaAman(nilai[definisi.penyebut]);
  const anomali =
    definisi.format === "persen" && penyebut > 0 && pembilang > penyebut
      ? `${definisi.labelPembilang} (${pembilang}) lebih besar daripada ${definisi.labelPenyebut.toLowerCase()} (${penyebut}). Periksa isian di spreadsheet.`
      : null;

  if (penyebut <= 0) {
    return { definisi, pembilang, penyebut, nilai: null, anomali };
  }
  const rasio = pembilang / penyebut;
  return {
    definisi,
    pembilang,
    penyebut,
    nilai: definisi.format === "persen" ? rasio * 100 : rasio,
    anomali,
  };
}

/** Menghitung kedelapan KPI untuk kumpulan bulan yang sedang dipilih. */
export function hitungKpi(bulan: readonly KpiBulan[]): KpiHasil[] {
  const total = jumlahkanBulan(bulan);
  return KPI_DEFINITIONS.map((definisi) => hitungSatuKpi(definisi, total));
}

/**
 * Selisih terhadap periode pembanding. Positif berarti angkanya naik — belum
 * tentu membaik, karena itu `membaik` dihitung memakai arah tiap KPI.
 */
export function selisihKpi(
  sekarang: KpiHasil,
  sebelumnya: KpiHasil | undefined
): { delta: number; membaik: boolean } | null {
  if (!sebelumnya || sekarang.nilai === null || sebelumnya.nilai === null) return null;
  const delta = sekarang.nilai - sebelumnya.nilai;
  if (delta === 0) return { delta: 0, membaik: true };
  const naik = delta > 0;
  return { delta, membaik: sekarang.definisi.arah === "tinggi-baik" ? naik : !naik };
}

export function formatNilaiKpi(hasil: Pick<KpiHasil, "definisi" | "nilai">): string {
  if (hasil.nilai === null) return "—";
  const angka = hasil.nilai.toLocaleString("id-ID", {
    minimumFractionDigits: hasil.definisi.format === "hari" ? 1 : 2,
    maximumFractionDigits: hasil.definisi.format === "hari" ? 1 : 2,
  });
  return hasil.definisi.format === "persen" ? `${angka}%` : angka;
}

export function satuanKpi(definisi: KpiDefinition): string {
  return definisi.format === "persen" ? "%" : "hari";
}

export function rumusKpi(definisi: KpiDefinition): string {
  const inti = `${definisi.labelPembilang} ÷ ${definisi.labelPenyebut}`;
  return definisi.format === "persen" ? `(${inti}) × 100` : inti;
}
