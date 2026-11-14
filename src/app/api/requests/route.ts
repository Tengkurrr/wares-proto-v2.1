import { randomUUID } from "crypto";
import { after, NextResponse } from "next/server";

import {
  getOutgoingStatus,
  GoogleSheetsError,
  recordOutgoing,
  type OutgoingRequestInput,
} from "@/lib/google-sheets/client";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { requestSchema } from "@/lib/schemas";
import { getStockSource } from "@/lib/stock/source";
import { createClient } from "@/lib/supabase/server";
import {
  getSyncToken,
  isDefinitiveSheetsError,
  rpcItems,
  sheetsErrorHttpStatus,
  UUID_PATTERN,
} from "./_sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  }

  const headerKey = request.headers.get("Idempotency-Key")?.trim();
  if (headerKey && !UUID_PATTERN.test(headerKey)) {
    return NextResponse.json(
      { error: "Idempotency-Key harus berupa UUID yang valid." },
      { status: 400 }
    );
  }
  const requestId = headerKey ?? randomUUID();

  // Retry dengan kunci yang sudah selesai tidak boleh menyentuh Sheets lagi.
  const { data: existing, error: existingError } = await supabase
    .from("requests")
    .select("id, user_id")
    .eq("id", requestId)
    .maybeSingle<{ id: string; user_id: string }>();
  if (existingError) {
    return NextResponse.json({ error: "Gagal memeriksa kunci idempotensi." }, { status: 503 });
  }
  if (existing) {
    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "Idempotency-Key sudah digunakan oleh permintaan lain." },
        { status: 409 }
      );
    }
    const existingSyncToken = request.headers.get("X-Sync-Token")?.trim();
    return NextResponse.json({
      id: existing.id,
      requestId: existing.id,
      syncToken: existingSyncToken && UUID_PATTERN.test(existingSyncToken)
        ? existingSyncToken
        : undefined,
      syncStatus: "confirmed" as const,
    });
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

  const syncToken = getSyncToken(request, requestId, parsed.data);
  if (!syncToken) {
    return NextResponse.json(
      { error: "X-Sync-Token harus berupa UUID yang valid." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle<{ id: string }>();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 403 });
  }

  const values = parsed.data;
  // Satu timestamp dipakai oleh jurnal Sheets dan Supabase agar transaksi di
  // batas pergantian hari/bulan tidak masuk ke periode yang berbeda.
  const occurredAt = new Date().toISOString();
  const outgoing: OutgoingRequestInput = {
    requestId,
    syncToken,
    actorId: user.id,
    operation: "create",
    categories: values.kategori,
    date: occurredAt,
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

  // Mode Postgres: simpan langsung ke database (cepat, andal). Trigger menulis
  // KELUAR ke stock_ledger, jadi stok langsung akurat. Sheets di-mirror di latar
  // agar laporan bulanan tetap terisi — tanpa memblok respons pengguna.
  if (getStockSource() === "postgres") {
    const { data: savedId, error: saveError } = await supabase.rpc("create_request_transaction", {
      p_request_id: requestId,
      p_pekerjaan: values.pekerjaan,
      p_lokasi_pekerjaan: values.lokasi,
      p_kategori: values.kategori,
      p_nama_penyerah: values.nama_penyerah,
      p_nama_penerima: values.nama_penerima,
      p_items: rpcItems(values),
      p_created_at: occurredAt,
    });

    if (saveError || !savedId) {
      // RPC idempoten: requestId ganda milik user yang sama dianggap sukses.
      const { data: committed } = await supabase
        .from("requests")
        .select("id, user_id")
        .eq("id", requestId)
        .maybeSingle<{ id: string; user_id: string }>();
      if (committed?.user_id === user.id) {
        return NextResponse.json(
          { id: committed.id, requestId, syncToken, syncStatus: "confirmed" as const },
          { status: 201 }
        );
      }
      return NextResponse.json(
        { error: saveError?.message || "Gagal menyimpan permintaan." },
        { status: 500 }
      );
    }

    after(async () => {
      try {
        await recordOutgoing(outgoing);
      } catch (mirrorError) {
        // Jurnal Postgres tetap sumber kebenaran; mirror Sheets best-effort.
        console.warn("Mirror KELUAR ke Sheets gagal", { requestId, error: mirrorError });
      }
    });

    return NextResponse.json(
      { id: savedId, requestId, syncToken, syncStatus: "confirmed" as const },
      { status: 201 }
    );
  }

  let sheetsConfirmed = false;
  try {
    await recordOutgoing(outgoing);
    sheetsConfirmed = true;
  } catch (error) {
    if (isDefinitiveSheetsError(error)) {
      const sheetsError = error as GoogleSheetsError;
      return NextResponse.json(
        { error: sheetsError.message, code: sheetsError.code },
        { status: sheetsErrorHttpStatus(sheetsError) }
      );
    }

    // Jangan rollback atau kirim ulang KELUAR: respons dapat terputus setelah
    // jurnal selesai ditulis. Konfirmasi versi yang sama secara read-only.
    try {
      const confirmation = await getOutgoingStatus(requestId, syncToken);
      sheetsConfirmed = confirmation.found;
    } catch (confirmationError) {
      console.warn("Konfirmasi permintaan belum tersedia", confirmationError);
    }

    if (!sheetsConfirmed) {
      return NextResponse.json(
        {
          ok: true,
          pending: true,
          syncStatus: "pending" as const,
          requestId,
          syncToken,
          retryAfterMs: 3_000,
          message:
            "Permintaan masih diproses Google Spreadsheet. Data tidak dikirim ulang; status akan diperiksa.",
        },
        { status: 202 }
      );
    }
  }

  invalidateStockCache();
  const { data: savedId, error: saveError } = await supabase.rpc("create_request_transaction", {
    p_request_id: requestId,
    p_pekerjaan: values.pekerjaan,
    p_lokasi_pekerjaan: values.lokasi,
    p_kategori: values.kategori,
    p_nama_penyerah: values.nama_penyerah,
    p_nama_penerima: values.nama_penerima,
    p_items: rpcItems(values),
    p_created_at: occurredAt,
  });

  if (saveError || !savedId) {
    // PostgREST bisa kehilangan respons setelah commit. Konfirmasi dahulu; bila
    // belum ada, endpoint sync-status dapat menyelesaikan DB dari jurnal teknis.
    const { data: committed, error: confirmError } = await supabase
      .from("requests")
      .select("id, user_id")
      .eq("id", requestId)
      .maybeSingle<{ id: string; user_id: string }>();
    if (committed?.user_id === user.id) {
      return NextResponse.json(
        { id: committed.id, requestId, syncToken, syncStatus: "confirmed" as const },
        { status: 201 }
      );
    }
    if (committed && committed.user_id !== user.id) {
      return NextResponse.json(
        { error: "Idempotency-Key sudah digunakan oleh permintaan lain." },
        { status: 409 }
      );
    }

    console.warn("Supabase belum terkonfirmasi setelah jurnal KELUAR tersimpan", {
      requestId,
      error: saveError?.message,
      confirmError: confirmError?.message,
    });
    return NextResponse.json(
      {
        ok: true,
        pending: true,
        syncStatus: "pending_database" as const,
        requestId,
        syncToken,
        retryAfterMs: 3_000,
        message: "Spreadsheet sudah tercatat. Penyimpanan riwayat website sedang diselesaikan.",
      },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { id: savedId, requestId, syncToken, syncStatus: "confirmed" as const },
    { status: 201 }
  );
}
