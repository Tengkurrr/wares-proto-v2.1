import assert from "node:assert/strict";
import test from "node:test";

import {
  formatNilaiKpi,
  hitungKpi,
  hitungSatuKpi,
  jumlahkanBulan,
  KPI_DEFINITIONS,
  KPI_FIELDS,
  KPI_KOLOM_INPUT,
  KPI_UTAMA,
  labelBulan,
  nilaiMentahKosong,
  selisihKpi,
  type KpiBulan,
} from "./definitions";

function bulan(kunci: string, isi: Partial<Record<(typeof KPI_FIELDS)[number], number>>): KpiBulan {
  return { bulan: kunci, nilai: { ...nilaiMentahKosong(), ...isi } };
}

test("delapan KPI terdefinisi dengan id unik dan pasangan kolom yang valid", () => {
  assert.equal(KPI_DEFINITIONS.length, 8);
  assert.equal(new Set(KPI_DEFINITIONS.map((k) => k.id)).size, 8);
  assert.deepEqual(
    KPI_DEFINITIONS.map((k) => k.nomor),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  for (const definisi of KPI_DEFINITIONS) {
    assert.ok(KPI_FIELDS.includes(definisi.pembilang), `${definisi.id}: pembilang tidak dikenal`);
    assert.ok(KPI_FIELDS.includes(definisi.penyebut), `${definisi.id}: penyebut tidak dikenal`);
  }
});

test("setiap kolom input dipakai tepat sekali oleh KPI", () => {
  const terpakai = KPI_DEFINITIONS.flatMap((k) => [k.pembilang, k.penyebut]);
  assert.equal(terpakai.length, KPI_FIELDS.length);
  assert.deepEqual([...terpakai].sort(), [...KPI_FIELDS].sort());
});

test("header kolom sheet sejajar dengan daftar field", () => {
  assert.equal(KPI_KOLOM_INPUT.length, KPI_FIELDS.length);
  assert.deepEqual(
    KPI_KOLOM_INPUT.map((k) => k.field),
    [...KPI_FIELDS]
  );
  assert.equal(new Set(KPI_KOLOM_INPUT.map((k) => k.header)).size, KPI_FIELDS.length);
});

test("empat KPI utama merujuk id yang benar-benar ada", () => {
  for (const id of KPI_UTAMA) {
    assert.ok(KPI_DEFINITIONS.some((k) => k.id === id), `${id} tidak ditemukan`);
  }
});

test("rumus persentase memakai pembilang ÷ penyebut × 100", () => {
  const hasil = hitungKpi([
    bulan("2026-07", { permintaan_terpenuhi: 940, total_permintaan: 1000 }),
  ]);
  const availability = hasil.find((h) => h.definisi.id === "sparepart-availability")!;
  assert.equal(availability.nilai, 94);
  assert.equal(formatNilaiKpi(availability), "94,00%");
});

test("lead time memakai Σ hari ÷ jumlah request tanpa dikali 100", () => {
  const hasil = hitungKpi([
    bulan("2026-07", { total_hari_penyediaan: 96, jumlah_request_lead_time: 30 }),
  ]);
  const leadTime = hasil.find((h) => h.definisi.id === "provision-lead-time")!;
  assert.equal(leadTime.nilai, 3.2);
  assert.equal(formatNilaiKpi(leadTime), "3,2");
});

test("penyebut nol berarti belum ada data, bukan nilai nol", () => {
  const hasil = hitungKpi([bulan("2026-07", {})]);
  for (const item of hasil) assert.equal(item.nilai, null);
  assert.equal(formatNilaiKpi(hasil[0]), "—");
});

test("gabungan beberapa bulan menjumlahkan dulu baru membagi", () => {
  // Rata-rata persentase bulanan akan memberi 75%; angka yang benar adalah
  // (10+80) / (10+100) = 81,82% karena bobot bulan kedua jauh lebih besar.
  const hasil = hitungKpi([
    bulan("2026-07", { permintaan_terpenuhi: 10, total_permintaan: 10 }),
    bulan("2026-08", { permintaan_terpenuhi: 80, total_permintaan: 100 }),
  ]);
  const availability = hasil.find((h) => h.definisi.id === "sparepart-availability")!;
  assert.equal(availability.pembilang, 90);
  assert.equal(availability.penyebut, 110);
  assert.ok(Math.abs(availability.nilai! - 81.8181818) < 1e-6);
});

test("angka negatif dan bukan-angka dari spreadsheet diabaikan", () => {
  const rusak = bulan("2026-07", { permintaan_terpenuhi: -5, total_permintaan: 100 });
  (rusak.nilai as Record<string, unknown>).total_item_diminta = "bukan angka";
  const total = jumlahkanBulan([rusak]);
  assert.equal(total.permintaan_terpenuhi, 0);
  assert.equal(total.total_item_diminta, 0);
  assert.equal(total.total_permintaan, 100);
});

test("pembilang melebihi penyebut ditandai sebagai anomali input", () => {
  const definisi = KPI_DEFINITIONS.find((k) => k.id === "inventory-accuracy")!;
  const hasil = hitungSatuKpi(definisi, {
    ...nilaiMentahKosong(),
    item_stok_akurat: 120,
    total_item_diperiksa: 100,
  });
  assert.ok(hasil.anomali);
  assert.equal(hasil.nilai, 120);
});

test("arah KPI menentukan apakah kenaikan berarti membaik", () => {
  const naikPadaAvailability = selisihKpi(
    hitungKpi([bulan("2026-08", { permintaan_terpenuhi: 95, total_permintaan: 100 })])[0],
    hitungKpi([bulan("2026-07", { permintaan_terpenuhi: 90, total_permintaan: 100 })])[0]
  );
  assert.deepEqual(naikPadaAvailability, { delta: 5, membaik: true });

  const indeksStockout = KPI_DEFINITIONS.findIndex((k) => k.id === "stockout-rate");
  const naikPadaStockout = selisihKpi(
    hitungKpi([bulan("2026-08", { item_stockout: 12, total_item_diminta: 100 })])[indeksStockout],
    hitungKpi([bulan("2026-07", { item_stockout: 8, total_item_diminta: 100 })])[indeksStockout]
  );
  assert.equal(naikPadaStockout?.membaik, false);
});

test("selisih tidak dihitung ketika salah satu periode belum punya data", () => {
  const adaData = hitungKpi([bulan("2026-08", { permintaan_terpenuhi: 9, total_permintaan: 10 })])[0];
  const kosong = hitungKpi([bulan("2026-07", {})])[0];
  assert.equal(selisihKpi(adaData, kosong), null);
  assert.equal(selisihKpi(adaData, undefined), null);
});

test("label bulan memakai nama bulan Indonesia", () => {
  assert.equal(labelBulan("2026-07"), "Juli 2026");
  assert.equal(labelBulan("2026-12"), "Desember 2026");
});
