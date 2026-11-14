import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncomingStatus, GoogleSheetsError } from "@/lib/google-sheets/client";
import { invalidateMasterDataCache } from "@/lib/google-sheets/master-cache";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const querySchema = z.string().trim().uuid("ID transaksi tidak valid.");

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 403 });
  }
  if (!profile.is_admin) {
    return NextResponse.json({ error: "Status input stok hanya dapat diperiksa admin." }, { status: 403 });
  }

  const transactionId = querySchema.safeParse(
    new URL(request.url).searchParams.get("transaction_id")
  );
  if (!transactionId.success) {
    return NextResponse.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }

  try {
    const confirmation = await getIncomingStatus(transactionId.data);
    if (confirmation.found) {
      invalidateMasterDataCache();
      invalidateStockCache();
      return NextResponse.json({
        ok: true,
        found: true,
        transactionId: transactionId.data,
        confirmation: confirmation.transaction,
        message: "Stok berhasil dicatat di Google Spreadsheet.",
      });
    }

    return NextResponse.json({
      ok: true,
      found: false,
      transactionId: transactionId.data,
      retryAfterMs: 3_000,
      message: "Google Spreadsheet masih memproses transaksi ini.",
    });
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return NextResponse.json(
        {
          ok: false,
          status: "unknown" as const,
          transactionId: transactionId.data,
          retryAfterMs: 5_000,
          error: error.message,
          code: error.code,
        },
        { status: 502 }
      );
    }
    console.error("GET /api/stock/input/status", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status input stok." },
      { status: 500 }
    );
  }
}
