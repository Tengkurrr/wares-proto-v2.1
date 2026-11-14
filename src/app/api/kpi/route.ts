import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { sheetsErrorResponse } from "@/lib/google-sheets/http-error";
import { ambilDataKpi } from "@/lib/kpi/source";

export const dynamic = "force-dynamic";

/** Data mentah Dashboard KPI. `?refresh=1` melewati cache 60 detik. */
export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const segar = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const data = await ambilDataKpi({ segar });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return sheetsErrorResponse(error, "Gagal memuat Dashboard KPI.");
  }
}
