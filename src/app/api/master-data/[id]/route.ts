import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { deactivateMasterData, updateMasterData } from "@/lib/google-sheets/client";
import { sheetsErrorResponse } from "@/lib/google-sheets/http-error";
import { responsKesalahanMaster } from "@/lib/master-data/http-error";
import { invalidateMasterDataCache } from "@/lib/google-sheets/master-cache";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { masterMirrorWarning, scheduleMasterMirror } from "@/lib/master-data/mirror";
import {
  deactivateMasterItem,
  getMasterSource,
  updateMasterItem,
} from "@/lib/master-data/source";
import { canonicalRackSelection } from "@/lib/racks/canonical";
import { masterDataSchema } from "@/lib/schemas";
import { getStockSource } from "@/lib/stock/source";

export const dynamic = "force-dynamic";

const ID_SHEETS = /^(?:row:)?\d+$/;
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let source;
  try {
    source = getMasterSource();
  } catch (error) {
    return responsKesalahanMaster(error, "Konfigurasi Master Data tidak valid.");
  }
  const postgres = source === "postgres";
  if (!(postgres ? ID_UUID.test(id) : ID_SHEETS.test(id))) {
    return NextResponse.json({ error: "ID material tidak valid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }
  // Editor selalu mengirim satu record utuh. Validasi penuh mencegah patch
  // parsial melewati kewajiban rack numerik dan area dari daftar gudang.
  const parsed = masterDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Data material tidak valid.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // ===== Postgres primer, Sheets mirror =====
  if (postgres) {
    const storage = canonicalRackSelection(parsed.data.rack ?? Number.NaN, parsed.data.area);
    if (!storage.selectedRack) {
      return NextResponse.json(
        {
          error: "Nomor rack wajib dipilih dari daftar RACK GUDANG.",
          code: "INVALID_RACK",
          fields: { rack: ["Pilih Rack 1 sampai 50."] },
        },
        { status: 400 }
      );
    }
    if (!storage.selectedArea) {
      return NextResponse.json(
        {
          error: "Area wajib dipilih dari daftar RACK GUDANG.",
          code: "INVALID_AREA",
          fields: { area: ["Pilih Area dari daftar resmi."] },
        },
        { status: 400 }
      );
    }
    const nilai = { ...parsed.data, rack: storage.selectedRack.rack, area: storage.selectedArea };
    try {
      const hasil = await updateMasterItem(id, nilai);
      const peringatan: string[] = [];

      // Metadata pada riwayat stok ikut diselaraskan. Ini sekunder: snapshot stok
      // sudah meng-overlay identitas dari master, jadi tampilan tetap benar.
      if (getStockSource() === "postgres" && hasil.previous) {
        const { error: syncError } = await auth.supabase.rpc("sync_stock_master_item", {
          p_old_code: hasil.previous.material_number,
          p_old_name: hasil.previous.nama_barang,
          p_new_code: hasil.item.material_number,
          p_new_name: hasil.item.nama_barang,
          p_kategori: hasil.item.kategori,
          p_lokasi: hasil.item.lokasi,
          p_rack: hasil.item.rack,
          p_area: hasil.item.area,
        });
        if (syncError) {
          console.error("Sinkronisasi metadata stok gagal", syncError);
          peringatan.push(
            syncError.code === "PGRST202"
              ? "Material tersimpan, tetapi metadata stok belum ikut berubah karena migrasi 2026-08-09-master-data-rack.sql belum dijalankan. Jalankan migrasi sebelum mengedit material lain."
              : `Material tersimpan, tetapi metadata pada riwayat stok belum tersinkron (${syncError.message}).`
          );
        }
      }

      const mirrorStatus = scheduleMasterMirror({
        operation: "update",
        postgresId: hasil.item.id,
        item: hasil.item,
        previousMaterialNumber: hasil.previous?.material_number,
        sheetRow: hasil.sheetRow,
      });
      const mirrorWarning = masterMirrorWarning(mirrorStatus);
      if (mirrorWarning) peringatan.push(mirrorWarning);

      invalidateMasterDataCache();
      invalidateStockCache();
      return NextResponse.json({
        item: hasil.item,
        previous: hasil.previous,
        warning: peringatan.length > 0 ? peringatan.join(" ") : null,
        mirror: { status: mirrorStatus },
      });
    } catch (error) {
      return responsKesalahanMaster(error, "Gagal memperbarui material.");
    }
  }

  // ===== Jalur lama: Sheets primer =====
  try {
    const result = await updateMasterData(id, parsed.data);
    const peringatan: string[] = [];
    if (result.warning) peringatan.push(result.warning);

    if (getStockSource() === "postgres") {
      if (!result.previous) {
        peringatan.push(
          "Material tersimpan di spreadsheet, tetapi versi Apps Script belum mengirim data sebelumnya sehingga metadata stok lama belum ikut diperbarui."
        );
      } else {
        const { error: syncError } = await auth.supabase.rpc("sync_stock_master_item", {
          p_old_code: result.previous.material_number,
          p_old_name: result.previous.nama_barang,
          p_new_code: result.item.material_number,
          p_new_name: result.item.nama_barang,
          p_kategori: result.item.kategori,
          p_lokasi: result.item.lokasi,
          p_rack: result.item.rack,
          p_area: result.item.area,
        });
        if (syncError) {
          console.error("Sinkronisasi edit Master Data ke stock_ledger gagal", syncError);
          peringatan.push(
            syncError.code === "PGRST202"
              ? "Material tersimpan. Metadata pada riwayat stok belum ikut diperbarui karena migrasi 2026-08-09-master-data-rack.sql belum dijalankan di database."
              : `Material tersimpan, tetapi metadata pada riwayat stok belum tersinkron (${syncError.message}).`
          );
        }
      }
    }

    invalidateMasterDataCache();
    invalidateStockCache();
    return NextResponse.json({
      ...result,
      warning: peringatan.length > 0 ? peringatan.join(" ") : null,
    });
  } catch (error) {
    return sheetsErrorResponse(error, "Gagal memperbarui material.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let source;
  try {
    source = getMasterSource();
  } catch (error) {
    return responsKesalahanMaster(error, "Konfigurasi Master Data tidak valid.");
  }
  const postgres = source === "postgres";
  if (!(postgres ? ID_UUID.test(id) : ID_SHEETS.test(id))) {
    return NextResponse.json({ error: "ID material tidak valid." }, { status: 400 });
  }

  if (postgres) {
    try {
      const hasil = await deactivateMasterItem(id);
      const mirrorStatus = scheduleMasterMirror({
        operation: "deactivate",
        postgresId: hasil.item.id,
        item: hasil.item,
        previousMaterialNumber: hasil.previous?.material_number,
        sheetRow: hasil.sheetRow,
      });
      invalidateMasterDataCache();
      invalidateStockCache();
      return NextResponse.json({
        item: hasil.item,
        warning: masterMirrorWarning(mirrorStatus),
        mirror: { status: mirrorStatus },
      });
    } catch (error) {
      return responsKesalahanMaster(error, "Gagal menonaktifkan material.");
    }
  }

  try {
    const result = await deactivateMasterData(id);
    invalidateMasterDataCache();
    invalidateStockCache();
    return NextResponse.json(result);
  } catch (error) {
    return sheetsErrorResponse(error, "Gagal menonaktifkan material.");
  }
}
