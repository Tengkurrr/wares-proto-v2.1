import { after, NextResponse } from "next/server";
import { z } from "zod";

import {
  getIncomingStatus,
  GoogleSheetsError,
  recordIncoming,
} from "@/lib/google-sheets/client";
import { invalidateMasterDataCache } from "@/lib/google-sheets/master-cache";
import { invalidateStockCache } from "@/lib/google-sheets/stock-cache";
import { CANONICAL_RACKS } from "@/lib/racks/canonical";
import { getStockSource } from "@/lib/stock/source";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const strictDate = z.string().trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;
  }, "Tanggal tidak valid.");

const inputStockSchema = z.object({
  transaction_id: z.string().trim().uuid("ID transaksi tidak valid.").optional(),
  tanggal: strictDate,
  kode_barang: z.string().trim().max(100).nullable().optional(),
  nama_barang: z.string().trim().min(1).max(200),
  kategori: z.string().trim().max(120).optional().default(""),
  lokasi: z.string().trim().max(120).optional().default(""),
  satuan: z.string().trim().max(40).optional().default(""),
  rack: z.preprocess(
    (value) => (value === "" || value == null ? Number.NaN : value),
    z.coerce.number().int("Rack harus berupa angka bulat.").positive("Rack wajib dipilih.").max(1_000_000)
  ),
  area: z.string().trim().min(1, "Area wajib dipilih.").max(120),
  jumlah: z.coerce.number().int().positive().max(1_000_000_000),
  keterangan: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 403 });
  }
  if (!profile.is_admin) {
    return NextResponse.json({ error: "Input stok hanya dapat dilakukan admin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const parsed = inputStockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data input stok tidak valid.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const transactionId = parsed.data.transaction_id || crypto.randomUUID();
  const stockSource = getStockSource();
  let data = parsed.data;
  const selected = CANONICAL_RACKS.find((item) => item.rack === parsed.data.rack);
  if (!selected) {
    return NextResponse.json(
      { error: "Nomor rack wajib dipilih dari daftar RACK GUDANG." },
      { status: 400 }
    );
  }
  const canonicalArea = CANONICAL_RACKS.find(
    (item) => item.area.trim().toLocaleUpperCase("id-ID") === parsed.data.area.trim().toLocaleUpperCase("id-ID")
  )?.area;
  if (!canonicalArea) {
    return NextResponse.json(
      { error: "Area wajib dipilih dari daftar RACK GUDANG." },
      { status: 400 }
    );
  }
  data = { ...parsed.data, area: canonicalArea };

  // Mode Postgres: stok ditulis ke jurnal database (cepat, tanpa lock Apps Script),
  // Sheets diperbarui sebagai mirror di latar agar laporan bulanan tetap terisi.
  if (stockSource === "postgres") {
    const p = data;
    const { data: rpcData, error: rpcError } = await supabase.rpc("record_stock_incoming", {
      p_transaction_id: transactionId,
      p_tanggal: p.tanggal,
      p_kode_barang: p.kode_barang ?? null,
      p_nama_barang: p.nama_barang,
      p_kategori: p.kategori,
      p_lokasi: p.lokasi,
      p_satuan: p.satuan,
      p_rack: p.rack,
      p_area: p.area,
      p_jumlah: p.jumlah,
      p_keterangan: p.keterangan,
    });
    // Jangan jatuh ke RPC lama: RPC tersebut tidak menyimpan Rack/Area dan akan
    // membuat UI melaporkan sukses padahal lokasi penempatan hilang.
    if (rpcError?.code === "PGRST202") {
      return NextResponse.json(
        {
          error:
            "Database Input Stok belum mendukung Rack/Area. Jalankan migrasi 2026-08-09-master-data-rack.sql sebelum mencoba lagi.",
          code: "STOCK_RACK_MIGRATION_REQUIRED",
        },
        { status: 503 }
      );
    }
    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message || "Gagal menyimpan stok masuk." },
        { status: 400 }
      );
    }

    after(async () => {
      try {
        await recordIncoming({
          transactionId,
          tanggal: p.tanggal,
          kode_barang: p.kode_barang,
          nama_barang: p.nama_barang,
          kategori: p.kategori,
          lokasi: p.lokasi,
          satuan: p.satuan,
          rack: p.rack,
          area: p.area,
          jumlah: p.jumlah,
          keterangan: p.keterangan,
        });
        invalidateMasterDataCache();
      } catch (mirrorError) {
        // Jurnal Postgres tetap jadi sumber kebenaran; mirror Sheets best-effort.
        console.warn("Mirror input stok ke Sheets gagal", { transactionId, error: mirrorError });
      }
    });

    const hasil = (rpcData ?? {}) as { stock?: number };
    return NextResponse.json({
      ok: true,
      status: "confirmed" as const,
      transactionId,
      stock: hasil.stock ?? 0,
    });
  }

  try {
    const result = await recordIncoming({
      transactionId,
      tanggal: data.tanggal,
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      kategori: data.kategori,
      lokasi: data.lokasi,
      satuan: data.satuan,
      rack: data.rack,
      area: data.area,
      jumlah: data.jumlah,
      keterangan: data.keterangan,
    });
    // Stok MASUK bertambah — segarkan cache agar info stok langsung terbaru.
    invalidateMasterDataCache();
    invalidateStockCache();
    return NextResponse.json({ ...result, status: "confirmed" as const });
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      const definitive = new Set([
        "INVALID_INPUT",
        "INVALID_DATE",
        "INVALID_QUANTITY",
        "INVALID_RACK",
        "INVALID_AREA",
        "NOT_CONFIGURED",
        "UNAUTHORIZED",
      ]).has(error.code);
      if (!definitive) {
        // Jangan kirim ulang incoming.record: transaksi pertama mungkin sudah
        // tertulis. Konfirmasi ID yang sama lewat endpoint baca tanpa lock.
        try {
          const confirmation = await getIncomingStatus(transactionId);
          if (confirmation.found) {
            invalidateMasterDataCache();
            invalidateStockCache();
            return NextResponse.json({
              ok: true,
              status: "confirmed" as const,
              transactionId,
              verifiedAfterTimeout: true,
              confirmation: confirmation.transaction,
              message: "Stok berhasil dicatat di Google Spreadsheet.",
            });
          }
        } catch (confirmationError) {
          console.warn("Konfirmasi input stok belum tersedia", confirmationError);
        }

        return NextResponse.json(
          {
            ok: true,
            pending: true,
            status: "pending" as const,
            transactionId,
            retryAfterMs: 3_000,
            message:
              "Transaksi masih diproses oleh Google Spreadsheet. Jangan kirim ulang; status akan diperiksa otomatis.",
          },
          { status: 202 }
        );
      }
      const status = ["INVALID_INPUT", "INVALID_DATE", "INVALID_QUANTITY", "INVALID_RACK", "INVALID_AREA"].includes(error.code)
        ? 400
        : error.code === "LOCK_TIMEOUT" || error.code === "NOT_CONFIGURED"
          ? 503
          : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("POST /api/stock/input", error);
    return NextResponse.json({ error: "Gagal menyimpan stok masuk." }, { status: 500 });
  }
}
