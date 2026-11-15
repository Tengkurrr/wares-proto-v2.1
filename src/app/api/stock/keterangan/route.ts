import { NextResponse } from "next/server";

import { GoogleSheetsError } from "@/lib/google-sheets/client";
import { isLocalMode } from "@/lib/local-mode";
import { readStockKeterangan } from "@/lib/stock/source";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isLocalMode()) {
    return NextResponse.json({ keterangan: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Akses hanya untuk admin." }, { status: 403 });
  }

  try {
    return NextResponse.json(await readStockKeterangan(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    console.error("GET /api/stock/keterangan", error);
    return NextResponse.json({ error: "Gagal membaca pilihan keterangan." }, { status: 500 });
  }
}
