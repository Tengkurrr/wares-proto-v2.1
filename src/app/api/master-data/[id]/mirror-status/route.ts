import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-admin";
import { responsKesalahanMaster } from "@/lib/master-data/http-error";
import { readMasterMirrorState } from "@/lib/master-data/source";

export const dynamic = "force-dynamic";

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!ID_UUID.test(id)) {
    return NextResponse.json({ error: "ID material tidak valid." }, { status: 400 });
  }

  try {
    const mirror = await readMasterMirrorState(id);
    if (!mirror) {
      return NextResponse.json({ error: "Material tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json(
      { mirror },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    return responsKesalahanMaster(error, "Gagal membaca status sinkronisasi spreadsheet.");
  }
}
