import "server-only";

import {
  getKpiData,
  GoogleSheetsError,
  isGoogleSheetsConfigured,
  type KpiSheetPayload,
} from "@/lib/google-sheets/client";
import { getCachedKpiData, invalidateKpiCache } from "@/lib/google-sheets/kpi-cache";

import {
  angkaAman,
  KPI_BULAN_MULAI,
  KPI_DEFINITIONS,
  KPI_FIELDS,
  type KpiBulan,
  type KpiDataset,
  type KpiMuat,
  type KpiNilaiMentah,
} from "./definitions";

export type { KpiDataset, KpiMuat };

/**
 * Pembacaan data Dashboard KPI dari spreadsheet.
 *
 * Arah datanya sengaja KEBALIKAN dari Master Data dan stok: di sini spreadsheet
 * adalah sumber kebenaran dan website hanya mencerminkan. Admin mengisi angka
 * mentah di sheet "Dashboard KPI", website membacanya lalu menghitung ulang
 * dengan rumus yang sama seperti panel kanan sheet tersebut.
 */

const KUNCI_BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ID_KPI_DIKENAL = new Set(KPI_DEFINITIONS.map((definisi) => definisi.id));

function normalkan(payload: KpiSheetPayload): KpiDataset {
  const bulan: KpiBulan[] = [];
  const sudahAda = new Set<string>();

  for (const baris of payload?.months ?? []) {
    const kunci = typeof baris?.bulan === "string" ? baris.bulan.trim() : "";
    // Pengukuran KPI dimulai Juli 2026. Baris berlabel lebih awal — misalnya
    // sisa uji coba — tidak boleh ikut menggeser angka Overall.
    if (!KUNCI_BULAN.test(kunci) || kunci < KPI_BULAN_MULAI || sudahAda.has(kunci)) continue;
    sudahAda.add(kunci);
    bulan.push({
      bulan: kunci,
      nilai: Object.fromEntries(
        KPI_FIELDS.map((field) => [field, angkaAman(baris?.nilai?.[field])])
      ) as KpiNilaiMentah,
    });
  }
  bulan.sort((a, b) => a.bulan.localeCompare(b.bulan));

  const target: Record<string, number> = {};
  for (const [id, nilai] of Object.entries(payload?.targets ?? {})) {
    if (!ID_KPI_DIKENAL.has(id)) continue;
    const angka = angkaAman(nilai);
    if (angka > 0) target[id] = angka;
  }

  return {
    bulan,
    target,
    sheetName: typeof payload?.sheetName === "string" ? payload.sheetName : "Dashboard KPI",
    generatedAt:
      typeof payload?.generatedAt === "string" ? payload.generatedAt : new Date().toISOString(),
  };
}

export async function ambilDataKpi(opsi: { segar?: boolean } = {}): Promise<KpiDataset> {
  if (opsi.segar) {
    // Dibaca langsung agar tombol Muat ulang benar-benar mengambil angka terbaru;
    // tag tetap di-invalidasi supaya pembaca lain ikut segar setelahnya.
    invalidateKpiCache();
    return normalkan(await getKpiData());
  }
  return normalkan(await getCachedKpiData());
}

/**
 * Varian yang tidak pernah melempar: dipakai halaman dashboard supaya analitik
 * barang keluar tetap tampil meskipun sheet KPI belum dibuat atau Sheets sedang
 * bermasalah.
 */
export async function ambilDataKpiAman(): Promise<KpiMuat> {
  if (!isGoogleSheetsConfigured()) {
    return {
      ok: false,
      kode: "NOT_CONFIGURED",
      pesan:
        "Integrasi Google Sheets belum dikonfigurasi di server, sehingga Dashboard KPI belum dapat dimuat.",
    };
  }
  try {
    return { ok: true, data: await ambilDataKpi() };
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return { ok: false, kode: error.code, pesan: error.message };
    }
    console.error("Gagal memuat Dashboard KPI", error);
    return {
      ok: false,
      kode: "UNKNOWN",
      pesan: "Data Dashboard KPI tidak dapat dimuat saat ini.",
    };
  }
}
