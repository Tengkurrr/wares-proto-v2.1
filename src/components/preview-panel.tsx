"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";

import { SuratRingkasan } from "@/components/surat-ringkasan";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { RequestValues } from "@/lib/schemas";
import type { SuratData } from "@/lib/types";
import { tanggalIndonesia } from "@/lib/utils";

type SaveResponse = {
  id?: string;
  requestId?: string;
  syncToken?: string;
  pending?: boolean;
  syncStatus?: SyncStatus;
  retryAfterMs?: number;
  message?: string;
  error?: string;
};

type StatusResponse = {
  id?: string;
  requestId?: string;
  syncToken?: string;
  found?: boolean;
  databaseSaved?: boolean;
  syncStatus?: SyncStatus;
  retryAfterMs?: number;
  error?: string;
};

type PendingOperation = {
  requestId: string;
  syncToken: string;
  retryAfterMs: number;
};

type SyncStatus =
  | "confirmed"
  | "pending"
  | "pending_database"
  | "unknown"
  | "database_error";

export type PendingRequestRecovery = {
  version: 1;
  actorId: string;
  mode: "create" | "edit";
  requestId: string;
  syncToken: string;
  resourceId?: string;
  payload: RequestValues;
  expiresAt: number;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "submitting"; requestId: string }
  | { kind: "checking"; requestId: string }
  | { kind: "recovering"; requestId: string }
  | { kind: "uncertain"; requestId: string }
  | { kind: "database_error"; requestId: string }
  | { kind: "success"; message: string }
  | { kind: "failure"; message: string };

const STATUS_POLL_WINDOW_MS = 75_000;
const STATUS_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_AFTER_MS = 3_000;
const PENDING_TTL_MS = 24 * 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storageKey(actorId: string, resourceId?: string) {
  const actor = encodeURIComponent(actorId);
  return resourceId
    ? `wares:pending-request:${actor}:edit:${resourceId}`
    : `wares:pending-request:${actor}:create`;
}

export function bacaOperasiPermintaanTertunda(
  actorId: string,
  resourceId?: string
): PendingRequestRecovery | null {
  if (typeof window === "undefined") return null;
  const key = storageKey(actorId, resourceId);

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const nilai = JSON.parse(raw) as Partial<PendingRequestRecovery>;
    const modeSesuai = resourceId
      ? nilai.mode === "edit" && nilai.resourceId === resourceId
      : nilai.mode === "create" && !nilai.resourceId;
    if (
      nilai.version !== 1 ||
      nilai.actorId !== actorId ||
      !modeSesuai ||
      typeof nilai.expiresAt !== "number" ||
      nilai.expiresAt <= Date.now() ||
      typeof nilai.requestId !== "string" ||
      !UUID_PATTERN.test(nilai.requestId) ||
      typeof nilai.syncToken !== "string" ||
      !UUID_PATTERN.test(nilai.syncToken) ||
      !nilai.payload
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return nilai as PendingRequestRecovery;
  } catch {
    return null;
  }
}

function simpanOperasiPermintaanTertunda(record: PendingRequestRecovery) {
  try {
    window.localStorage.setItem(
      storageKey(record.actorId, record.resourceId),
      JSON.stringify({ ...record, expiresAt: Date.now() + PENDING_TTL_MS })
    );
  } catch {
    // Penyimpanan browser hanya lapisan pemulihan. ID dalam tab aktif tetap aman.
  }
}

export function hapusOperasiPermintaanTertunda(actorId: string, resourceId?: string) {
  try {
    window.localStorage.removeItem(storageKey(actorId, resourceId));
  } catch {
    // Tidak menggagalkan penyelesaian transaksi bila storage browser dibatasi.
  }
}

function retryDelay(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(10_000, Math.max(1_000, value));
}

export function PreviewPanel({
  data,
  requestId,
  tanggal,
  actorId,
  operasiDipulihkan,
  onKembali,
  onBuangPemulihan,
}: {
  data: RequestValues;
  requestId?: string;
  tanggal?: string;
  actorId: string;
  operasiDipulihkan?: PendingRequestRecovery;
  onKembali: () => void;
  /** Buang transaksi tertunda yang macet, bersihkan penyimpanan pemulihan, kembali ke form. */
  onBuangPemulihan?: () => void;
}) {
  const router = useRouter();
  const [dikonfirmasi, setDikonfirmasi] = useState(Boolean(operasiDipulihkan));
  const [saveState, setSaveState] = useState<SaveState>(
    operasiDipulihkan
      ? { kind: "recovering", requestId: operasiDipulihkan.requestId }
      : { kind: "idle" }
  );
  const createRequestIdRef = useRef<string | null>(
    operasiDipulihkan?.mode === "create" ? operasiDipulihkan.requestId : null
  );
  const syncTokenRef = useRef<string | null>(operasiDipulihkan?.syncToken ?? null);
  const pendingOperationRef = useRef<PendingOperation | null>(
    operasiDipulihkan
      ? {
          requestId: operasiDipulihkan.requestId,
          syncToken: operasiDipulihkan.syncToken,
          retryAfterMs: DEFAULT_RETRY_AFTER_MS,
        }
      : null
  );
  const actionInFlightRef = useRef(false);
  const pollingRunRef = useRef(0);
  const statusControllerRef = useRef<AbortController | null>(null);
  const navigationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      pollingRunRef.current += 1;
      actionInFlightRef.current = false;
      statusControllerRef.current?.abort();
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const surat: SuratData = {
    pekerjaan: data.pekerjaan,
    lokasi: data.lokasi,
    kategori: data.kategori,
    namaPenyerah: data.nama_penyerah,
    namaPenerima: data.nama_penerima,
    tanggal: tanggal ?? tanggalIndonesia(),
    items: data.items.map((it) => ({
      nama_barang: it.nama_barang,
      satuan: it.satuan,
      jumlahPermintaan: it.jumlah_permintaan,
      jumlahDiberikan: it.jumlah_diberikan,
    })),
  };

  const modeEdit = Boolean(requestId);
  const sedangMemproses =
    saveState.kind === "submitting" ||
    saveState.kind === "checking" ||
    saveState.kind === "recovering";
  const belumPasti = saveState.kind === "uncertain";
  const databaseBermasalah = saveState.kind === "database_error";
  const operasiBelumSelesai = sedangMemproses || belumPasti || databaseBermasalah;

  useEffect(() => {
    if (!operasiBelumSelesai) return;
    const ingatkan = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ingatkan);
    return () => window.removeEventListener("beforeunload", ingatkan);
  }, [operasiBelumSelesai]);

  function selesaiBerhasil(operationRequestId: string, setelahPemeriksaan: boolean) {
    pollingRunRef.current += 1;
    statusControllerRef.current?.abort();
    statusControllerRef.current = null;
    actionInFlightRef.current = false;
    pendingOperationRef.current = null;
    hapusOperasiPermintaanTertunda(actorId, requestId);
    setSaveState({
      kind: "success",
      message: setelahPemeriksaan
        ? "Spreadsheet dan database sudah mengonfirmasi permintaan. Tidak ada pengiriman ulang yang berjalan."
        : "Permintaan berhasil tersimpan di spreadsheet dan database.",
    });

    navigationTimerRef.current = window.setTimeout(() => {
      router.push(
        `/riwayat/${encodeURIComponent(operationRequestId)}?tersimpan=${
          modeEdit ? "diperbarui" : "baru"
        }`
      );
    }, 450);
  }

  async function ambilStatus(operation: PendingOperation) {
    const controller = new AbortController();
    statusControllerRef.current = controller;
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      STATUS_REQUEST_TIMEOUT_MS
    );
    const params = new URLSearchParams({ request_id: operation.requestId });
    if (operation.syncToken) params.set("sync_token", operation.syncToken);

    try {
      const response = await fetch(`/api/requests/sync-status?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const hasil = (await response.json().catch(() => null)) as StatusResponse | null;
      if (!response.ok) {
        throw new Error(hasil?.error ?? "Status permintaan belum dapat diperiksa.");
      }
      return hasil;
    } finally {
      window.clearTimeout(timeoutId);
      if (statusControllerRef.current === controller) {
        statusControllerRef.current = null;
      }
    }
  }

  async function mulaiPemeriksaan(operation: PendingOperation, dipulihkan = false) {
    if (actionInFlightRef.current) return;

    actionInFlightRef.current = true;
    const runId = pollingRunRef.current + 1;
    pollingRunRef.current = runId;
    setSaveState({
      kind: dipulihkan ? "recovering" : "checking",
      requestId: operation.requestId,
    });
    const deadline = Date.now() + STATUS_POLL_WINDOW_MS;

    try {
      while (Date.now() < deadline) {
        if (pollingRunRef.current !== runId) return;

        try {
          const status = await ambilStatus(operation);
          if (pollingRunRef.current !== runId) return;

          operation.retryAfterMs = retryDelay(status?.retryAfterMs ?? operation.retryAfterMs);
          if (status?.syncToken) operation.syncToken = status.syncToken;

          if (status?.syncStatus === "database_error") {
            setSaveState({ kind: "database_error", requestId: operation.requestId });
            return;
          }

          if (status?.syncStatus === "confirmed" && status.databaseSaved === true) {
            selesaiBerhasil(status.id ?? status.requestId ?? operation.requestId, true);
            return;
          }
        } catch {
          // Gangguan pada pemeriksaan tidak berarti transaksi gagal. Tetap periksa
          // menggunakan ID yang sama sampai jendela pemeriksaan selesai.
        }

        if (Date.now() < deadline) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, operation.retryAfterMs);
          });
        }
      }

      if (pollingRunRef.current === runId) {
        setSaveState({ kind: "uncertain", requestId: operation.requestId });
      }
    } finally {
      if (pollingRunRef.current === runId) actionInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!operasiDipulihkan) return;
    const operation = pendingOperationRef.current;
    if (!operation) return;

    simpanOperasiPermintaanTertunda(operasiDipulihkan);
    const timer = window.setTimeout(() => void mulaiPemeriksaan(operation, true), 0);
    return () => window.clearTimeout(timer);
    // Pemulihan sengaja hanya dimulai untuk record yang diterima saat mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operasiDipulihkan]);

  async function handleSimpan() {
    if (actionInFlightRef.current) return;

    const operationRequestId =
      requestId ?? createRequestIdRef.current ?? crypto.randomUUID();
    const syncToken = syncTokenRef.current ?? crypto.randomUUID();
    if (!requestId) createRequestIdRef.current = operationRequestId;
    syncTokenRef.current = syncToken;

    const operation: PendingOperation = pendingOperationRef.current ?? {
      requestId: operationRequestId,
      syncToken,
      retryAfterMs: DEFAULT_RETRY_AFTER_MS,
    };
    pendingOperationRef.current = operation;
    simpanOperasiPermintaanTertunda({
      version: 1,
      actorId,
      mode: modeEdit ? "edit" : "create",
      requestId: operation.requestId,
      syncToken: operation.syncToken,
      resourceId: requestId,
      payload: data,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });
    actionInFlightRef.current = true;
    setSaveState({ kind: "submitting", requestId: operation.requestId });

    try {
      const response = await fetch(modeEdit ? `/api/requests/${requestId}` : "/api/requests", {
        method: modeEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Token": operation.syncToken,
          ...(!modeEdit ? { "Idempotency-Key": operation.requestId } : {}),
        },
        body: JSON.stringify(data),
      });
      const hasil = (await response.json().catch(() => null)) as SaveResponse | null;

      if (hasil?.requestId) operation.requestId = hasil.requestId;
      if (hasil?.syncToken) {
        operation.syncToken = hasil.syncToken;
        syncTokenRef.current = hasil.syncToken;
      }
      operation.retryAfterMs = retryDelay(hasil?.retryAfterMs);
      simpanOperasiPermintaanTertunda({
        version: 1,
        actorId,
        mode: modeEdit ? "edit" : "create",
        requestId: operation.requestId,
        syncToken: operation.syncToken,
        resourceId: requestId,
        payload: data,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });

      if (response.ok && hasil?.id && hasil.syncStatus !== "pending") {
        selesaiBerhasil(hasil.id, false);
        return;
      }

      if (response.status === 202 || hasil?.pending || hasil?.syncStatus === "pending") {
        actionInFlightRef.current = false;
        await mulaiPemeriksaan(operation);
        return;
      }

      if (hasil?.syncStatus === "pending_database") {
        actionInFlightRef.current = false;
        await mulaiPemeriksaan(operation);
        return;
      }

      if (hasil?.syncStatus === "database_error") {
        actionInFlightRef.current = false;
        setSaveState({ kind: "database_error", requestId: operation.requestId });
        return;
      }

      if (response.status === 408 || !hasil) {
        actionInFlightRef.current = false;
        await mulaiPemeriksaan(operation);
        return;
      }

      createRequestIdRef.current = null;
      syncTokenRef.current = null;
      pendingOperationRef.current = null;
      actionInFlightRef.current = false;
      hapusOperasiPermintaanTertunda(actorId, requestId);
      setSaveState({
        kind: "failure",
        message: hasil.error ?? "Permintaan tidak tersimpan. Periksa kembali data yang diisi.",
      });
    } catch {
      // Respons dapat terputus setelah spreadsheet menulis. Jangan otomatis
      // mengirim POST/PATCH lagi; periksa token operasi yang sama terlebih dahulu.
      actionInFlightRef.current = false;
      await mulaiPemeriksaan(operation);
    }
  }

  function handlePeriksaStatus() {
    const operation = pendingOperationRef.current;
    if (!operation) return;
    void mulaiPemeriksaan(operation);
  }

  // Jalan keluar dari transaksi tertunda yang tidak kunjung selesai: hentikan
  // pemeriksaan, hapus catatan pemulihan di browser, dan kembali ke form kosong.
  // Tidak menghapus data apa pun di server — bila transaksi ternyata sudah
  // tersimpan, catatannya tetap ada di Riwayat.
  function handleBuangPemulihan() {
    pollingRunRef.current += 1;
    statusControllerRef.current?.abort();
    statusControllerRef.current = null;
    if (navigationTimerRef.current !== null) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
    actionInFlightRef.current = false;
    pendingOperationRef.current = null;
    createRequestIdRef.current = null;
    syncTokenRef.current = null;
    hapusOperasiPermintaanTertunda(actorId, requestId);
    setSaveState({ kind: "idle" });
    setDikonfirmasi(false);
    onBuangPemulihan?.();
  }

  return (
    <div className="space-y-6" aria-busy={sedangMemproses}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Preview Permintaan</h1>
          <p className="mt-1.5 text-sm text-muted">
            Periksa isi surat sebelum {modeEdit ? "menyimpan perubahan" : "menyimpan"}. PDF
            bisa diunduh setelah data tersimpan.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onKembali}
          disabled={operasiBelumSelesai || saveState.kind === "success"}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Form
        </Button>
      </div>

      <SuratRingkasan data={surat} />

      {saveState.kind === "submitting" ? (
        <Alert variant="info" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Sedang menyimpan permintaan</p>
            <p className="mt-1">
              Spreadsheet sedang memproses data. Tetap di halaman ini dan jangan menekan tombol
              kembali.
            </p>
            <p className="mt-1 break-all text-xs">ID permintaan: {saveState.requestId}</p>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "checking" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Respons terlambat—status sedang diperiksa</p>
            <p className="mt-1">
              Data mungkin sudah tercatat. Website hanya memeriksa status dan tidak mengirim ulang
              permintaan secara otomatis.
            </p>
            <p className="mt-1 break-all text-xs">ID permintaan: {saveState.requestId}</p>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "recovering" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Memulihkan transaksi sebelumnya</p>
            <p className="mt-1">
              Website menemukan transaksi yang belum selesai sebelum halaman ditutup atau dimuat
              ulang. Statusnya sedang diperiksa dengan ID lama; transaksi baru belum diizinkan.
            </p>
            <p className="mt-1 break-all text-xs">ID permintaan: {saveState.requestId}</p>
            <p className="mt-2 text-xs">
              Kalau pemeriksaan tak kunjung selesai, cek dulu di{" "}
              <strong>Riwayat</strong> apakah permintaan ini sudah tersimpan. Bila belum, buang
              transaksi macet ini untuk mulai lagi.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleBuangPemulihan}
            >
              Buang transaksi ini &amp; mulai baru
            </Button>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "uncertain" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Penyimpanan belum dapat dipastikan</p>
            <p className="mt-1">
              Pemeriksaan otomatis sudah berhenti. Saat ini tidak ada pengiriman ulang yang berjalan,
              dan isian Anda tetap tersimpan di halaman ini.
            </p>
            <p className="mt-1">
              Periksa status terlebih dahulu. Bila perlu mengirim ulang, tombol utama tetap memakai
              ID operasi yang sama sehingga transaksi tidak digandakan.
            </p>
            <p className="mt-2 break-all text-xs">ID permintaan: {saveState.requestId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handlePeriksaStatus}>
                <RefreshCw aria-hidden="true" />
                Periksa Status
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleBuangPemulihan}>
                Buang &amp; mulai baru
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "database_error" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Spreadsheet tercatat, database belum tersinkron</p>
            <p className="mt-1">
              Jangan membuat atau mengirim ulang permintaan. Data spreadsheet sudah ditemukan,
              tetapi penyimpanan ke database website perlu diperiksa lagi.
            </p>
            <p className="mt-2 break-all text-xs">ID permintaan: {saveState.requestId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handlePeriksaStatus}>
                <RefreshCw aria-hidden="true" />
                Periksa Lagi
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleBuangPemulihan}>
                Buang &amp; mulai baru
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "success" ? (
        <Alert variant="info" className="flex items-start gap-3" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Permintaan berhasil tersimpan</p>
            <p className="mt-1">{saveState.message} Membuka detail permintaan…</p>
          </div>
        </Alert>
      ) : null}

      {saveState.kind === "failure" ? (
        <Alert variant="destructive" aria-live="assertive">
          <p className="font-semibold">Permintaan tidak tersimpan</p>
          <p className="mt-1">{saveState.message}</p>
          <p className="mt-1 text-xs">Tidak ada proses penyimpanan yang sedang berjalan.</p>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <Checkbox
            id="konfirmasi"
            checked={dikonfirmasi}
            onCheckedChange={(v) => setDikonfirmasi(v === true)}
            disabled={operasiBelumSelesai || saveState.kind === "success"}
            className="mt-0.5"
          />
          <Label htmlFor="konfirmasi" className="cursor-pointer text-sm font-normal leading-relaxed">
            Saya sudah memeriksa data ini benar.
          </Label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onKembali}
            disabled={operasiBelumSelesai || saveState.kind === "success"}
          >
            Kembali
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSimpan}
            disabled={
              !dikonfirmasi ||
              sedangMemproses ||
              databaseBermasalah ||
              saveState.kind === "success"
            }
            className="sm:min-w-64"
          >
            {sedangMemproses ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {saveState.kind === "recovering"
                  ? "Memulihkan Status…"
                  : saveState.kind === "checking"
                    ? "Memeriksa Status…"
                    : "Menyimpan…"}
              </>
            ) : belumPasti ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Kirim Ulang dengan ID yang Sama
              </>
            ) : databaseBermasalah ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Gunakan Periksa Lagi
              </>
            ) : saveState.kind === "success" ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Berhasil Tersimpan
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {modeEdit ? "Konfirmasi & Simpan Perubahan" : "Konfirmasi & Simpan"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
