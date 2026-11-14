import { after, NextResponse } from "next/server";

import {
  getOutgoingStatus,
  GoogleSheetsError,
  replaceOutgoing,
  type OutgoingRequestInput,
} from "@/lib/google-sheets/client";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { requestSchema } from "@/lib/schemas";
import { getStockSource } from "@/lib/stock/source";
import { createClient } from "@/lib/supabase/server";
import type { RequestRow } from "@/lib/types";
import {
  getSyncToken,
  isDefinitiveSheetsError,
  rpcItems,
  sheetsErrorHttpStatus,
  UUID_PATTERN,
} from "../_sync";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "ID permintaan tidak valid." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  }

  const { data: editor, error: editorError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (editorError || !editor?.is_admin) {
    return NextResponse.json(
      { error: "Hanya admin yang dapat mengubah permintaan." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data permintaan tidak valid." },
      { status: 400 }
    );
  }

  const syncToken = getSyncToken(request, id, parsed.data);
  if (!syncToken) {
    return NextResponse.json(
      { error: "X-Sync-Token harus berupa UUID yang valid." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle<RequestRow>();
  if (existingError) {
    return NextResponse.json({ error: "Gagal membaca permintaan." }, { status: 503 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
  }

  const values = parsed.data;
  const outgoing: OutgoingRequestInput = {
    requestId: existing.id,
    syncToken,
    actorId: user.id,
    operation: "edit",
    categories: values.kategori,
    date: existing.created_at,
    pekerjaan: values.pekerjaan,
    lokasiPekerjaan: values.lokasi,
    pic: values.nama_penerima,
    items: values.items.map((item) => ({
      catalogItemId: item.catalog_item_id,
      kodeBarang: item.kode_barang ?? undefined,
      namaBarang: item.nama_barang,
      kategori: item.kategori_barang || undefined,
      lokasi: item.lokasi_barang || undefined,
      satuan: item.satuan,
      jumlahPermintaan: item.jumlah_permintaan,
      jumlahDiberikan: item.jumlah_diberikan,
    })),
  };

  // Mode Postgres: perbarui langsung ke database (cepat, andal). Trigger menata
  // ulang KELUAR di stock_ledger. Sheets di-mirror di latar tanpa memblok respons.
  if (getStockSource() === "postgres") {
    const { data: savedId, error: saveError } = await supabase.rpc("update_request_transaction", {
      p_request_id: existing.id,
      p_pekerjaan: values.pekerjaan,
      p_lokasi_pekerjaan: values.lokasi,
      p_kategori: values.kategori,
      p_nama_penyerah: values.nama_penyerah,
      p_nama_penerima: values.nama_penerima,
      p_items: rpcItems(values),
    });

    if (saveError || !savedId) {
      return NextResponse.json(
        { error: saveError?.message || "Gagal memperbarui permintaan." },
        { status: 500 }
      );
    }

    after(async () => {
      try {
        await replaceOutgoing(outgoing);
      } catch (mirrorError) {
        console.warn("Mirror edit KELUAR ke Sheets gagal", {
          requestId: existing.id,
          error: mirrorError,
        });
      }
    });

    return NextResponse.json({
      id: savedId,
      requestId: existing.id,
      syncToken,
      syncStatus: "confirmed" as const,
    });
  }

  let sheetsConfirmed = false;
  try {
    await replaceOutgoing(outgoing);
    sheetsConfirmed = true;
  } catch (error) {
    if (isDefinitiveSheetsError(error)) {
      const sheetsError = error as GoogleSheetsError;
      return NextResponse.json(
        { error: sheetsError.message, code: sheetsError.code },
        { status: sheetsErrorHttpStatus(sheetsError) }
      );
    }

    // Versi lama tidak boleh dipulihkan saat hasil HTTP ambigu: transaksi baru
    // mungkin sudah durable dan rollback dapat menimpa edit admin lain.
    try {
      const confirmation = await getOutgoingStatus(existing.id, syncToken);
      sheetsConfirmed = confirmation.found;
    } catch (confirmationError) {
      console.warn("Konfirmasi edit permintaan belum tersedia", confirmationError);
    }

    if (!sheetsConfirmed) {
      return NextResponse.json(
        {
          ok: true,
          pending: true,
          syncStatus: "pending" as const,
          requestId: existing.id,
          syncToken,
          retryAfterMs: 3_000,
          message:
            "Perubahan masih diproses Google Spreadsheet. Data tidak dikirim ulang; status akan diperiksa.",
        },
        { status: 202 }
      );
    }
  }

  invalidateStockCache();
  const { data: savedId, error: saveError } = await supabase.rpc("update_request_transaction", {
    p_request_id: existing.id,
    p_pekerjaan: values.pekerjaan,
    p_lokasi_pekerjaan: values.lokasi,
    p_kategori: values.kategori,
    p_nama_penyerah: values.nama_penyerah,
    p_nama_penerima: values.nama_penerima,
    p_items: rpcItems(values),
  });

  if (saveError || !savedId) {
    console.warn("Supabase belum tersinkron setelah edit KELUAR", {
      requestId: existing.id,
      error: saveError?.message,
    });
    return NextResponse.json(
      {
        ok: true,
        pending: true,
        syncStatus: "pending_database" as const,
        requestId: existing.id,
        syncToken,
        retryAfterMs: 3_000,
        message: "Spreadsheet sudah diperbarui. Riwayat website sedang diselaraskan.",
      },
      { status: 202 }
    );
  }

  return NextResponse.json({
    id: savedId,
    requestId: existing.id,
    syncToken,
    syncStatus: "confirmed" as const,
  });
}
