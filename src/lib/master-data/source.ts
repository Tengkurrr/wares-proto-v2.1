import "server-only";

import type { MasterDataItem } from "@/lib/google-sheets/client";
import { getCachedMasterData } from "@/lib/google-sheets/master-cache";
import { inspectMasterSource } from "@/lib/master-data/config";
import type { MasterDataSource, StatusMaterial } from "@/lib/master-data-types";
import type { MasterDataValues } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

/** Sumber harus dipilih eksplisit; tidak ada fallback diam-diam. */
export type MasterSource = MasterDataSource;

export function getMasterSource(): MasterSource {
  const config = inspectMasterSource();
  if (config.ok) return config.source;

  throw new KesalahanMaster(
    "MASTER_SOURCE_NOT_CONFIGURED",
    config.reason === "MISSING"
      ? "Sumber Master Data belum dikonfigurasi. Set MASTER_SOURCE ke postgres atau sheets, lalu redeploy."
      : "Nilai MASTER_SOURCE tidak valid. Gunakan hanya postgres atau sheets, lalu redeploy.",
    { source: null, action: "CONFIGURE_MASTER_SOURCE" }
  );
}

/** Baris apa adanya dari tabel Postgres. */
type BarisMaster = {
  id: string;
  no: number;
  material_number: string;
  nama_barang: string;
  kategori: string;
  klasifikasi: string;
  lokasi: string;
  rack: number | null;
  area: string;
  satuan: string;
  status: StatusMaterial;
  sheet_row: number | null;
  sheet_sync_status: MasterSheetSyncStatus;
  sheet_sync_error: string | null;
  sheet_synced_at: string | null;
};

const KOLOM =
  "id, no, material_number, nama_barang, kategori, klasifikasi, lokasi, rack, area, satuan, status, sheet_row, sheet_sync_status, sheet_sync_error, sheet_synced_at";

function keMasterDataItem(baris: BarisMaster): MasterDataItem {
  return {
    id: baris.id,
    no: baris.no,
    kategori: baris.kategori,
    material_number: baris.material_number,
    rack: baris.rack,
    klasifikasi: baris.klasifikasi,
    area: baris.area,
    nama_barang: baris.nama_barang,
    lokasi: baris.lokasi,
    satuan: baris.satuan,
    status: baris.status,
  };
}

/**
 * Seluruh Master Data dari sumber aktif. Postgres dibaca per 1.000 baris karena
 * batas bawaan PostgREST. Katalog Postgres kosong sengaja dianggap belum siap,
 * bukan hasil sukses, agar backfill yang terlewat tidak menyamar sebagai 0 data.
 */
export async function readMasterData(): Promise<MasterDataItem[]> {
  const source = getMasterSource();
  if (source === "sheets") return getCachedMasterData();

  const supabase = await createClient();
  const UKURAN = 1000;
  const semua: BarisMaster[] = [];

  for (let mulai = 0; ; mulai += UKURAN) {
    const { data, error } = await supabase
      .from("master_items")
      .select(KOLOM)
      .order("no", { ascending: true })
      .order("id", { ascending: true })
      .range(mulai, mulai + UKURAN - 1);
    if (error) throw databaseError_(error, "membaca Master Data");
    const halaman = (data ?? []) as unknown as BarisMaster[];
    semua.push(...halaman);
    if (halaman.length < UKURAN) break;
  }

  if (semua.length === 0) {
    throw new KesalahanMaster(
      "MASTER_DATA_EMPTY",
      "Tabel master_items berhasil dibaca tetapi masih kosong. Jalankan backfill Master Data sebelum memakai sumber Postgres.",
      { source: "postgres", action: "RUN_MASTER_BACKFILL" }
    );
  }

  return semua.map(keMasterDataItem);
}

/** Satu material berdasarkan id Postgres. */
export async function readMasterItem(id: string): Promise<MasterDataItem | null> {
  assertPostgresSource_();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_items")
    .select(KOLOM)
    .eq("id", id)
    .maybeSingle();
  if (error) throw databaseError_(error, "membaca material");
  return data ? keMasterDataItem(data as unknown as BarisMaster) : null;
}

export type HasilTulisMaster = {
  item: MasterDataItem;
  previous: MasterDataItem | null;
  /** Baris di sheet MASTER DATA, dipakai mirror agar menimpa baris yang sama. */
  sheetRow: number | null;
};

/** Tambah material baru ke Postgres. */
export async function createMasterItem(nilai: MasterDataValues): Promise<HasilTulisMaster> {
  assertPostgresSource_();
  const supabase = await createClient();

  const { data: terakhir, error: readError } = await supabase
    .from("master_items")
    .select("no")
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle<{ no: number }>();
  if (readError) throw databaseError_(readError, "memeriksa nomor urut Master Data");
  if (!terakhir) {
    throw new KesalahanMaster(
      "MASTER_DATA_EMPTY",
      "Tabel master_items masih kosong. Jalankan backfill Master Data sebelum menambah material.",
      { source: "postgres", action: "RUN_MASTER_BACKFILL" }
    );
  }

  const { data, error } = await supabase
    .from("master_items")
    .insert({
      no: terakhir.no + 1,
      material_number: nilai.material_number,
      nama_barang: nilai.nama_barang,
      kategori: nilai.kategori,
      klasifikasi: nilai.klasifikasi,
      lokasi: nilai.lokasi,
      rack: nilai.rack,
      area: nilai.area,
      status: nilai.status,
      sheet_sync_status: "pending",
      sheet_sync_error: null,
    })
    .select(KOLOM)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new KesalahanMaster("DUPLICATE_MATERIAL", "Material number sudah dipakai material lain.");
    }
    throw databaseError_(error, "menambahkan material");
  }

  const baris = data as unknown as BarisMaster;
  return { item: keMasterDataItem(baris), previous: null, sheetRow: baris.sheet_row };
}

/** Perbarui material di Postgres; mengembalikan nilai sebelum & sesudah. */
export async function updateMasterItem(
  id: string,
  nilai: MasterDataValues
): Promise<HasilTulisMaster> {
  assertPostgresSource_();
  const supabase = await createClient();

  const sebelum = await readMasterItemBaris_(supabase, id);
  if (!sebelum) throw new KesalahanMaster("NOT_FOUND", "Material tidak ditemukan.");

  const { data, error } = await supabase
    .from("master_items")
    .update({
      material_number: nilai.material_number,
      nama_barang: nilai.nama_barang,
      kategori: nilai.kategori,
      klasifikasi: nilai.klasifikasi,
      lokasi: nilai.lokasi,
      rack: nilai.rack,
      area: nilai.area,
      status: nilai.status,
      sheet_sync_status: "pending",
      sheet_sync_error: null,
    })
    .eq("id", id)
    .select(KOLOM)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new KesalahanMaster("DUPLICATE_MATERIAL", "Material number sudah dipakai material lain.");
    }
    throw databaseError_(error, "memperbarui material");
  }

  const baris = data as unknown as BarisMaster;
  return {
    item: keMasterDataItem(baris),
    previous: keMasterDataItem(sebelum),
    sheetRow: baris.sheet_row,
  };
}

/** Nonaktifkan material tanpa menghapus baris historis. */
export async function deactivateMasterItem(id: string): Promise<HasilTulisMaster> {
  assertPostgresSource_();
  const supabase = await createClient();

  const sebelum = await readMasterItemBaris_(supabase, id);
  if (!sebelum) throw new KesalahanMaster("NOT_FOUND", "Material tidak ditemukan.");

  const { data, error } = await supabase
    .from("master_items")
    .update({ status: "NONAKTIF", sheet_sync_status: "pending", sheet_sync_error: null })
    .eq("id", id)
    .select(KOLOM)
    .single();
  if (error) throw databaseError_(error, "menonaktifkan material");

  const baris = data as unknown as BarisMaster;
  return {
    item: keMasterDataItem(baris),
    previous: keMasterDataItem(sebelum),
    sheetRow: baris.sheet_row,
  };
}

/**
 * Simpan baris dan satuan hasil mirror. Filter material_number mencegah callback
 * lama menautkan hasilnya bila material sudah diedit oleh request berikutnya.
 */
export async function linkMasterSheetMirror(
  id: string,
  materialNumber: string,
  sheetRow: number,
  satuan?: string
): Promise<boolean> {
  assertPostgresSource_();
  if (!Number.isInteger(sheetRow) || sheetRow < 1) return false;

  const supabase = await createClient();
  const values: {
    sheet_row: number;
    sheet_sync_status: "synced";
    sheet_sync_error: null;
    sheet_synced_at: string;
    satuan?: string;
  } = {
    sheet_row: sheetRow,
    sheet_sync_status: "synced",
    sheet_sync_error: null,
    sheet_synced_at: new Date().toISOString(),
  };
  if (typeof satuan === "string" && satuan.trim()) values.satuan = satuan.trim();

  const { data, error } = await supabase
    .from("master_items")
    .update(values)
    .eq("id", id)
    .eq("material_number", materialNumber)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw databaseError_(error, "menautkan baris mirror Master Data");
  return Boolean(data);
}

export type MasterSheetSyncStatus = "pending" | "synced" | "failed";

export type MasterMirrorState = {
  status: MasterSheetSyncStatus;
  error: string | null;
  syncedAt: string | null;
};

export async function readMasterMirrorState(id: string): Promise<MasterMirrorState | null> {
  assertPostgresSource_();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_items")
    .select("sheet_sync_status, sheet_sync_error, sheet_synced_at")
    .eq("id", id)
    .maybeSingle<{
      sheet_sync_status: MasterSheetSyncStatus;
      sheet_sync_error: string | null;
      sheet_synced_at: string | null;
    }>();
  if (error) throw databaseError_(error, "membaca status sinkronisasi spreadsheet");
  if (!data) return null;
  return {
    status: data.sheet_sync_status,
    error: data.sheet_sync_error,
    syncedAt: data.sheet_synced_at,
  };
}

/** Simpan kegagalan mirror hanya bila callback masih cocok dengan versi material. */
export async function markMasterSheetMirrorFailed(
  id: string,
  materialNumber: string,
  reason: string
): Promise<boolean> {
  assertPostgresSource_();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_items")
    .update({
      sheet_sync_status: "failed",
      sheet_sync_error: reason.slice(0, 500),
    })
    .eq("id", id)
    .eq("material_number", materialNumber)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw databaseError_(error, "menyimpan kegagalan sinkronisasi spreadsheet");
  return Boolean(data);
}

async function readMasterItemBaris_(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<BarisMaster | null> {
  const { data, error } = await supabase
    .from("master_items")
    .select(KOLOM)
    .eq("id", id)
    .maybeSingle();
  if (error) throw databaseError_(error, "membaca material");
  return (data as unknown as BarisMaster) ?? null;
}

export type MasterErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_MATERIAL"
  | "MASTER_SOURCE_NOT_CONFIGURED"
  | "MASTER_SCHEMA_NOT_READY"
  | "MASTER_ACCESS_DENIED"
  | "MASTER_DATA_EMPTY"
  | "DB_ERROR";

export type MasterDiagnostic = {
  source: MasterSource | null;
  action:
    | "CONFIGURE_MASTER_SOURCE"
    | "RUN_MASTER_MIGRATION"
    | "RUN_MASTER_BACKFILL"
    | "CHECK_MASTER_RLS"
    | "RETRY";
};

/** Kesalahan Master Data dengan diagnosis operasional stabil. */
export class KesalahanMaster extends Error {
  constructor(
    public readonly code: MasterErrorCode,
    message: string,
    public readonly diagnostics: MasterDiagnostic = { source: "postgres", action: "RETRY" },
    public readonly databaseCode?: string
  ) {
    super(message);
    this.name = "KesalahanMaster";
  }
}

function assertPostgresSource_() {
  const source = getMasterSource();
  if (source !== "postgres") {
    throw new KesalahanMaster(
      "MASTER_SOURCE_NOT_CONFIGURED",
      "Operasi Postgres Master Data dipanggil saat MASTER_SOURCE bukan postgres.",
      { source, action: "CONFIGURE_MASTER_SOURCE" }
    );
  }
}

type DatabaseErrorLike = { code?: string | null; message?: string | null };

/** Ubah variasi error Postgres/PostgREST menjadi kode diagnostik stabil. */
function databaseError_(error: DatabaseErrorLike, operation: string): KesalahanMaster {
  const databaseCode = String(error.code ?? "").toUpperCase();
  if (["42P01", "PGRST204", "PGRST205"].includes(databaseCode)) {
    return new KesalahanMaster(
      "MASTER_SCHEMA_NOT_READY",
      "Skema master_items belum tersedia atau belum sesuai. Jalankan migrasi Master Data lalu muat ulang schema cache Supabase.",
      { source: "postgres", action: "RUN_MASTER_MIGRATION" },
      databaseCode
    );
  }

  if (["42501", "PGRST301"].includes(databaseCode)) {
    return new KesalahanMaster(
      "MASTER_ACCESS_DENIED",
      "Database menolak akses ke master_items. Periksa migrasi RLS serta sesi pengguna.",
      { source: "postgres", action: "CHECK_MASTER_RLS" },
      databaseCode
    );
  }

  return new KesalahanMaster(
    "DB_ERROR",
    `Database gagal ${operation}.`,
    { source: "postgres", action: "RETRY" },
    databaseCode || undefined
  );
}
