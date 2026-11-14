import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { migrateLegacyMasterRacks } from "@/lib/google-sheets/client";
import { sheetsErrorResponse } from "@/lib/google-sheets/http-error";
import { invalidateMasterDataCache } from "@/lib/google-sheets/master-cache";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";

export const dynamic = "force-dynamic";

/** Utility satu-kali: hanya menormalkan label RACK 1..50 yang deterministik. */
export async function POST() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const result = await migrateLegacyMasterRacks();
    invalidateMasterDataCache();
    invalidateStockCache();
    return NextResponse.json(result);
  } catch (error) {
    return sheetsErrorResponse(error, "Gagal menormalisasi Rack legacy.");
  }
}
