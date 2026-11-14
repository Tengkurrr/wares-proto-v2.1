import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import { KPI_BULAN_MULAI, KPI_DEFINITIONS, KPI_KOLOM_INPUT, labelBulan } from "./definitions";

/**
 * Apps Script tidak dapat mengimpor TypeScript, jadi definisi KPI ada dua kali:
 * di `definitions.ts` dan di `google-apps-script/Code.gs`. Kalau keduanya
 * bergeser, spreadsheet dan website akan menghitung hal yang berbeda tanpa ada
 * yang error — persis jenis kesalahan yang paling sulit disadari.
 *
 * Berkas Code.gs karena itu benar-benar dieksekusi di dalam `node:vm` (bukan
 * dicocokkan dengan regex), sehingga tes ini sekaligus memastikan sintaksnya
 * sah dan nilai konstantanya identik dengan yang dipakai website.
 */

const BERKAS_APPS_SCRIPT = path.join(process.cwd(), "google-apps-script", "Code.gs");

type AppsScriptGlobals = {
  WARES_KPI_INPUT: Array<[string, string]>;
  WARES_KPI: Array<[string, string, string, string, string, string]>;
  kpiMonthLabel_: (offset: number) => string;
  parseKpiMonth_: (value: unknown) => string | null;
  kpiInputIndex_: (field: string) => number;
  columnLetter_: (column: number) => string;
  kpiSumFormula_: (
    kolom: string,
    periode: string,
    rentangBulan: string,
    awal: number,
    akhir: number
  ) => string;
};

function muatAppsScript(): AppsScriptGlobals {
  // Layanan Apps Script hanya dipanggil di dalam fungsi, jadi konteks kosong
  // sudah cukup untuk mengevaluasi deklarasi tingkat atas.
  const konteks: Record<string, unknown> = { console };
  vm.createContext(konteks);
  new vm.Script(readFileSync(BERKAS_APPS_SCRIPT, "utf8"), { filename: "Code.gs" }).runInContext(
    konteks
  );
  return konteks as unknown as AppsScriptGlobals;
}

test("kolom input KPI di Apps Script sejajar dengan definitions.ts", () => {
  const { WARES_KPI_INPUT } = muatAppsScript();
  // `Array.from` di realm tes: array asal berasal dari konteks vm, sehingga
  // perbandingan ketat akan gagal hanya karena prototipenya berbeda.
  assert.deepEqual(
    Array.from(WARES_KPI_INPUT, (kolom) => kolom[0]),
    KPI_KOLOM_INPUT.map((kolom) => kolom.field)
  );
  assert.deepEqual(
    Array.from(WARES_KPI_INPUT, (kolom) => kolom[1]),
    KPI_KOLOM_INPUT.map((kolom) => kolom.header)
  );
});

test("8 KPI di Apps Script memakai id, nama, field, dan format yang sama", () => {
  const { WARES_KPI } = muatAppsScript();
  assert.equal(WARES_KPI.length, KPI_DEFINITIONS.length);
  WARES_KPI.forEach((baris, index) => {
    const definisi = KPI_DEFINITIONS[index];
    assert.equal(baris[0], definisi.id, `id KPI #${index + 1} berbeda`);
    assert.equal(baris[1], definisi.nama, `nama KPI ${definisi.id} berbeda`);
    assert.equal(baris[2], definisi.pembilang, `pembilang ${definisi.id} berbeda`);
    assert.equal(baris[3], definisi.penyebut, `penyebut ${definisi.id} berbeda`);
    assert.equal(baris[4], definisi.format, `format ${definisi.id} berbeda`);
  });
});

test("arah baik di Apps Script cocok dengan arah di website", () => {
  const { WARES_KPI } = muatAppsScript();
  WARES_KPI.forEach((baris, index) => {
    const diharapkan =
      KPI_DEFINITIONS[index].arah === "tinggi-baik"
        ? "Semakin tinggi semakin baik"
        : "Semakin rendah semakin baik";
    assert.equal(baris[5], diharapkan, `arah ${KPI_DEFINITIONS[index].id} berbeda`);
  });
});

test("label bulan Apps Script identik dengan label website", () => {
  const { kpiMonthLabel_, parseKpiMonth_ } = muatAppsScript();
  assert.equal(kpiMonthLabel_(0), labelBulan(KPI_BULAN_MULAI));
  assert.equal(kpiMonthLabel_(0), "Juli 2026");
  assert.equal(kpiMonthLabel_(5), "Desember 2026");
  assert.equal(kpiMonthLabel_(6), "Januari 2027");
  assert.equal(kpiMonthLabel_(12), "Juli 2027");
});

test("label bulan spreadsheet dibaca kembali menjadi kunci YYYY-MM", () => {
  const { parseKpiMonth_, kpiMonthLabel_ } = muatAppsScript();
  assert.equal(parseKpiMonth_("Juli 2026"), "2026-07");
  assert.equal(parseKpiMonth_("Jul 2026"), "2026-07");
  assert.equal(parseKpiMonth_("  Desember 2026 "), "2026-12");
  assert.equal(parseKpiMonth_("2026-07"), "2026-07");
  assert.equal(parseKpiMonth_("2026-7"), "2026-07");
  // Baris catatan bebas tidak boleh ikut terbaca sebagai periode.
  assert.equal(parseKpiMonth_("Catatan tambahan"), null);
  assert.equal(parseKpiMonth_(""), null);
  assert.equal(parseKpiMonth_("2026-13"), null);

  // Setiap bulan yang dibuat setup harus bisa dibaca kembali tanpa kehilangan makna.
  for (let offset = 0; offset < 36; offset += 1) {
    assert.ok(parseKpiMonth_(kpiMonthLabel_(offset)), `bulan offset ${offset} tidak terbaca`);
  }
});

test("rumus panel kanan menjumlahkan kolom input yang benar", () => {
  const { WARES_KPI, columnLetter_, kpiInputIndex_, kpiSumFormula_ } = muatAppsScript();

  // Kolom A berisi BULAN, sehingga field ke-n menempati kolom (n + 2).
  const kolomAvailability = columnLetter_(2 + kpiInputIndex_(WARES_KPI[0][2]));
  assert.equal(kolomAvailability, "B");
  assert.equal(columnLetter_(2 + kpiInputIndex_(WARES_KPI[0][3])), "C");
  // Provision Lead Time memakai TOTAL HARI PENYEDIAAN (H) dan JUMLAH REQUEST (I).
  assert.equal(columnLetter_(2 + kpiInputIndex_(WARES_KPI[3][2])), "H");
  assert.equal(columnLetter_(2 + kpiInputIndex_(WARES_KPI[3][3])), "I");
  assert.equal(columnLetter_(2 + kpiInputIndex_(WARES_KPI[7][3])), "Q");

  assert.equal(
    kpiSumFormula_(kolomAvailability, "$T$3", "$A$5:$A$200", 5, 200),
    '=IF($T$3="Overall",SUM($B$5:$B$200),SUMIF($A$5:$A$200,$T$3,$B$5:$B$200))'
  );
});
