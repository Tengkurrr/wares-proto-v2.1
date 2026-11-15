import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { isLocalMode } from "@/lib/local-mode";
import { CANONICAL_RACKS } from "@/lib/racks/canonical";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isLocalMode()) {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
  }

  // Mapping resmi hanya 50 baris dan sudah diverifikasi dari RACK GUDANG.xlsx.
  // Satu provider ini dipakai di semua mode agar dropdown tidak menunggu Apps
  // Script dan tidak berbeda dengan validasi saat formulir disimpan.
  return NextResponse.json(
    { items: CANONICAL_RACKS, meta: { source: "canonical" } },
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        "X-Wares-Rack-Source": "canonical",
      },
    }
  );
}
