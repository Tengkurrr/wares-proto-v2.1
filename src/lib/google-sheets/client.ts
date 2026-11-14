import "server-only";

export type StockItem = {
  kode_barang: string | null;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
  rack: number | null;
  area: string;
};

export type RackOption = {
  rack: number;
  area: string;
};

export type MasterDataStatus = "AKTIF" | "NONAKTIF";

export type MasterDataItem = {
  id: string;
  no: number;
  kategori: string;
  material_number: string;
  rack: number | null;
  klasifikasi: string;
  area: string;
  nama_barang: string;
  lokasi: string;
  status: MasterDataStatus;
  /** Kolom rumus dibaca untuk katalog stok, tetapi tidak pernah ditulis CRUD. */
  satuan?: string;
};

export type MasterDataInput = Omit<MasterDataItem, "id" | "no" | "satuan">;

export type StockSnapshot = {
  items: StockItem[];
  keterangan: string[];
  reportSheet: string;
  generatedAt: string;
};

export type IncomingStockInput = {
  transactionId?: string;
  tanggal: string;
  kode_barang?: string | null;
  nama_barang: string;
  kategori?: string;
  lokasi?: string;
  satuan?: string;
  rack: number;
  area: string;
  jumlah: number;
  keterangan: string;
};

export type IncomingStockResult = {
  ok: true;
  transactionId: string;
  reportSheet: string;
  stock: number;
};

export type IncomingStockStatus = {
  found: boolean;
  transactionId: string;
  transaction?: {
    tanggal: string;
    kode_barang: string;
    nama_barang: string;
    jumlah: number;
    keterangan: string;
    rack?: number | null;
    area?: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type OutgoingItemInput = {
  lineId?: string;
  catalogItemId?: number | null;
  kodeBarang?: string | null;
  namaBarang: string;
  kategori?: string;
  lokasi?: string;
  satuan?: string;
  jumlahPermintaan: number;
  jumlahDiberikan: number;
};

export type OutgoingRequestInput = {
  requestId: string;
  syncToken: string;
  actorId: string;
  operation: "create" | "edit";
  categories: string[];
  date?: string;
  pekerjaan: string;
  lokasiPekerjaan: string;
  pic: string;
  items: OutgoingItemInput[];
};

export type OutgoingResult = {
  ok: true;
  requestId: string;
  syncToken: string;
  recordedLines: number;
  reportSheet: string;
};

export type OutgoingStatus = {
  found: boolean;
  requestId: string;
  syncToken: string;
  recordedLines?: number;
  expectedLines?: number;
  transaction?: {
    actorId: string;
    operation: "create" | "edit";
    tanggal: string;
    occurredAt: string;
    pekerjaan: string;
    lokasiPekerjaan: string;
    pic: string;
    kategori: string[];
    items: Array<{
      lineId: string;
      catalogItemId: number | null;
      kodeBarang: string | null;
      kategori: string;
      lokasi: string;
      namaBarang: string;
      satuan: string;
      jumlahPermintaan: number;
      jumlahDiberikan: number;
    }>;
  };
};

type SheetsSuccess<T> = { ok: true; data: T };
type SheetsFailure = { ok: false; error?: { code?: string; message?: string } };

export class GoogleSheetsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleSheetsError";
    this.code = code;
  }
}

function config() {
  const url = process.env.GOOGLE_SHEETS_API_URL?.trim();
  const secret = process.env.GOOGLE_SHEETS_API_SECRET?.trim();
  if (!url || !secret) {
    throw new GoogleSheetsError(
      "NOT_CONFIGURED",
      "Integrasi Google Sheets belum dikonfigurasi pada server."
    );
  }
  return { url, secret };
}

/** Hanya status boolean; URL dan secret tidak pernah dikirim ke client. */
export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_API_URL?.trim() &&
      process.env.GOOGLE_SHEETS_API_SECRET?.trim()
  );
}

async function callSheets<T>(action: string, payload: unknown, timeoutMs = 30_000): Promise<T> {
  const { url, secret } = config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action, payload }),
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Google Sheets tidak merespons dalam ${Math.round(timeoutMs / 1000)} detik.`
      : "Google Sheets tidak dapat dihubungi.";
    throw new GoogleSheetsError("UPSTREAM_UNAVAILABLE", message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new GoogleSheetsError(
      "UPSTREAM_HTTP_ERROR",
      `Google Sheets mengembalikan HTTP ${response.status}.`
    );
  }

  let result: SheetsSuccess<T> | SheetsFailure;
  try {
    result = (await response.json()) as SheetsSuccess<T> | SheetsFailure;
  } catch {
    throw new GoogleSheetsError("INVALID_UPSTREAM_RESPONSE", "Respons Google Sheets bukan JSON yang valid.");
  }

  if (!result.ok) {
    throw new GoogleSheetsError(
      result.error?.code || "SHEETS_ERROR",
      result.error?.message || "Google Sheets gagal memproses transaksi."
    );
  }
  return result.data;
}

/**
 * Bentuk mentah sheet "Dashboard KPI". Sengaja berisi pembilang & penyebut,
 * bukan persentase jadi, supaya website menghitung dengan rumus yang sama
 * persis seperti panel kanan di spreadsheet.
 */
export type KpiSheetPayload = {
  months: Array<{ bulan: string; label: string; nilai: Record<string, number> }>;
  targets: Record<string, number>;
  sheetName: string;
  generatedAt: string;
};

export function getKpiData() {
  return callSheets<KpiSheetPayload>("kpi.get", {}, 15_000);
}

export function getStockSnapshot() {
  return callSheets<StockSnapshot>("stock.get", {});
}

export function getStockMetadata() {
  return callSheets<{ keterangan: string[] }>("metadata.get", {});
}

export function getMasterData() {
  return callSheets<{ items: MasterDataItem[] }>("master.list", {}, 15_000);
}

export function createMasterData(input: MasterDataInput) {
  return callSheets<{ item: MasterDataItem }>("master.create", input, 20_000);
}

export function updateMasterData(id: string, input: Partial<MasterDataInput>) {
  // `warning` terisi bila baris MASTER DATA berhasil disimpan tetapi penyelarasan
  // jurnal/laporan bulanan gagal — penyimpanannya tetap sah, jadi ini bukan error.
  return callSheets<{ item: MasterDataItem; previous: MasterDataItem; warning?: string | null }>(
    "master.update",
    { id, ...input },
    30_000
  );
}

export function deactivateMasterData(id: string) {
  return callSheets<{ item: MasterDataItem }>("master.deactivate", { id }, 15_000);
}

export function getRackOptions() {
  return callSheets<{ items: RackOption[] }>("rack.get", {}, 10_000);
}

export function migrateLegacyMasterRacks() {
  return callSheets<{ updated: number; unresolved: number }>(
    "master.migrate-racks",
    {},
    30_000
  );
}

export function recordIncoming(input: IncomingStockInput) {
  // Jurnal MASUK ditulis lebih dahulu. Setelah 20 detik, route beralih ke
  // konfirmasi read-only agar pengguna tidak menunggu pekerjaan laporan penuh.
  return callSheets<IncomingStockResult>("incoming.record", input, 20_000);
}

/** Fast, read-only confirmation that deliberately bypasses the Apps Script lock. */
export function getIncomingStatus(transactionId: string) {
  return callSheets<IncomingStockStatus>(
    "incoming.status",
    { transactionId },
    5_000
  );
}

/** Idempotent: retrying the same requestId replaces, rather than doubles, KELUAR. */
export function replaceOutgoing(input: OutgoingRequestInput) {
  // Jurnal ditulis dan di-flush sebelum pekerjaan laporan yang berat. Bila
  // respons belum tiba, route beralih ke outgoing.status tanpa menulis ulang.
  return callSheets<OutgoingResult>("outgoing.replace", input, 20_000);
}

/** Alias with the same idempotent semantics, convenient for create-request flows. */
export function recordOutgoing(input: OutgoingRequestInput) {
  return callSheets<OutgoingResult>("outgoing.record", input, 20_000);
}

/** Fast, read-only confirmation that deliberately bypasses Apps Script lock. */
export function getOutgoingStatus(requestId: string, syncToken?: string) {
  return callSheets<OutgoingStatus>(
    "outgoing.status",
    { requestId, syncToken },
    5_000
  );
}
