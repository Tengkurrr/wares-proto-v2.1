import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { isLocalMode } from "@/lib/local-mode";
import { localMasterItems } from "@/lib/local/fixtures";
import { createMasterData } from "@/lib/google-sheets/client";
import { sheetsErrorResponse } from "@/lib/google-sheets/http-error";
import { invalidateMasterDataCache } from "@/lib/google-sheets/master-cache";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { responsKesalahanMaster } from "@/lib/master-data/http-error";
import {
  masterMirrorConfigured,
  masterMirrorWarning,
  scheduleMasterMirror,
} from "@/lib/master-data/mirror";
import {
  createMasterItem,
  getMasterSource,
  KesalahanMaster,
  readMasterData,
} from "@/lib/master-data/source";
import { canonicalRackSelection } from "@/lib/racks/canonical";
import { masterDataSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  // Mode lokal: Master Data 99 item dari fixture, tanpa Supabase/Apps Script.
  if (isLocalMode()) {
    return NextResponse.json(
      {
        items: localMasterItems(),
        meta: { source: "lokal", count: localMasterItems().length, sheetsMirrorConfigured: false },
      },
      { headers: { "Cache-Control": "no-store", "X-Wares-Master-Source": "lokal" } }
    );
  }

  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  let source;
  try {
    source = getMasterSource();
  } catch (error) {
    return responsKesalahanMaster(error, "Konfigurasi Master Data tidak valid.");
  }

  try {
    const items = await readMasterData();
    return NextResponse.json(
      {
        items,
        meta: {
          source,
          count: items.length,
          sheetsMirrorConfigured: masterMirrorConfigured(),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Wares-Master-Source": source,
        },
      }
    );
  } catch (error) {
    if (error instanceof KesalahanMaster) {
      return responsKesalahanMaster(error, "Gagal membaca Master Data.");
    }
    if (source === "sheets") return sheetsErrorResponse(error, "Gagal membaca Master Data.");
    return responsKesalahanMaster(
      new KesalahanMaster(
        "DB_ERROR",
        "Database Master Data tidak dapat dihubungi.",
        { source: "postgres", action: "RETRY" }
      ),
      "Gagal membaca Master Data."
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }
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

  let source;
  try {
    source = getMasterSource();
  } catch (error) {
    return responsKesalahanMaster(error, "Konfigurasi Master Data tidak valid.");
  }

  if (source === "postgres") {
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
      const hasil = await createMasterItem(nilai);
      const mirrorStatus = scheduleMasterMirror({
        operation: "create",
        postgresId: hasil.item.id,
        item: hasil.item,
        sheetRow: hasil.sheetRow,
      });

      invalidateMasterDataCache();
      invalidateStockCache();
      return NextResponse.json(
        {
          item: hasil.item,
          warning: masterMirrorWarning(mirrorStatus),
          mirror: { status: mirrorStatus },
        },
        { status: 201, headers: { "X-Wares-Master-Source": source } }
      );
    } catch (error) {
      return responsKesalahanMaster(error, "Gagal menambahkan material.");
    }
  }

  try {
    const result = await createMasterData(parsed.data);
    invalidateMasterDataCache();
    invalidateStockCache();
    return NextResponse.json(result, {
      status: 201,
      headers: { "X-Wares-Master-Source": source },
    });
  } catch (error) {
    return sheetsErrorResponse(error, "Gagal menambahkan material.");
  }
}
