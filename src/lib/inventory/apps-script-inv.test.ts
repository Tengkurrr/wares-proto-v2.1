import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

/**
 * Parser inventory di `google-apps-script/Code.gs` menghasilkan bentuk JSON yang
 * HARUS sama dengan fixture di `src/lib/inventory/data/*.json`, karena website
 * membaca keduanya lewat tipe yang sama (`@/lib/inventory/types`). Kalau salah
 * satu sisi bergeser, mode fixture dan mode Sheets akan menampilkan hal berbeda
 * tanpa ada yang error.
 *
 * Di sini Code.gs benar-benar dijalankan di `node:vm` (bukan dicocokkan regex),
 * dengan SpreadsheetApp/Utilities distub memakai grid sintetis yang meniru tata
 * letak sheet asli. Ini menjaga: (1) sintaks Code.gs sah, (2) logika cari-header,
 * pemetaan kolom, penghentian baris, format tanggal ISO, dan pembulatan benar.
 * Verifikasi kesetaraan penuh atas data Excel sungguhan dilakukan terpisah di
 * harness pengembangan; tes ini adalah penjaga regresi yang ringan.
 */

const BERKAS = path.join(process.cwd(), "google-apps-script", "Code.gs");

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Sheet = unknown[][];

function muat(grids: Record<string, Sheet>) {
  const Utilities = {
    formatDate(date: Date, _tz: string, pattern: string) {
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      return pattern === "yyyy-MM" ? `${y}-${m}` : `${y}-${m}-${d}`;
    },
  };
  const SpreadsheetApp = {
    getActiveSpreadsheet() {
      return {
        getSheetByName(name: string) {
          if (!(name in grids)) return null;
          return { getDataRange: () => ({ getValues: () => grids[name] }) };
        },
      };
    },
  };
  const ctx: Record<string, unknown> = { console, Utilities, SpreadsheetApp };
  vm.createContext(ctx);
  new vm.Script(readFileSync(BERKAS, "utf8"), { filename: "Code.gs" }).runInContext(ctx);
  return ctx as Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Hasil fungsi berasal dari realm vm, jadi array/objeknya memakai prototipe lain;
 * `deepStrictEqual` akan gagal hanya karena itu. JSON round-trip menormalkan ke
 * realm tes tanpa mengubah nilai.
 */
function panggil<T>(ctx: Record<string, (...args: unknown[]) => unknown>, fn: string): T {
  return JSON.parse(JSON.stringify(ctx[fn]())) as T;
}

function gridsSintetis(): Record<string, Sheet> {
  const tgl1 = new Date(2026, 8, 1); // 2026-09-01
  const tgl2 = new Date(2026, 8, 8); // 2026-09-08
  const tiba = new Date(2027, 1, 28); // 2027-02-28

  const DASHBOARD: Sheet = [
    ["", "DASHBOARD STATUS SPAREPART (WARES - DSS)"],
    [],
    [],
    ["", "Filter mesin", "SEMUA", "", "", "", "Total SKU", "Kritis", "Pesan sekarang", "Cukup", "% Cukup", "Nilai pesanan (Rp)"],
    ["", "Tanggal acuan (review)", tgl1, "", "", "", 3, 1, 1, 1, 0.3333333333, 1000000],
    ["", "Periode review R (hari)", 7],
    ["", "Service level", 0.9, "", "", "Mesin", "Kritis", "Pesan sekarang", "Cukup", "Total"],
    ["", "Transaksi dicatat mulai", tgl1, "", "", "BAGGING MACHINE", 1, 1, 1, 3],
    ["", "", "", "", "", "TOTAL", 1, 1, 1, 3],
    [],
    [],
    [],
    [],
    ["No.", "Mesin", "Sparepart", "ECR", "Satuan", "Lead time L (hari)", "Kebutuhan PM jendela L+R", "Kuantil RM jendela L+R", "Target S", "Stok fisik", "Pesanan dalam perjalanan", "Posisi persediaan", "Kebutuhan selama L (PM + RM)", "Status", "Jumlah pesan (unit)", "Perkiraan tiba", "Tindak lanjut"],
    [1, "BAGGING MACHINE", "REGULATOR X", "A", "EA", 180, 9, 0, 9, 3, 0, 3, 6, "Kritis", 6, tiba, "Pesan 6 EA SEKARANG"],
    [2, "BAGGING MACHINE", "PISTON Y", "A", "EA", 7, 0, 0, 0, 16, 0, 16, 0, "Cukup", 0, "-", "-"],
  ];

  const RM_HASIL: Sheet = [
    ["No", "Kategori", "Kriteria", "Nama Barang", "Lead Time (hari)", "Service Level", "Total Keluar (35 mgg)", "Rata-rata / minggu", "Std Dev / minggu", "Demand selama LT (mu)", "Std Dev selama LT (sigma)", "z", "SS Normal", "ROP Normal", "Stok Poisson", "STOK HOLD (ROP) REKOMENDASI", "SAFETY STOCK (SS) REKOMENDASI", "Dasar"],
    [1, "BAGGING MACHINE", "CRITICAL", "REGULATOR X", 180, 0.9, 5, 0.1428, 0.69, 0.14, 0.69, 1.2815, 0.88, 1.03, 1, 2, 1.39, "Poisson"],
  ];

  const DEMAND: Sheet = [
    ["Demand mingguan per item"],
    [],
    ["KEY (Nama Barang)", 1, 2, 3],
    ["REGULATOR X", 0, 2, 0],
  ];

  const OP_STOK: Sheet = [
    ["OP STOK"],
    [],
    ["", "", "Review ke-", "", 0, 1],
    ["", "", "Tanggal review", "", tgl1, tgl2],
    ["", "", "Aktif (1/0)", "", 1, 1],
    ["", "", "Nilai stok positif (Rp)", "", 207326080, 248748199.14285713],
    ["", "", "Jumlah SKU kekurangan", "", 0, 1],
    [],
    ["Stok fisik di gudang"],
    ["No", "Bagian", "Nama sparepart", "", tgl1, tgl2],
    [1, "BAGGING", "REGULATOR X", "", 3, 2.9714285714],
  ];

  const TERPAKAI: Sheet = [
    ["NAMA BARANG", "BAGIAN", "TYPE BARANG", "ECR", "SATUAN", "ADI", "CV^2", "Pola Demand"],
    ["REGULATOR X", "BAGGING MACHINE", "EQUIPMENT", "A", "EA", 7, 0.88, "Lumpy"],
  ];

  const OP_ORDER: Sheet = [
    ["OP ORDER: Order Quantity per SKU"],
    [],
    ["", "", "Review ke-", "", 0, 1],
    ["", "", "Tanggal review", "", tgl1, tgl2],
    ["", "", "Aktif (1/0)", "", 1, 1],
    ["", "", "Total unit dipesan (satuan)", "", 34, 29],
    ["", "", "Jumlah SKU yang dipesan", "", 26, 29],
    ["", "", "Nilai pesanan (Rp)", "", 57903055, 53748055],
    ["No", "Bagian", "Nama sparepart", "", tgl1, tgl2],
    [1, "BAGGING", "REGULATOR X", "", 1, 1],
  ];

  const tgl3 = new Date(2028, 11, 31); // akhir horizon
  const OP_RENCANA: Sheet = [
    ["OP RENCANA: Inventory Policy"],
    [],
    ["", "", "Periode review R (hari)", 7, "", "", "Jumlah PO (review yang memesan)", 52],
    ["", "", "Tanggal review pertama", tgl1, "", "", "Total unit dipesan (satuan)", 7060],
    ["", "", "Akhir horizon rencana", tgl3, "", "", "Nilai pesanan (Rp)", 6593981445],
    ["", "", "Service level (semua SKU)", 0.9, "", "", "Biaya pesan = PO x K (Rp)", 18200000],
    ["", "", "Biaya pesan K per PO (Rp) - ESTIMASI", 350000, "", "", "Rata-rata nilai stok (Rp)", 222815568.66],
    ["", "", "Biaya simpan per tahun (fraksi)", 0.2, "", "", "Biaya simpan = nilai stok x fraksi", 44563113.73],
    ["", "", "Tahun acuan untuk ringkasan", 2028, "", "", "Kejadian kekurangan (SKU-review)", 0],
    ["", "", "Jumlah review (otomatis)", 122, "", "", "Total kekurangan (unit)", 0],
    ["", "", "", "", "", "", "Biaya pesan + simpan (Rp)", 62763113.73],
    [],
    [],
    ["No", "Bagian", "Nama sparepart", "Satuan", "Qty terpasang", "Jumlah mesin", "Interval SKU (hari)", "Tambahan per siklus (kali)", "Overhaul pertama", "Lead time L (hari)", "Jendela L+R (hari)", "RM rata-rata / minggu", "RM std / minggu", "Kuantil RM dalam jendela", "Harga (Rp/unit)", "Biaya simpan (Rp/unit/tahun)", "Stok awal", "Total dipesan (seluruh horizon)", "Dipesan di tahun acuan", "Jumlah order di tahun acuan", "Rata-rata stok di tahun acuan", "Kejadian kekurangan di tahun acuan"],
    [1, "BAGGING", "KABEL LOADCELL ORANGE", "METER", 1, 36, 1289, 0, "", 150, 157, 0.0285, 0.169, 2, 40000, 8000, 20, 73, 35, 13, 2.175, 0],
  ];

  const p1 = new Date(2027, 0, 1); // 2027-01-01
  const p2awal = new Date(2027, 1, 1); // 2027-02-01
  const p1akhir = new Date(2027, 0, 31);
  const p2akhir = new Date(2027, 1, 28);
  const pJahit = new Date(2027, 4, 1); // 2027-05-01
  const pBag = new Date(2027, 8, 1); // 2027-09-01
  const cakupanSampai = new Date(2028, 11, 31);
  const PM_OVERHAUL: Sheet = [
    ["PM OVERHAUL: Kalender Kebutuhan"],
    [],
    ["", "", "Mode tampilan (Hari / Minggu / Bulan)", "Bulan", "", "", "", "", "", "", "Siklus overhaul C (hari)", 365],
    ["", "", "Tanggal awal tampilan", p1, "", "", "", "", "", "", "Jumlah kelompok mesin G (36 mesin)", 12],
    ["", "", "Jumlah periode (1 sampai 400)", 24, "", "", "", "", "", "", "Overhaul pertama: BAGGING", p1],
    ["", "", "Cakupan tampilan (dari / sampai)", p1, cakupanSampai, "", "", "", "", "", "Overhaul pertama: JAHIT", pJahit],
    ["", "", "", "", "", "", "", "", "", "", "Overhaul pertama: BAGCODING", pBag],
    [],
    [],
    ["", "", "", "", "", "", "", "", "", "", "Total unit semua SKU (satuan campuran)", 270, 6],
    ["", "", "", "", "", "", "", "", "", "", "   dari overhaul", 270, 0],
    ["", "", "", "", "", "", "", "", "", "", "   dari penggantian tambahan", 0, 6],
    ["", "", "", "", "", "", "", "", "", "", "Periode ke-", 1, 2],
    ["", "", "", "", "", "", "", "", "", "", "Awal periode", p1, p2awal],
    ["No", "Bagian", "Nama sparepart", "Satuan", "Qty terpasang", "Jumlah mesin", "Interval SKU (hari)", "Overhaul pertama", "Penggantian tambahan per siklus", "Total unit di tampilan", "Akhir periode", p1akhir, p2akhir],
    [1, "BAGGING", "KABEL LOADCELL ORANGE", "METER", 1, 36, 1289, p1, 0, 75, "", 6, 0],
  ];

  return {
    DASHBOARD,
    RM_HASIL,
    "DATA_DEMAND (RM)": DEMAND,
    OP_STOK,
    "DATA_SKU TERPAKAI": TERPAKAI,
    OP_ORDER,
    OP_RENCANA,
    PM_OVERHAUL,
  };
}

test("Code.gs valid & fungsi inventory tersedia di vm", () => {
  const ctx = muat(gridsSintetis());
  for (const fn of [
    "getInventoryDashboard_",
    "getInventoryRmHasil_",
    "getInventoryProyeksi_",
    "getInventoryDemand_",
    "getInventoryPola_",
    "getInventoryOpOrder_",
    "getInventoryOpRencana_",
    "getInventoryPm_",
  ]) {
    assert.equal(typeof ctx[fn], "function", `${fn} tidak terdefinisi`);
  }
});

test("inv.dashboard: ringkasan, per-mesin, dan item SKU terbaca benar", () => {
  const ctx = muat(gridsSintetis());
  const d = panggil<{
    ringkasan: Record<string, number | string>;
    perMesin: Array<Record<string, number | string>>;
    items: Array<Record<string, number | string>>;
  }>(ctx, "getInventoryDashboard_");
  assert.equal(d.ringkasan.totalSku, 3);
  assert.equal(d.ringkasan.kritis, 1);
  assert.equal(d.ringkasan.nilaiPesanan, 1000000);
  assert.equal(d.ringkasan.tanggalAcuan, "2026-09-01");
  assert.equal(d.ringkasan.periodeReviewHari, 7);
  assert.equal(d.ringkasan.serviceLevel, 0.9);

  assert.equal(d.perMesin.length, 1); // TOTAL menghentikan iterasi
  assert.equal(d.perMesin[0].mesin, "BAGGING MACHINE");
  assert.equal(d.perMesin[0].total, 3);

  assert.equal(d.items.length, 2);
  assert.equal(d.items[0].sparepart, "REGULATOR X");
  assert.equal(d.items[0].status, "Kritis");
  assert.equal(d.items[0].targetS, 9);
  assert.equal(d.items[0].perkiraanTiba, "2027-02-28");
  assert.equal(d.items[1].perkiraanTiba, "-");
});

test("inv.rmhasil & inv.pola: kolom kunci terpetakan", () => {
  const ctx = muat(gridsSintetis());
  const rm = panggil<Array<Record<string, number | string>>>(ctx, "getInventoryRmHasil_");
  assert.equal(rm.length, 1);
  assert.equal(rm[0].namaBarang, "REGULATOR X");
  assert.equal(rm[0].ropRekomendasi, 2);
  assert.equal(rm[0].dasar, "Poisson");

  const pola = panggil<Array<Record<string, number | string>>>(ctx, "getInventoryPola_");
  assert.equal(pola[0].pola, "Lumpy");
  assert.equal(pola[0].cv2, 0.88);
});

test("inv.demand: kolom minggu & deret terbaca", () => {
  const ctx = muat(gridsSintetis());
  const dm = panggil<{ minggu: number[]; items: Array<{ nama: string; mingguan: number[] }> }>(ctx, "getInventoryDemand_");
  assert.deepEqual(dm.minggu, [1, 2, 3]);
  assert.equal(dm.items[0].nama, "REGULATOR X");
  assert.deepEqual(dm.items[0].mingguan, [0, 2, 0]);
});

test("inv.proyeksi: tanggal review, ringkasan, dan deret stok (dibulatkan 3 desimal)", () => {
  const ctx = muat(gridsSintetis());
  const p = panggil<{
    reviewDates: string[];
    nilaiStok: number[];
    jumlahKurang: number[];
    series: Array<{ nama: string; bagian: string; stok: number[] }>;
  }>(ctx, "getInventoryProyeksi_");
  assert.deepEqual(p.reviewDates, ["2026-09-01", "2026-09-08"]);
  assert.deepEqual(p.nilaiStok, [207326080, 248748199]);
  assert.deepEqual(p.jumlahKurang, [0, 1]);
  assert.equal(p.series[0].nama, "REGULATOR X");
  assert.equal(p.series[0].bagian, "BAGGING");
  assert.deepEqual(p.series[0].stok, [3, 2.971]);
});

test("inv.oporder: ringkasan per review & qty pesan per SKU", () => {
  const ctx = muat(gridsSintetis());
  const o = panggil<{
    reviewDates: string[];
    totalUnit: number[];
    jumlahSku: number[];
    nilaiPesanan: number[];
    series: Array<{ nama: string; bagian: string; qty: number[] }>;
  }>(ctx, "getInventoryOpOrder_");
  assert.deepEqual(o.reviewDates, ["2026-09-01", "2026-09-08"]);
  assert.deepEqual(o.totalUnit, [34, 29]);
  assert.deepEqual(o.jumlahSku, [26, 29]);
  assert.deepEqual(o.nilaiPesanan, [57903055, 53748055]);
  assert.equal(o.series[0].nama, "REGULATOR X");
  assert.deepEqual(o.series[0].qty, [1, 1]);
});

test("inv.oprencana: parameter, ringkasan biaya, dan item (pencocokan header 'contains')", () => {
  const ctx = muat(gridsSintetis());
  const r = panggil<{
    params: Record<string, number | string>;
    ringkasan: Record<string, number>;
    items: Array<Record<string, number | string>>;
  }>(ctx, "getInventoryOpRencana_");

  assert.equal(r.params.periodeReviewHari, 7);
  assert.equal(r.params.tanggalReviewPertama, "2026-09-01");
  assert.equal(r.params.akhirHorizon, "2028-12-31");
  assert.equal(r.params.serviceLevel, 0.9);
  assert.equal(r.params.biayaPesanK, 350000);
  assert.equal(r.params.biayaSimpanTahun, 0.2);
  assert.equal(r.params.tahunAcuan, 2028);
  assert.equal(r.params.jumlahReview, 122);

  assert.equal(r.ringkasan.jumlahPO, 52);
  assert.equal(r.ringkasan.totalUnitDipesan, 7060);
  assert.equal(r.ringkasan.nilaiPesanan, 6593981445);
  assert.equal(r.ringkasan.biayaPesan, 18200000);
  assert.equal(r.ringkasan.biayaPesanSimpan, 62763113.73);

  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].nama, "KABEL LOADCELL ORANGE");
  assert.equal(r.items[0].harga, 40000);
  assert.equal(r.items[0].biayaSimpanUnit, 8000);
  assert.equal(r.items[0].stokAwal, 20);
  assert.equal(r.items[0].dipesanTahunAcuan, 35);
  assert.equal(r.items[0].jumlahOrder, 13);
  assert.equal(r.items[0].leadTime, 150);
});

test("inv.pm: config overhaul, periode (dibatasi yang aktif), total, & item", () => {
  const ctx = muat(gridsSintetis());
  const pm = panggil<{
    config: {
      siklusC: number;
      jumlahMesinG: number;
      modeTampilan: string;
      jumlahPeriode: number;
      overhaulPertama: Array<{ mesin: string; tanggal: string }>;
    };
    periods: Array<{ no: number; awal: string; akhir: string }>;
    totalPerPeriode: { totalUnit: number[]; dariOverhaul: number[]; dariPenggantian: number[] };
    items: Array<Record<string, number | string | number[]>>;
  }>(ctx, "getInventoryPm_");

  assert.equal(pm.config.siklusC, 365);
  assert.equal(pm.config.jumlahMesinG, 12);
  assert.equal(pm.config.modeTampilan, "Bulan");
  assert.equal(pm.config.jumlahPeriode, 24);
  assert.equal(pm.config.overhaulPertama.length, 3);
  assert.deepEqual(pm.config.overhaulPertama[0], { mesin: "BAGGING", tanggal: "2027-01-01" });
  assert.deepEqual(pm.config.overhaulPertama[1], { mesin: "JAHIT", tanggal: "2027-05-01" });

  assert.equal(pm.periods.length, 2);
  assert.deepEqual(pm.periods[0], { no: 1, awal: "2027-01-01", akhir: "2027-01-31" });
  assert.equal(pm.periods[1].awal, "2027-02-01");

  assert.deepEqual(pm.totalPerPeriode.totalUnit, [270, 6]);
  assert.deepEqual(pm.totalPerPeriode.dariOverhaul, [270, 0]);
  assert.deepEqual(pm.totalPerPeriode.dariPenggantian, [0, 6]);

  assert.equal(pm.items.length, 1);
  assert.equal(pm.items[0].nama, "KABEL LOADCELL ORANGE");
  assert.equal(pm.items[0].intervalSKU, 1289);
  assert.equal(pm.items[0].overhaulPertama, "2027-01-01");
  assert.equal(pm.items[0].totalUnitTampilan, 75);
  assert.deepEqual(pm.items[0].perPeriode, [6, 0]);
});
