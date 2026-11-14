import { NextResponse } from "next/server";

import {
  getOutgoingStatus,
  GoogleSheetsError,
} from "@/lib/google-sheets/client";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { requestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  rpcItems,
  SYNC_TOKEN_PATTERN,
  UUID_PATTERN,
} from "../_sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const requestId = params.get("request_id")?.trim() || "";
  const syncToken = params.get("sync_token")?.trim() || "";
  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "ID permintaan tidak valid." }, { status: 400 });
  }
  if (!SYNC_TOKEN_PATTERN.test(syncToken)) {
    return NextResponse.json({ error: "Token sinkronisasi tidak valid." }, { status: 400 });
  }

  let confirmation;
  try {
    confirmation = await getOutgoingStatus(requestId, syncToken);
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return NextResponse.json(
        {
          ok: false,
          found: false,
          databaseSaved: false,
          syncStatus: "unknown" as const,
          requestId,
          syncToken,
          retryAfterMs: 5_000,
          error: error.message,
          code: error.code,
        },
        { status: 502 }
      );
    }
    console.error("GET /api/requests/sync-status", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status permintaan." },
      { status: 500 }
    );
  }

  if (!confirmation.found || !confirmation.transaction) {
    return NextResponse.json({
      ok: true,
      found: false,
      databaseSaved: false,
      syncStatus: "pending" as const,
      requestId,
      syncToken,
      recordedLines: confirmation.recordedLines ?? 0,
      expectedLines: confirmation.expectedLines,
      retryAfterMs: 3_000,
      message: "Google Spreadsheet masih memproses versi permintaan ini.",
    });
  }

  const transaction = confirmation.transaction;
  if (transaction.actorId !== user.id) {
    // requestId sulit ditebak, tetapi actor marker tetap mencegah pengguna lain
    // merekonstruksi data permintaan pending dari KELUAR.
    return NextResponse.json({ error: "Status transaksi ini bukan milik akun Anda." }, { status: 403 });
  }

  // Jurnal Google Sheets hanya menyimpan `pic` (= penerima), tidak menyimpan nama
  // PENYERAH. Pemulihan karena itu memakai sumber terbaik yang tersedia: nama
  // penyerah yang sudah tercatat di database untuk operasi edit, atau nama pemilik
  // akun untuk permintaan baru. Jalur ini hanya aktif pada mode Sheets.
  const { data: profilAktor } = await supabase
    .from("profiles")
    .select("nama_lengkap, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ nama_lengkap: string; is_admin: boolean }>();

  let namaPenyerahPemulihan = (profilAktor?.nama_lengkap ?? "").trim();
  if (transaction.operation === "edit") {
    const { data: barisTersimpan } = await supabase
      .from("requests")
      .select("nama_penyerah")
      .eq("id", requestId)
      .maybeSingle<{ nama_penyerah: string }>();
    const tersimpan = (barisTersimpan?.nama_penyerah ?? "").trim();
    if (tersimpan.length >= 2) namaPenyerahPemulihan = tersimpan;
  }
  if (namaPenyerahPemulihan.length < 2) namaPenyerahPemulihan = "Tidak diketahui";

  const parsed = requestSchema.safeParse({
    kategori: transaction.kategori,
    pekerjaan: transaction.pekerjaan,
    lokasi: transaction.lokasiPekerjaan,
    nama_penyerah: namaPenyerahPemulihan,
    nama_penerima: transaction.pic,
    items: transaction.items.map((item) => ({
      catalog_item_id: item.catalogItemId,
      kode_barang: item.kodeBarang,
      kategori_barang: item.kategori,
      lokasi_barang: item.lokasi,
      nama_barang: item.namaBarang,
      satuan: item.satuan,
      // Nilai ini hanya dibutuhkan schema UI dan tidak disimpan ke database.
      stok_tersedia: Math.max(0, item.jumlahDiberikan),
      jumlah_permintaan: item.jumlahPermintaan,
      jumlah_diberikan: item.jumlahDiberikan,
    })),
  });
  if (!parsed.success) {
    console.error("Payload jurnal KELUAR tidak dapat direkonstruksi", {
      requestId,
      issues: parsed.error.issues,
    });
    return NextResponse.json({
      ok: false,
      found: true,
      databaseSaved: false,
      syncStatus: "database_error" as const,
      requestId,
      syncToken,
      error: "Spreadsheet tercatat, tetapi data teknisnya tidak lengkap. Hubungi admin.",
    });
  }

  const values = parsed.data;
  let savedId: string | null = null;
  let saveError: { message: string } | null = null;

  if (transaction.operation === "edit") {
    if (!profilAktor?.is_admin) {
      return NextResponse.json({ error: "Hanya admin yang dapat menyelesaikan edit." }, { status: 403 });
    }
    const result = await supabase.rpc("update_request_transaction", {
      p_request_id: requestId,
      p_pekerjaan: values.pekerjaan,
      p_lokasi_pekerjaan: values.lokasi,
      p_kategori: values.kategori,
      p_nama_penyerah: values.nama_penyerah,
      p_nama_penerima: values.nama_penerima,
      p_items: rpcItems(values),
    });
    savedId = result.data as string | null;
    saveError = result.error;
  } else {
    const { data: existing, error: existingError } = await supabase
      .from("requests")
      .select("id, user_id")
      .eq("id", requestId)
      .maybeSingle<{ id: string; user_id: string }>();
    if (existing?.user_id === user.id) {
      savedId = existing.id;
    } else if (existing || existingError) {
      saveError = {
        message: existing
          ? "ID permintaan sudah dimiliki akun lain."
          : "Gagal memeriksa riwayat website.",
      };
    } else {
      const result = await supabase.rpc("create_request_transaction", {
        p_request_id: requestId,
        p_pekerjaan: values.pekerjaan,
        p_lokasi_pekerjaan: values.lokasi,
        p_kategori: values.kategori,
        p_nama_penyerah: values.nama_penyerah,
        p_nama_penerima: values.nama_penerima,
        p_items: rpcItems(values),
        p_created_at: transaction.occurredAt || transaction.tanggal,
      });
      savedId = result.data as string | null;
      saveError = result.error;
    }
  }

  if (saveError || !savedId) {
    console.error("Gagal menyelesaikan sinkronisasi Supabase", {
      requestId,
      error: saveError?.message,
    });
    return NextResponse.json({
      ok: false,
      found: true,
      databaseSaved: false,
      syncStatus: "database_error" as const,
      requestId,
      syncToken,
      retryAfterMs: 5_000,
      error: "Spreadsheet sudah tercatat, tetapi riwayat website belum tersimpan. Coba periksa lagi.",
    });
  }

  invalidateStockCache();
  return NextResponse.json({
    ok: true,
    found: true,
    databaseSaved: true,
    syncStatus: "confirmed" as const,
    id: savedId,
    requestId,
    syncToken,
    message: transaction.operation === "edit"
      ? "Perubahan permintaan berhasil disimpan."
      : "Permintaan berhasil disimpan.",
  });
}
