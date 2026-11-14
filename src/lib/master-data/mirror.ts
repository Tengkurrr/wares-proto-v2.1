import "server-only";

import { after } from "next/server";

import {
  createMasterData,
  deactivateMasterData,
  getMasterData,
  GoogleSheetsError,
  isGoogleSheetsConfigured,
  updateMasterData,
  type MasterDataInput,
  type MasterDataItem,
} from "@/lib/google-sheets/client";
import {
  linkMasterSheetMirror,
  markMasterSheetMirrorFailed,
} from "@/lib/master-data/source";

export type MasterMirrorStatus = "queued" | "not_configured" | "unlinked";

type MasterMirrorJob = {
  operation: "create" | "update" | "deactivate";
  postgresId: string;
  item: MasterDataItem;
  previousMaterialNumber?: string | null;
  sheetRow: number | null;
};

export function masterMirrorConfigured() {
  return isGoogleSheetsConfigured();
}

export function masterMirrorWarning(status: MasterMirrorStatus): string | null {
  if (status === "not_configured") {
    return "Material tersimpan di database, tetapi mirror Google Sheets belum dikonfigurasi. Isi URL dan secret Apps Script agar spreadsheet ikut diperbarui.";
  }
  if (status === "unlinked") {
    return "Material tersimpan di database, tetapi baris spreadsheet belum tertaut sehingga perubahan belum dapat dimirror otomatis.";
  }
  return null;
}

/**
 * Jadwalkan mirror tanpa menahan respons utama. Bila tautan baris hilang dan
 * material sudah berganti kode, backend tidak menebak baris karena itu berisiko
 * menimpa material lain; kondisi tersebut dilaporkan sebagai `unlinked`.
 */
export function scheduleMasterMirror(job: MasterMirrorJob): MasterMirrorStatus {
  if (!isGoogleSheetsConfigured()) {
    console.warn("MASTER_MIRROR_NOT_CONFIGURED", {
      operation: job.operation,
      postgresId: job.postgresId,
    });
    scheduleFailure_(job, "URL atau secret Apps Script belum dikonfigurasi.");
    return "not_configured";
  }

  const renamedWithoutLink =
    job.operation === "update" &&
    job.sheetRow == null &&
    job.previousMaterialNumber != null &&
    normalized(job.previousMaterialNumber) !== normalized(job.item.material_number);
  if (renamedWithoutLink) {
    console.warn("MASTER_MIRROR_UNLINKED_RENAME_SKIPPED", {
      postgresId: job.postgresId,
    });
    scheduleFailure_(job, "Baris spreadsheet belum tertaut dan material telah berganti kode.");
    return "unlinked";
  }

  after(async () => {
    try {
      const mirrored = await runMirrorWithRetry_(job);
      const row = parseSheetRow_(mirrored.id);
      if (row == null) {
        console.warn("MASTER_MIRROR_INVALID_ROW", {
          operation: job.operation,
          postgresId: job.postgresId,
        });
        await recordFailure_(job, "Apps Script mengembalikan ID baris yang tidak valid.");
        return;
      }

      const linked = await linkMasterSheetMirror(
        job.postgresId,
        job.item.material_number,
        row,
        mirrored.satuan
      );
      if (!linked) {
        console.warn("MASTER_MIRROR_STALE_CALLBACK", {
          operation: job.operation,
          postgresId: job.postgresId,
          row,
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn("MASTER_MIRROR_FAILED", {
        operation: job.operation,
        postgresId: job.postgresId,
        reason,
      });
      await recordFailure_(job, reason);
    }
  });

  return "queued";
}

function scheduleFailure_(job: MasterMirrorJob, reason: string) {
  after(async () => recordFailure_(job, reason));
}

async function recordFailure_(job: MasterMirrorJob, reason: string) {
  try {
    await markMasterSheetMirrorFailed(job.postgresId, job.item.material_number, reason);
  } catch (statusError) {
    console.error("MASTER_MIRROR_STATUS_FAILED", {
      postgresId: job.postgresId,
      reason: statusError instanceof Error ? statusError.message : String(statusError),
    });
  }
}

async function runMirror_(job: MasterMirrorJob): Promise<MasterDataItem> {
  if (job.sheetRow == null) {
    return mirrorWithoutKnownRow_(job);
  }

  const rowId = `row:${job.sheetRow}`;
  if (job.operation === "deactivate") {
    return (await deactivateMasterData(rowId)).item;
  }
  return (await updateMasterData(rowId, toInput_(job.item))).item;
}

/**
 * Satu retry hanya untuk lock Apps Script yang sibuk. Operasi Master idempoten:
 * create kedua akan ditolak sebagai duplicate lalu direkonsiliasi ke baris yang
 * sudah ada, sedangkan update/deactivate menulis nilai yang sama.
 */
async function runMirrorWithRetry_(job: MasterMirrorJob): Promise<MasterDataItem> {
  try {
    return await runMirror_(job);
  } catch (error) {
    if (!(error instanceof GoogleSheetsError) || error.code !== "LOCK_TIMEOUT") throw error;
    await new Promise((resolve) => setTimeout(resolve, 750));
    return runMirror_(job);
  }
}

async function mirrorWithoutKnownRow_(job: MasterMirrorJob): Promise<MasterDataItem> {
  // Edit/nonaktif dari baris yang belum tertaut dapat terjadi bila callback
  // create sebelumnya terputus setelah Sheets sukses. Cari berdasarkan material
  // number lama sebelum mempertimbangkan pembuatan baris baru.
  if (job.operation !== "create" && job.previousMaterialNumber) {
    const existing = await findSheetItem_(job.previousMaterialNumber);
    if (existing) return applyToExisting_(job, existing);
  }

  try {
    return (await createMasterData(toInput_(job.item))).item;
  } catch (error) {
    if (!(error instanceof GoogleSheetsError) || error.code !== "DUPLICATE_MATERIAL") throw error;

    // Timeout create dapat berarti baris sebenarnya sudah tertulis, tetapi hasil
    // belum sempat diterima Vercel. Tautkan kembali baris yang identitasnya sama.
    const existing = await findSheetItem_(job.item.material_number);
    if (!existing) throw error;
    return job.operation === "create" ? existing : applyToExisting_(job, existing);
  }
}

async function findSheetItem_(materialNumber: string): Promise<MasterDataItem | null> {
  const wanted = normalized(materialNumber);
  const { items } = await getMasterData();
  return items.find((item) => normalized(item.material_number) === wanted) ?? null;
}

async function applyToExisting_(
  job: MasterMirrorJob,
  existing: MasterDataItem
): Promise<MasterDataItem> {
  if (job.operation === "deactivate") {
    return (await deactivateMasterData(existing.id)).item;
  }
  return (await updateMasterData(existing.id, toInput_(job.item))).item;
}

function toInput_(item: MasterDataItem): MasterDataInput {
  return {
    kategori: item.kategori,
    material_number: item.material_number,
    rack: item.rack,
    klasifikasi: item.klasifikasi,
    area: item.area,
    nama_barang: item.nama_barang,
    lokasi: item.lokasi,
    status: item.status,
  };
}

function parseSheetRow_(id: string | number): number | null {
  const match = String(id).trim().match(/^(?:row:)?(\d+)$/i);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row > 0 ? row : null;
}

function normalized(value: string) {
  return value.trim().toUpperCase();
}
