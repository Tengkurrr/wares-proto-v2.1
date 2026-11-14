import { NextResponse } from "next/server";

import { GoogleSheetsError } from "@/lib/google-sheets/client";
import { readStockSnapshot } from "@/lib/stock/source";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });

  try {
    // Sumber stok mengikuti flag STOCK_SOURCE: Postgres (kilat) atau cache Sheets.
    const snapshot = await readStockSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
    });
  } catch (error) {
    return sheetsErrorResponse(error);
  }
}

function sheetsErrorResponse(error: unknown) {
  if (error instanceof GoogleSheetsError) {
    const status = error.code === "NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("GET /api/stock", error);
  return NextResponse.json({ error: "Gagal membaca stok." }, { status: 500 });
}
