"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PackagePlus, RefreshCw } from "lucide-react";

import { ItemCombobox, type PilihanStok } from "@/components/item-combobox";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RackOption } from "@/lib/master-data-types";

type StockResponse = { keterangan?: string[]; error?: string };
type RackResponse = { items?: RackOption[]; racks?: RackOption[]; error?: string };

type InputStockResponse = {
  ok?: boolean;
  pending?: boolean;
  verifiedAfterTimeout?: boolean;
  transactionId?: string;
  transaction_id?: string;
  message?: string;
  error?: string;
  code?: string;
};

type StatusResponse = {
  found?: boolean;
  error?: string;
};

type IncomingPayload = {
  transaction_id: string;
  tanggal: string;
  kode_barang: string | null;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  rack: number;
  area: string;
  jumlah: number;
  keterangan: string;
};

type TransactionState =
  | { kind: "idle" }
  | { kind: "submitting"; transactionId: string }
  | { kind: "checking"; transactionId: string }
  | { kind: "recovering"; transactionId: string }
  | { kind: "uncertain"; transactionId: string }
  | { kind: "success"; message: string; verifiedAfterTimeout: boolean }
  | { kind: "failure"; message: string };

type PendingTransaction = {
  transactionId: string;
  successMessage: string;
  payload: IncomingPayload;
  stokSaatDikirim: number;
};

type StoredIncomingTransaction = PendingTransaction & {
  version: 1;
  actorId: string;
  expiresAt: number;
};

const STATUS_POLL_INTERVAL_MS = 3_000;
const STATUS_POLL_WINDOW_MS = 75_000;
const STATUS_REQUEST_TIMEOUT_MS = 10_000;
const PENDING_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pendingTransactionKey(actorId: string) {
  return `wares:pending-incoming:${encodeURIComponent(actorId)}:v1`;
}

function simpanTransaksiMasukTertunda(actorId: string, transaksi: PendingTransaction) {
  try {
    const record: StoredIncomingTransaction = {
      ...transaksi,
      version: 1,
      actorId,
      expiresAt: Date.now() + PENDING_TRANSACTION_TTL_MS,
    };
    window.localStorage.setItem(pendingTransactionKey(actorId), JSON.stringify(record));
  } catch {
    // Penyimpanan browser hanya lapisan pemulihan untuk tab yang tertutup.
  }
}

function hapusTransaksiMasukTertunda(actorId: string) {
  try {
    window.localStorage.removeItem(pendingTransactionKey(actorId));
  } catch {
    // Tidak menggagalkan transaksi bila storage browser dibatasi.
  }
}

function bacaTransaksiMasukTertunda(actorId: string): StoredIncomingTransaction | null {
  try {
    const raw = window.localStorage.getItem(pendingTransactionKey(actorId));
    if (!raw) return null;
    const nilai = JSON.parse(raw) as Partial<StoredIncomingTransaction>;
    const payload = nilai.payload as Partial<IncomingPayload> | undefined;
    const valid =
      nilai.version === 1 &&
      nilai.actorId === actorId &&
      typeof nilai.expiresAt === "number" &&
      nilai.expiresAt > Date.now() &&
      typeof nilai.transactionId === "string" &&
      UUID_PATTERN.test(nilai.transactionId) &&
      typeof nilai.successMessage === "string" &&
      typeof nilai.stokSaatDikirim === "number" &&
      Number.isFinite(nilai.stokSaatDikirim) &&
      payload?.transaction_id === nilai.transactionId &&
      typeof payload.tanggal === "string" &&
      typeof payload.nama_barang === "string" &&
      typeof payload.kategori === "string" &&
      typeof payload.lokasi === "string" &&
      typeof payload.satuan === "string" &&
      typeof payload.rack === "number" &&
      Number.isInteger(payload.rack) &&
      payload.rack > 0 &&
      typeof payload.area === "string" &&
      Boolean(payload.area.trim()) &&
      typeof payload.jumlah === "number" &&
      Number.isInteger(payload.jumlah) &&
      payload.jumlah > 0 &&
      typeof payload.keterangan === "string";

    if (!valid) {
      hapusTransaksiMasukTertunda(actorId);
      return null;
    }
    return nilai as StoredIncomingTransaction;
  } catch {
    return null;
  }
}

function tanggalWibHariIni() {
  const bagian = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const nilai = Object.fromEntries(bagian.map((item) => [item.type, item.value]));
  return `${nilai.year}-${nilai.month}-${nilai.day}`;
}

export function InputStockForm({ actorId }: { actorId: string }) {
  const transactionIdRef = useRef<string | null>(null);
  const pendingTransactionRef = useRef<PendingTransaction | null>(null);
  const pollingRef = useRef(false);
  const submissionInFlightRef = useRef(false);
  const pollingRunRef = useRef(0);
  const statusRequestControllerRef = useRef<AbortController | null>(null);
  const [tanggal, setTanggal] = useState(tanggalWibHariIni);
  const [barang, setBarang] = useState<PilihanStok | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [pilihanKeterangan, setPilihanKeterangan] = useState("");
  const [keteranganLain, setKeteranganLain] = useState("");
  const [daftarKeterangan, setDaftarKeterangan] = useState<string[]>([]);
  const [daftarRack, setDaftarRack] = useState<RackOption[]>([]);
  const [rack, setRack] = useState("");
  const [area, setArea] = useState("");
  const [memuatPilihan, setMemuatPilihan] = useState(true);
  const [memuatRack, setMemuatRack] = useState(true);
  const [memeriksaOperasiTersimpan, setMemeriksaOperasiTersimpan] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    // Pilihan keterangan punya endpoint metadata yang ringan; tidak perlu
    // mengambil seluruh snapshot stok hanya untuk mengisi dropdown ini.
    fetch("/api/stock/keterangan", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const hasil = (await response.json().catch(() => null)) as StockResponse | null;
        if (!response.ok) throw new Error(hasil?.error ?? "Gagal memuat pilihan keterangan.");
        return hasil;
      })
      .then((hasil) => {
        const unik = Array.from(
          new Set(
            (hasil?.keterangan ?? [])
              .map((item) => item.trim())
              .filter(
                (item) => item && item.toLocaleLowerCase("id-ID") !== "lainnya"
              )
          )
        ).sort((a, b) => a.localeCompare(b, "id-ID"));
        setDaftarKeterangan(unik);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Gagal memuat pilihan keterangan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMemuatPilihan(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/racks", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const hasil = (await response.json().catch(() => null)) as RackResponse | null;
        if (!response.ok) throw new Error(hasil?.error ?? "Gagal memuat daftar rack gudang.");
        return hasil;
      })
      .then((hasil) => {
        const rackValid = (hasil?.items ?? hasil?.racks ?? [])
          .map((item) => ({ rack: Number(item.rack), area: String(item.area ?? "").trim() }))
          .filter((item) => Number.isInteger(item.rack) && item.rack > 0 && item.area)
          .sort((a, b) => a.rack - b.rack);
        setDaftarRack(Array.from(new Map(rackValid.map((item) => [item.rack, item])).values()));
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Gagal memuat daftar rack gudang.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMemuatRack(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      pollingRunRef.current += 1;
      pollingRef.current = false;
      statusRequestControllerRef.current?.abort();
    };
  }, []);

  const keterangan =
    pilihanKeterangan === "__lainnya__" ? keteranganLain.trim() : pilihanKeterangan.trim();
  const daftarArea = Array.from(
    new Set([...daftarRack.map((item) => item.area), ...(area ? [area] : [])])
  ).sort((a, b) => a.localeCompare(b, "id-ID"));

  const transaksiBelumPasti =
    memeriksaOperasiTersimpan ||
    transactionState.kind === "submitting" ||
    transactionState.kind === "checking" ||
    transactionState.kind === "recovering" ||
    transactionState.kind === "uncertain";

  function pilihBarang(item: PilihanStok) {
    setBarang(item);
    const rackBarang = item.rack == null ? "" : String(item.rack);
    const areaRack = daftarRack.find((pilihan) => String(pilihan.rack) === rackBarang)?.area;
    setRack(rackBarang);
    setArea(item.area?.trim() || areaRack || "");
  }

  function pilihRack(value: string) {
    setRack(value);
    const pilihan = daftarRack.find((item) => String(item.rack) === value);
    setArea(pilihan?.area ?? "");
  }

  function tandaiBerhasil(transaksi: PendingTransaction, verifiedAfterTimeout: boolean) {
    pollingRunRef.current += 1;
    pollingRef.current = false;
    statusRequestControllerRef.current?.abort();
    statusRequestControllerRef.current = null;
    transactionIdRef.current = null;
    pendingTransactionRef.current = null;
    hapusTransaksiMasukTertunda(actorId);
    setTransactionState({
      kind: "success",
      message: transaksi.successMessage,
      verifiedAfterTimeout,
    });
    setBarang(null);
    setRack("");
    setArea("");
    setJumlah("1");
  }

  async function ambilStatusTransaksi(transactionId: string) {
    const controller = new AbortController();
    statusRequestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), STATUS_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `/api/stock/input/status?transaction_id=${encodeURIComponent(transactionId)}`,
        { cache: "no-store", signal: controller.signal }
      );
      const hasil = (await response.json().catch(() => null)) as StatusResponse | null;
      if (!response.ok) {
        throw new Error(hasil?.error ?? "Status transaksi belum dapat diperiksa.");
      }
      return hasil?.found === true;
    } finally {
      window.clearTimeout(timeoutId);
      if (statusRequestControllerRef.current === controller) {
        statusRequestControllerRef.current = null;
      }
    }
  }

  async function mulaiPemeriksaanStatus(
    transaksi: PendingTransaction,
    dipulihkan = false
  ) {
    if (pollingRef.current) return;

    pollingRef.current = true;
    const runId = pollingRunRef.current + 1;
    pollingRunRef.current = runId;
    setError(null);
    setTransactionState({
      kind: dipulihkan ? "recovering" : "checking",
      transactionId: transaksi.transactionId,
    });
    const deadline = Date.now() + STATUS_POLL_WINDOW_MS;

    try {
      while (Date.now() < deadline) {
        if (pollingRunRef.current !== runId) return;

        try {
          const found = await ambilStatusTransaksi(transaksi.transactionId);
          if (pollingRunRef.current !== runId) return;
          if (found) {
            tandaiBerhasil(transaksi, true);
            return;
          }
        } catch {
          // Hasil pemeriksaan yang terputus tetap ambigu. Jangan kirim ulang transaksi.
        }

        if (Date.now() < deadline) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, STATUS_POLL_INTERVAL_MS);
          });
        }
      }

      if (pollingRunRef.current === runId) {
        setTransactionState({ kind: "uncertain", transactionId: transaksi.transactionId });
      }
    } finally {
      if (pollingRunRef.current === runId) pollingRef.current = false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current || pollingRef.current) return;
    setError(null);

    const jumlahAngka = Number(jumlah);
    if (!tanggal) {
      setError("Tanggal kedatangan wajib diisi.");
      return;
    }
    if (!barang) {
      setError("Pilih material yang masuk.");
      return;
    }
    const rackAngka = Number(rack);
    if (!Number.isInteger(rackAngka) || rackAngka <= 0) {
      setError("Pilih nomor rack tempat material disimpan.");
      return;
    }
    if (!area.trim()) {
      setError("Pilih area penyimpanan material.");
      return;
    }
    if (!Number.isInteger(jumlahAngka) || jumlahAngka <= 0) {
      setError("Jumlah masuk harus berupa bilangan bulat lebih dari 0.");
      return;
    }
    if (!keterangan) {
      setError("Keterangan wajib dipilih atau diisi.");
      return;
    }

    const transactionId = transactionIdRef.current ?? crypto.randomUUID();
    transactionIdRef.current = transactionId;
    const payload: IncomingPayload = pendingTransactionRef.current?.payload ?? {
      transaction_id: transactionId,
      tanggal,
      kode_barang: barang.kode_barang,
      nama_barang: barang.nama_barang,
      kategori: barang.kategori,
      lokasi: barang.lokasi,
      satuan: barang.satuan,
      rack: rackAngka,
      area: area.trim(),
      jumlah: jumlahAngka,
      keterangan,
    };
    const transaksi: PendingTransaction = pendingTransactionRef.current ?? {
      transactionId,
      successMessage: `${jumlahAngka.toLocaleString("id-ID")} ${barang.satuan} ${barang.nama_barang} berhasil ditambahkan ke stok.`,
      payload,
      stokSaatDikirim: barang.stok,
    };
    pendingTransactionRef.current = transaksi;
    simpanTransaksiMasukTertunda(actorId, transaksi);
    submissionInFlightRef.current = true;
    setTransactionState({ kind: "submitting", transactionId });

    try {
      // ID dipertahankan bila respons timeout setelah spreadsheet sempat menulis.
      // Percobaan ulang transaksi yang sama tidak akan menggandakan stok masuk.
      const response = await fetch("/api/stock/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaksi.payload),
      });
      const hasil = (await response.json().catch(() => null)) as
        | InputStockResponse
        | null;

      const responseTransactionId = hasil?.transactionId ?? hasil?.transaction_id;
      if (responseTransactionId) {
        transaksi.transactionId = responseTransactionId;
        transaksi.payload.transaction_id = responseTransactionId;
        transactionIdRef.current = responseTransactionId;
        simpanTransaksiMasukTertunda(actorId, transaksi);
      }

      if (hasil?.pending) {
        await mulaiPemeriksaanStatus(transaksi);
        return;
      }

      if (response.ok && hasil?.ok) {
        tandaiBerhasil(transaksi, hasil.verifiedAfterTimeout === true);
        return;
      }

      if (response.status === 408 || !hasil) {
        await mulaiPemeriksaanStatus(transaksi);
        return;
      }

      transactionIdRef.current = null;
      pendingTransactionRef.current = null;
      hapusTransaksiMasukTertunda(actorId);
      setTransactionState({
        kind: "failure",
        message: hasil.error ?? "Stok tidak disimpan. Periksa kembali data yang diisi.",
      });
    } catch {
      // Koneksi dapat terputus setelah spreadsheet sempat menulis. Periksa ID yang
      // sama terlebih dahulu dan jangan otomatis mengirim transaksi kedua.
      await mulaiPemeriksaanStatus(transaksi);
    } finally {
      submissionInFlightRef.current = false;
    }
  }

  function handlePeriksaStatus() {
    const transaksi = pendingTransactionRef.current;
    if (!transaksi) return;
    void mulaiPemeriksaanStatus(transaksi);
  }

  useEffect(() => {
    const tersimpan = bacaTransaksiMasukTertunda(actorId);
    if (!tersimpan) {
      setMemeriksaOperasiTersimpan(false);
      return;
    }

    transactionIdRef.current = tersimpan.transactionId;
    pendingTransactionRef.current = tersimpan;
    setTanggal(tersimpan.payload.tanggal);
    setBarang({
      kode_barang: tersimpan.payload.kode_barang,
      nama_barang: tersimpan.payload.nama_barang,
      kategori: tersimpan.payload.kategori,
      lokasi: tersimpan.payload.lokasi,
      satuan: tersimpan.payload.satuan,
      rack: tersimpan.payload.rack,
      area: tersimpan.payload.area,
      stok: tersimpan.stokSaatDikirim,
    });
    setRack(String(tersimpan.payload.rack));
    setArea(tersimpan.payload.area);
    setJumlah(String(tersimpan.payload.jumlah));
    setPilihanKeterangan("__lainnya__");
    setKeteranganLain(tersimpan.payload.keterangan);
    setTransactionState({ kind: "recovering", transactionId: tersimpan.transactionId });
    setMemeriksaOperasiTersimpan(false);

    const timer = window.setTimeout(
      () => void mulaiPemeriksaanStatus(tersimpan, true),
      0
    );
    return () => window.clearTimeout(timer);
    // Pemulihan sengaja hanya dimulai saat actor halaman berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId]);

  const operasiAktif =
    transactionState.kind === "submitting" ||
    transactionState.kind === "checking" ||
    transactionState.kind === "recovering" ||
    transactionState.kind === "uncertain";

  useEffect(() => {
    if (!operasiAktif) return;
    const ingatkan = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ingatkan);
    return () => window.removeEventListener("beforeunload", ingatkan);
  }, [operasiAktif]);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      noValidate
      aria-busy={
        memeriksaOperasiTersimpan ||
        transactionState.kind === "submitting" ||
        transactionState.kind === "checking" ||
        transactionState.kind === "recovering"
      }
    >
      {memeriksaOperasiTersimpan ? (
        <Alert variant="info" className="flex items-start gap-3" aria-live="polite">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Memeriksa transaksi tersimpan</p>
            <p className="mt-1">
              Website memastikan tidak ada transaksi admin ini yang masih tertunda sebelum input
              stok baru diizinkan.
            </p>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "success" ? (
        <Alert variant="info" className="flex items-start gap-3" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Stok berhasil diperbarui</p>
            <p className="mt-1">{transactionState.message}</p>
            <p className="mt-1 text-xs">
              {transactionState.verifiedAfterTimeout
                ? "Respons awal terlambat, tetapi website sudah memastikan transaksi tercatat di spreadsheet. Tidak ada eksekusi ulang yang sedang berjalan."
                : "Spreadsheet sudah mengonfirmasi transaksi. Tidak ada eksekusi ulang yang sedang berjalan."}
            </p>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "submitting" ? (
        <Alert variant="info" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Sedang mengirim data ke spreadsheet</p>
            <p className="mt-1">
              Tunggu sampai status berubah. Jangan menutup halaman atau menekan tombol lagi.
            </p>
            <p className="mt-1 break-all text-xs">ID transaksi: {transactionState.transactionId}</p>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "checking" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Spreadsheet masih memproses—status sedang diperiksa</p>
            <p className="mt-1">
              Data mungkin sudah tercatat. Website hanya memeriksa ID transaksi setiap beberapa
              detik dan tidak mengirim ulang penambahan stok.
            </p>
            <p className="mt-1 break-all text-xs">ID transaksi: {transactionState.transactionId}</p>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "recovering" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Memulihkan input stok sebelumnya</p>
            <p className="mt-1">
              Website menemukan transaksi yang belum selesai sebelum halaman ditutup atau dimuat
              ulang. Status ID lama sedang diperiksa; stok baru tidak dikirim ulang.
            </p>
            <p className="mt-1 break-all text-xs">ID transaksi: {transactionState.transactionId}</p>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "uncertain" ? (
        <Alert variant="warning" className="flex items-start gap-3" aria-live="assertive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Transaksi belum dapat dipastikan</p>
            <p className="mt-1">
              Spreadsheet mungkin sudah menerima data, tetapi belum memberikan konfirmasi.
              Pemeriksaan otomatis sudah berhenti dan saat ini tidak ada eksekusi ulang.
            </p>
            <p className="mt-1">
              Tekan <strong>Periksa Status</strong> terlebih dahulu. Jika tetap belum ditemukan,
              tombol kirim ulang di bawah akan memakai ID transaksi yang sama agar stok tidak
              tercatat dua kali.
            </p>
            <p className="mt-2 break-all text-xs">ID transaksi: {transactionState.transactionId}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handlePeriksaStatus}
            >
              <RefreshCw aria-hidden="true" />
              Periksa Status
            </Button>
          </div>
        </Alert>
      ) : null}

      {transactionState.kind === "failure" ? (
        <Alert variant="destructive" aria-live="assertive">
          <p className="font-semibold">Stok tidak diperbarui</p>
          <p className="mt-1">{transactionState.message}</p>
          <p className="mt-1 text-xs">Transaksi tidak sedang diproses atau dikirim ulang.</p>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <fieldset disabled={transaksiBelumPasti} className="m-0 min-w-0 border-0 p-0">
        <Card>
        <CardHeader>
          <CardTitle>Data Barang Masuk</CardTitle>
          <CardDescription>
            Isian ini akan ditambahkan ke jurnal MASUK dan laporan stok bulan berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="tanggal-masuk">
              Tanggal <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tanggal-masuk"
              type="date"
              value={tanggal}
              onChange={(event) => setTanggal(event.target.value)}
              className="mt-1.5"
              required
            />
            <p className="mt-1.5 text-xs text-muted">Tanggal transaksi menggunakan zona waktu WIB.</p>
          </div>

          <div>
            <Label>
              Barang <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <ItemCombobox
                value={barang?.nama_barang ?? ""}
                kategoriTerpilih={[]}
                semuaKategori
                onPilih={pilihBarang}
              />
            </div>
          </div>

          {barang ? (
            <div className="rounded-lg border border-brand/20 bg-brand-light/60 p-4 sm:col-span-2">
              <div className="grid gap-3 text-sm sm:grid-cols-5">
                <div>
                  <div className="text-xs text-muted">Kode</div>
                  <div className="mt-0.5 font-semibold text-ink">{barang.kode_barang ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Kategori</div>
                  <div className="mt-0.5 font-semibold text-ink">{barang.kategori || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Lokasi</div>
                  <div className="mt-0.5 font-semibold text-ink">{barang.lokasi || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Stok saat ini</div>
                  <div className="mt-0.5 font-semibold text-brand-dark">
                    {barang.stok.toLocaleString("id-ID")} {barang.satuan}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Rack / Area saat ini</div>
                  <div className="mt-0.5 font-semibold text-ink">
                    {barang.rack != null || barang.area
                      ? `Rack ${barang.rack ?? "—"} / ${barang.area || "—"}`
                      : "Belum ditentukan"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="rack-masuk">
              Rack Penyimpanan <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <Select value={rack} onValueChange={pilihRack}>
                <SelectTrigger id="rack-masuk" disabled={memuatRack}>
                  <SelectValue placeholder={memuatRack ? "Memuat daftar rack…" : "Pilih nomor rack"} />
                </SelectTrigger>
                <SelectContent>
                  {daftarRack.map((item) => (
                    <SelectItem key={item.rack} value={String(item.rack)}>
                      Rack {item.rack} — {item.area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-1.5 text-xs text-muted">Pilih label rack tempat barang ini diletakkan.</p>
          </div>

          <div>
            <Label htmlFor="area-masuk">
              Area <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="area-masuk" disabled={memuatRack || daftarArea.length === 0}>
                  <SelectValue placeholder="Pilih area" />
                </SelectTrigger>
                <SelectContent>
                  {daftarArea.map((namaArea) => (
                    <SelectItem key={namaArea} value={namaArea}>{namaArea}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Terisi otomatis sesuai rack, tetapi dapat diganti bila lokasi penyimpanan berbeda.
            </p>
          </div>

          <div>
            <Label htmlFor="jumlah-masuk">
              Jumlah Masuk <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="jumlah-masuk"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={jumlah}
                onChange={(event) => setJumlah(event.target.value)}
                required
              />
              <span className="min-w-16 text-sm font-medium text-muted">{barang?.satuan ?? "Satuan"}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="keterangan-masuk">
              Keterangan <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <Select value={pilihanKeterangan} onValueChange={setPilihanKeterangan}>
                <SelectTrigger id="keterangan-masuk" disabled={memuatPilihan}>
                  <SelectValue
                    placeholder={memuatPilihan ? "Memuat pilihan…" : "Pilih keterangan"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {daftarKeterangan.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                  <SelectItem value="__lainnya__">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {pilihanKeterangan === "__lainnya__" ? (
            <div className="sm:col-span-2">
              <Label htmlFor="keterangan-lain">
                Keterangan lainnya <span className="text-destructive">*</span>
              </Label>
              <Input
                id="keterangan-lain"
                value={keteranganLain}
                onChange={(event) => setKeteranganLain(event.target.value)}
                placeholder="Ketik sumber atau keterangan barang masuk"
                className="mt-1.5"
                maxLength={120}
                required
              />
            </div>
          ) : null}
        </CardContent>
        </Card>
      </fieldset>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={
            memeriksaOperasiTersimpan ||
            transactionState.kind === "submitting" ||
            transactionState.kind === "checking" ||
            transactionState.kind === "recovering"
          }
          className="w-full sm:w-auto sm:min-w-48"
        >
          {transactionState.kind === "submitting" ||
          transactionState.kind === "checking" ||
          transactionState.kind === "recovering" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : transactionState.kind === "uncertain" ? (
            <RefreshCw aria-hidden="true" />
          ) : (
            <PackagePlus aria-hidden="true" />
          )}
          {transactionState.kind === "submitting"
            ? "Mengirim…"
            : transactionState.kind === "checking"
              ? "Memeriksa Status…"
              : transactionState.kind === "recovering"
                ? "Memulihkan Status…"
              : transactionState.kind === "uncertain"
                ? "Kirim Ulang dengan ID yang Sama"
                : "Tambahkan Stok"}
        </Button>
      </div>
    </form>
  );
}
