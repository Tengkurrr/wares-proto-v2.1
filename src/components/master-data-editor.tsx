"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Database,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  MasterDataItem,
  MasterDataSource,
  RackOption,
  StatusMaterial,
} from "@/lib/master-data-types";

type MasterDataResponse = { items?: MasterDataItem[]; error?: string; code?: string };
type RackResponse = { items?: RackOption[]; racks?: RackOption[]; error?: string; code?: string };
type MirrorStatusResponse = {
  mirror?: { status?: "pending" | "synced" | "failed"; error?: string | null };
};

/** Kegagalan memuat, lengkap dengan kode/status agar pesannya bisa spesifik. */
type GagalMuat = { pesan: string; kode?: string; status?: number };
type KondisiMaster = "belum-dimuat" | "siap" | "kosong" | "perlu-backfill";

type HasilEndpoint<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type FormMaterial = {
  kategori: string;
  material_number: string;
  rack: string;
  klasifikasi: string;
  area: string;
  nama_barang: string;
  lokasi: string;
  status: StatusMaterial;
};

const FORM_AWAL: FormMaterial = {
  kategori: "",
  material_number: "",
  rack: "",
  klasifikasi: "",
  area: "",
  nama_barang: "",
  lokasi: "",
  status: "AKTIF",
};

const JUMLAH_PER_HALAMAN = 50;

function normalisasiStatus(status: unknown): StatusMaterial {
  return String(status ?? "").trim().toUpperCase() === "NONAKTIF" ? "NONAKTIF" : "AKTIF";
}

function normalisasiMaterial(item: MasterDataItem, index: number): MasterDataItem {
  const nilai = item as MasterDataItem & Record<string, unknown>;
  const rackMentah = nilai.rack ?? nilai.RACK;
  const rack = rackMentah === "" || rackMentah == null ? null : Number(rackMentah);

  return {
    id: nilai.id ?? nilai.row_id ?? nilai.row_number ?? nilai.no ?? index + 1,
    no: Number(nilai.no ?? nilai["NO."] ?? index + 1),
    kategori: String(nilai.kategori ?? nilai.KATEGORI ?? "").trim(),
    material_number: String(
      nilai.material_number ?? nilai.materialNumber ?? nilai["MATERIAL NUMBER"] ?? ""
    ).trim(),
    rack: Number.isFinite(rack) ? rack : null,
    klasifikasi: String(nilai.klasifikasi ?? nilai.KLASIFIKASI ?? "").trim(),
    area: String(nilai.area ?? nilai.AREA ?? "").trim(),
    nama_barang: String(nilai.nama_barang ?? nilai.namaBarang ?? nilai["NAMA BARANG"] ?? "").trim(),
    lokasi: String(nilai.lokasi ?? nilai.LOKASI ?? "").trim(),
    status: normalisasiStatus(nilai.status ?? nilai.STATUS),
  };
}

function normalisasiRack(item: RackOption): RackOption | null {
  const nilai = item as RackOption & Record<string, unknown>;
  const rack = Number(nilai.rack ?? nilai.RACK);
  const area = String(nilai.area ?? nilai.AREA ?? "").trim();
  return Number.isFinite(rack) && rack > 0 && area ? { rack, area } : null;
}

function pesanRespons(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

function statusMirror(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("mirror" in data)) return null;
  const mirror = data.mirror;
  if (!mirror || typeof mirror !== "object" || !("status" in mirror)) return null;
  return typeof mirror.status === "string" ? mirror.status : null;
}

function idItemRespons(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("item" in data)) return null;
  const item = data.item;
  if (!item || typeof item !== "object" || !("id" in item)) return null;
  return typeof item.id === "string" ? item.id : null;
}

async function ambilEndpoint<T>(url: string): Promise<HasilEndpoint<T>> {
  const response = await fetch(url, { cache: "no-store" });
  return {
    ok: response.ok,
    status: response.status,
    data: (await response.json().catch(() => null)) as T | null,
  };
}

function kegagalanRespons(
  hasil: HasilEndpoint<{ error?: string; code?: string }>,
  fallback: string
): GagalMuat {
  return {
    pesan: hasil.data?.error ?? fallback,
    kode: hasil.data?.code,
    status: hasil.status,
  };
}

function jenisGangguan(gagal: GagalMuat, source: MasterDataSource | null) {
  const detail = `${gagal.kode ?? ""} ${gagal.pesan}`.toLocaleLowerCase("id-ID");
  if (
    source === null ||
    gagal.kode === "NOT_CONFIGURED" ||
    gagal.kode === "MASTER_SOURCE_NOT_CONFIGURED" ||
    gagal.kode === "MASTER_SOURCE_INVALID"
  ) return "konfigurasi" as const;
  if (
    source === "postgres" &&
    (gagal.kode === "DB_ERROR" ||
      gagal.status === 500 ||
      /master_items|schema cache|relation|does not exist|tidak ditemukan/.test(detail))
  ) {
    return "database" as const;
  }
  return "sumber" as const;
}

export function MasterDataEditor({
  source,
  sourceConfigReason,
}: {
  source: MasterDataSource | null;
  sourceConfigReason?: "MISSING" | "INVALID";
}) {
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [racks, setRacks] = useState<RackOption[]>([]);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"SEMUA" | StatusMaterial>("AKTIF");
  const [filterRack, setFilterRack] = useState<"SEMUA" | "TERPETAKAN" | "BELUM">("SEMUA");
  const [halaman, setHalaman] = useState(1);
  const [memuat, setMemuat] = useState(source !== null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kondisiMaster, setKondisiMaster] = useState<KondisiMaster>("belum-dimuat");
  const [error, setError] = useState<string | null>(null);
  // Dipisah dari `error` biasa: ini kegagalan MEMUAT daftar, yang membuat seluruh
  // isi halaman tidak dapat dipercaya (berbeda dengan gagal menyimpan satu baris).
  const [gagalMuat, setGagalMuat] = useState<GagalMuat | null>(
    source === null
      ? {
          pesan:
            sourceConfigReason === "INVALID"
              ? "Nilai MASTER_SOURCE tidak valid."
              : "Environment variable MASTER_SOURCE belum diisi.",
          kode:
            sourceConfigReason === "INVALID"
              ? "MASTER_SOURCE_INVALID"
              : "MASTER_SOURCE_NOT_CONFIGURED",
          status: 503,
        }
      : null
  );
  const [gagalRack, setGagalRack] = useState<GagalMuat | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Tersimpan TAPI ada bagian sekunder yang gagal — ditampilkan kuning, bukan merah.
  const [peringatan, setPeringatan] = useState<string | null>(null);
  const [dialogTerbuka, setDialogTerbuka] = useState(false);
  const [itemDiedit, setItemDiedit] = useState<MasterDataItem | null>(null);
  const [form, setForm] = useState<FormMaterial>(FORM_AWAL);
  const mirrorWatchRef = useRef(0);

  const muatData = useCallback(async (awal = false) => {
    if (source === null) {
      setMemuat(false);
      setMenyegarkan(false);
      return;
    }
    awal ? setMemuat(true) : setMenyegarkan(true);
    setError(null);

    try {
      // Kedua sumber dibaca paralel, tetapi kegagalan daftar Rack tidak boleh
      // menyembunyikan Master Data yang sebenarnya berhasil dimuat.
      const [responsMaster, responsRack] = await Promise.allSettled([
        ambilEndpoint<MasterDataResponse>("/api/master-data"),
        ambilEndpoint<RackResponse>("/api/racks"),
      ]);

      if (responsMaster.status === "rejected") {
        setGagalMuat({
          pesan: responsMaster.reason instanceof Error
            ? responsMaster.reason.message
            : "Sumber Master Data tidak dapat dihubungi.",
        });
      } else if (!responsMaster.value.ok) {
        if (
          source === "postgres" &&
          responsMaster.value.data?.code === "MASTER_DATA_EMPTY"
        ) {
          setItems([]);
          setKondisiMaster("perlu-backfill");
          setGagalMuat(null);
        } else {
          setGagalMuat(kegagalanRespons(responsMaster.value, "Gagal memuat Master Data."));
        }
      } else if (!Array.isArray(responsMaster.value.data?.items)) {
        setGagalMuat({
          pesan: "Server tidak mengirim daftar Master Data yang valid.",
          kode: "INVALID_RESPONSE",
          status: responsMaster.value.status,
        });
      } else {
        const daftarMaster = responsMaster.value.data.items.map(normalisasiMaterial);
        setItems(daftarMaster);
        setKondisiMaster(
          daftarMaster.length > 0
            ? "siap"
            : source === "postgres"
              ? "perlu-backfill"
              : "kosong"
        );
        setGagalMuat(null);
      }

      if (responsRack.status === "rejected") {
        setGagalRack({
          pesan: responsRack.reason instanceof Error
            ? responsRack.reason.message
            : "Sumber daftar Rack tidak dapat dihubungi.",
        });
      } else if (!responsRack.value.ok) {
        setGagalRack(kegagalanRespons(responsRack.value, "Gagal memuat daftar Rack gudang."));
      } else {
        const daftarMentah = responsRack.value.data?.items ?? responsRack.value.data?.racks;
        if (!Array.isArray(daftarMentah)) {
          setGagalRack({
            pesan: "Server tidak mengirim daftar Rack yang valid.",
            kode: "INVALID_RESPONSE",
            status: responsRack.value.status,
          });
        } else {
          const daftarRack = daftarMentah
            .map(normalisasiRack)
            .filter((item): item is RackOption => item !== null)
            .sort((a, b) => a.rack - b.rack);
          setRacks(Array.from(new Map(daftarRack.map((item) => [item.rack, item])).values()));
          setGagalRack(
            daftarRack.length === 0
              ? {
                  pesan: "Sumber berhasil dibaca, tetapi daftar Rack masih kosong.",
                  kode: "EMPTY_RACK_SOURCE",
                  status: responsRack.value.status,
                }
              : null
          );
        }
      }
    } catch (e) {
      setGagalMuat({
        pesan: e instanceof Error ? e.message : "Terjadi kesalahan saat menyiapkan Master Data.",
      });
    } finally {
      setMemuat(false);
      setMenyegarkan(false);
    }
  }, [source]);

  useEffect(() => {
    void muatData(true);
  }, [muatData]);

  useEffect(() => () => {
    mirrorWatchRef.current += 1;
  }, []);

  useEffect(() => {
    setHalaman(1);
  }, [query, filterRack, filterStatus]);

  const daftarArea = useMemo(
    () =>
      Array.from(
        new Set([...racks.map((item) => item.area).filter(Boolean), ...(form.area ? [form.area] : [])])
      ).sort((a, b) => a.localeCompare(b, "id-ID")),
    [form.area, racks]
  );

  // Indeks pencarian dihitung SEKALI per daftar, bukan tiap ketikan. Dengan 1.299
  // material, membangun string gabungan + toLocaleLowerCase di dalam filter berarti
  // ~1.299 operasi string setiap huruf yang diketik — terasa tersendat saat mencari.
  const indeksCari = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item,
          [
            item.no,
            item.material_number,
            item.nama_barang,
            item.kategori,
            item.klasifikasi,
            item.rack,
            item.area,
            item.lokasi,
          ]
            .join(" ")
            .toLocaleLowerCase("id-ID"),
        ])
      ),
    [items]
  );

  const hasil = useMemo(() => {
    const cari = query.trim().toLocaleLowerCase("id-ID");
    return items.filter((item) => {
      if (filterStatus !== "SEMUA" && item.status !== filterStatus) return false;
      if (filterRack === "TERPETAKAN" && item.rack == null) return false;
      if (filterRack === "BELUM" && item.rack != null) return false;
      if (!cari) return true;
      return (indeksCari.get(item) ?? "").includes(cari);
    });
  }, [filterRack, filterStatus, indeksCari, items, query]);

  const ringkasanRack = useMemo(() => {
    const sesuaiStatus = items.filter(
      (item) => filterStatus === "SEMUA" || item.status === filterStatus
    );
    const terpetakan = sesuaiStatus.filter((item) => item.rack != null).length;
    return {
      total: sesuaiStatus.length,
      terpetakan,
      belum: sesuaiStatus.length - terpetakan,
    };
  }, [filterStatus, items]);

  const jumlahHalaman = Math.max(1, Math.ceil(hasil.length / JUMLAH_PER_HALAMAN));
  const halamanAktif = Math.min(halaman, jumlahHalaman);
  const itemHalaman = hasil.slice(
    (halamanAktif - 1) * JUMLAH_PER_HALAMAN,
    halamanAktif * JUMLAH_PER_HALAMAN
  );

  function bukaTambah() {
    if (!penulisanTersedia) return;
    setItemDiedit(null);
    setForm(FORM_AWAL);
    setError(null);
    setErrorForm(null);
    setDialogTerbuka(true);
  }

  function bukaEdit(item: MasterDataItem) {
    if (!penulisanTersedia) return;
    setItemDiedit(item);
    setForm({
      kategori: item.kategori,
      material_number: item.material_number,
      rack: item.rack == null ? "" : String(item.rack),
      klasifikasi: item.klasifikasi,
      area: item.area,
      nama_barang: item.nama_barang,
      lokasi: item.lokasi,
      status: item.status,
    });
    setError(null);
    setErrorForm(null);
    setDialogTerbuka(true);
  }

  function pilihRack(value: string) {
    const rackTerpilih = racks.find((item) => String(item.rack) === value);
    setForm((sekarang) => ({
      ...sekarang,
      rack: value,
      area: rackTerpilih?.area ?? sekarang.area,
    }));
  }

  async function pantauMirror(id: string, pesanSukses: string) {
    const watch = ++mirrorWatchRef.current;
    const jeda = [750, 1_250, 2_000, 3_000];

    for (const milliseconds of jeda) {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
      if (watch !== mirrorWatchRef.current) return;

      try {
        const response = await fetch(
          `/api/master-data/${encodeURIComponent(id)}/mirror-status`,
          { cache: "no-store" }
        );
        if (!response.ok) continue;
        const data = (await response.json().catch(() => null)) as MirrorStatusResponse | null;
        if (data?.mirror?.status === "synced") {
          setPeringatan(null);
          setPesan(`${pesanSukses} Google Sheets juga sudah berhasil diperbarui.`);
          return;
        }
        if (data?.mirror?.status === "failed") {
          setPesan(null);
          setPeringatan(
            `${pesanSukses} Namun sinkronisasi Google Sheets gagal${data.mirror.error ? ` (${data.mirror.error})` : ""}. Data database tidak perlu dikirim ulang.`
          );
          return;
        }
      } catch {
        // Gangguan status tidak mengubah hasil simpan utama; coba lagi sesuai jadwal.
      }
    }

    if (watch === mirrorWatchRef.current) {
      setPesan(
        `${pesanSukses} Sinkronisasi Google Sheets masih berjalan atau belum dapat dikonfirmasi. Jangan kirim ulang data; periksa kembali spreadsheet.`
      );
    }
  }

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mirrorWatchRef.current += 1;
    setErrorForm(null);
    setPesan(null);

    const rack = Number(form.rack);
    if (!form.material_number.trim()) {
      setErrorForm("Material number wajib diisi.");
      return;
    }
    if (!form.nama_barang.trim()) {
      setErrorForm("Nama barang wajib diisi.");
      return;
    }
    if (!Number.isInteger(rack) || rack <= 0) {
      setErrorForm("Rack wajib dipilih.");
      return;
    }
    if (!form.area.trim()) {
      setErrorForm("Area wajib dipilih.");
      return;
    }

    setMenyimpan(true);
    try {
      const url = itemDiedit
        ? `/api/master-data/${encodeURIComponent(String(itemDiedit.id))}`
        : "/api/master-data";
      const response = await fetch(url, {
        method: itemDiedit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori: form.kategori.trim(),
          material_number: form.material_number.trim(),
          rack,
          klasifikasi: form.klasifikasi.trim(),
          area: form.area.trim(),
          nama_barang: form.nama_barang.trim(),
          lokasi: form.lokasi.trim(),
          status: form.status,
        }),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(pesanRespons(data, "Master data gagal disimpan."));

      // Penyimpanan berhasil, tetapi penyelarasan jurnal/laporan bulanan di
      // spreadsheet bisa gagal terpisah. Itu peringatan, bukan kegagalan simpan —
      // materialnya sudah tersimpan dan tidak boleh diedit ulang karena panik.
      const peringatan =
        data && typeof data === "object" && "warning" in data && typeof data.warning === "string"
          ? data.warning
          : null;
      const mirrorQueued = statusMirror(data) === "queued";
      const mirrorItemId = idItemRespons(data);
      const pesanSukses = itemDiedit
        ? "Perubahan material berhasil disimpan."
        : "Material baru berhasil ditambahkan.";

      setDialogTerbuka(false);
      setPeringatan(peringatan);
      setPesan(
        peringatan
          ? null
          : mirrorQueued
            ? `${pesanSukses} Proses sinkronisasi Google Sheets sudah dimulai di latar dan belum dikonfirmasi selesai.`
            : pesanSukses
      );
      if (mirrorQueued && mirrorItemId) void pantauMirror(mirrorItemId, pesanSukses);
      await muatData(false);
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "Master data gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function nonaktifkan(item: MasterDataItem) {
    if (!penulisanTersedia) return;
    const disetujui = window.confirm(
      `Nonaktifkan ${item.nama_barang}? Material akan disembunyikan dari pilihan transaksi, tetapi barisnya tetap tersimpan.`
    );
    if (!disetujui) return;

    mirrorWatchRef.current += 1;
    setError(null);
    setPesan(null);
    setPeringatan(null);
    try {
      const response = await fetch(`/api/master-data/${encodeURIComponent(String(item.id))}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(pesanRespons(data, "Material gagal dinonaktifkan."));
      const mirrorWarning =
        data && typeof data === "object" && "warning" in data && typeof data.warning === "string"
          ? data.warning
          : null;
      const mirrorQueued = statusMirror(data) === "queued";
      const mirrorItemId = idItemRespons(data);
      setItems((sekarang) =>
        sekarang.map((nilai) =>
          String(nilai.id) === String(item.id) ? { ...nilai, status: "NONAKTIF" } : nilai
        )
      );
      setPeringatan(mirrorWarning);
      setPesan(
        mirrorWarning
          ? null
          : mirrorQueued
            ? `${item.nama_barang} sudah dinonaktifkan di database. Proses sinkronisasi Google Sheets sudah dimulai di latar dan belum dikonfirmasi selesai.`
            : `${item.nama_barang} sudah dinonaktifkan.`
      );
      if (mirrorQueued && mirrorItemId) {
        void pantauMirror(mirrorItemId, `${item.nama_barang} sudah dinonaktifkan di database.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Material gagal dinonaktifkan.");
    }
  }

  const rackTersedia = racks.length > 0;
  const penulisanTersedia =
    rackTersedia &&
    !gagalMuat &&
    (kondisiMaster === "siap" || (source === "sheets" && kondisiMaster === "kosong"));

  if (memuat) {
    return (
      <div
        className="card-surface flex min-h-64 flex-col items-center justify-center px-4 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin text-brand-dark" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink">Menyiapkan Master Data</p>
        <p className="mt-1 text-xs text-muted">
          Membaca material dari {source === "postgres" ? "database Postgres" : "Google Sheets"}
          dan daftar Rack secara bersamaan…
        </p>
      </div>
    );
  }

  // Daftar gagal dimuat DAN belum ada data sama sekali: jangan tampilkan kartu
  // ringkasan bernilai 0 atau "Material tidak ditemukan". Angka nol itu menyesatkan
  // — admin bisa mengira master data memang kosong lalu menambah ulang material
  // yang sebenarnya sudah ada di spreadsheet, sehingga terjadi duplikat.
  if (gagalMuat && items.length === 0) {
    const jenis = jenisGangguan(gagalMuat, source);
    const konfigurasiSumber = source === null;
    const judul =
      jenis === "konfigurasi"
        ? "Integrasi Master Data belum dikonfigurasi"
        : jenis === "database"
          ? "Database Master Data belum siap"
          : "Sumber Master Data sedang tidak tersedia";
    const penjelasan =
      jenis === "konfigurasi"
        ? konfigurasiSumber
          ? sourceConfigReason === "INVALID"
            ? "Nilai MASTER_SOURCE tidak dikenali. Aplikasi tidak memilih sumber secara otomatis agar tidak membaca database yang salah."
            : "MASTER_SOURCE belum diisi. Aplikasi tidak memilih sumber secara otomatis agar tidak menampilkan data kosong yang menyesatkan."
          : "Server belum memiliki konfigurasi Google Sheets yang dibutuhkan untuk membaca Master Data."
        : jenis === "database"
          ? "Aplikasi terhubung ke Postgres, tetapi tabel atau skema Master Data belum dapat dibaca."
          : gagalMuat.pesan;
    return (
      <div className="card-surface px-4 py-10 sm:px-6" role="alert" aria-live="assertive">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <span className="rounded-full bg-destructive/10 p-3 text-destructive" aria-hidden="true">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">{judul}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{penjelasan}</p>

          {jenis === "konfigurasi" ? (
            <div className="mt-5 w-full rounded-lg border border-border bg-bg p-4 text-left">
              <p className="text-sm font-semibold text-ink">Cara memperbaiki</p>
              {konfigurasiSumber ? (
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Di Vercel → Settings → Environment Variables, isi{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">MASTER_SOURCE</code>
                  {" "}dengan <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">postgres</code>
                  {" "}setelah backfill selesai, atau <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">sheets</code>
                  {" "}untuk memakai Google Sheets secara langsung. Setelah itu lakukan Redeploy.
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Di Vercel → Settings → Environment Variables, isi{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">GOOGLE_SHEETS_API_URL</code>
                  {" "}dan <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">GOOGLE_SHEETS_API_SECRET</code>,
                  lalu Redeploy. Pastikan URL-nya adalah deployment Apps Script yang aktif.
                </p>
              )}
            </div>
          ) : null}

          {jenis === "database" ? (
            <div className="mt-5 w-full rounded-lg border border-border bg-bg p-4 text-left">
              <p className="text-sm font-semibold text-ink">Yang perlu diperiksa</p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Pastikan migration tabel <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">master_items</code>
                {" "}sudah dijalankan di Supabase. Setelah tabel tersedia, lakukan backfill sebelum
                mengaktifkan sumber Postgres.
              </p>
            </div>
          ) : null}

          <p className="mt-5 text-sm font-medium text-ink">
            Angka ringkasan sengaja tidak ditampilkan karena isi sumber belum dapat dipastikan.
            Jangan menambah material sampai daftar lama berhasil muncul agar tidak terjadi duplikat.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => {
              if (konfigurasiSumber) {
                window.location.reload();
              } else {
                void muatData(false);
              }
            }}
            disabled={menyegarkan}
          >
            {menyegarkan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {konfigurasiSumber ? "Muat ulang halaman" : "Coba muat ulang"}
          </Button>
        </div>
      </div>
    );
  }

  // Respons Postgres yang sukses tetapi kosong pada aplikasi yang sebelumnya
  // memakai spreadsheet hampir selalu berarti backfill belum dijalankan. Jangan
  // samakan keadaan ini dengan Master Data baru yang memang kosong.
  if (!gagalMuat && kondisiMaster === "perlu-backfill") {
    return (
      <div className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-10 sm:px-6" role="alert">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="rounded-full bg-gold/20 p-3 text-gold-ink" aria-hidden="true">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">Master Data Postgres belum diisi</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Database berhasil dihubungi, tetapi tabel Master Data belum berisi material. Ini berbeda
            dari hasil pencarian kosong dan biasanya berarti proses pemindahan data dari Google Sheets
            belum dijalankan.
          </p>
          <div className="mt-5 w-full rounded-lg border border-gold/40 bg-surface p-4 text-left">
            <p className="text-sm font-semibold text-ink">Langkah administrator</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted">
              <li>Pastikan migration tabel Master Data sudah terpasang di Supabase.</li>
              <li>
                Jalankan <code className="rounded bg-bg px-1.5 py-0.5 text-xs font-semibold text-ink">npm run backfill:master</code> untuk menyalin data lama.
              </li>
              <li>Periksa jumlah material hasil backfill, lalu muat ulang halaman ini.</li>
            </ol>
          </div>
          <p className="mt-5 text-sm font-medium text-ink">
            Ringkasan “0 material” dan tombol tambah disembunyikan sementara untuk mencegah data ganda.
          </p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => void muatData(false)} disabled={menyegarkan}>
            {menyegarkan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Periksa kembali
          </Button>
        </div>
      </div>
    );
  }

  // Pada mode Sheets, respons `items: []` adalah hasil kosong yang sah: sumber
  // berhasil dibaca. Tetap gunakan empty-state tersendiri, bukan kartu angka 0.
  if (!gagalMuat && kondisiMaster === "kosong") {
    return (
      <div className="card-surface px-4 py-10 sm:px-6" role="status" aria-live="polite">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <span className="rounded-full bg-brand-light p-3 text-brand-dark" aria-hidden="true">
            <Database className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Master Data memang masih kosong</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Google Sheets berhasil dibaca dan mengonfirmasi belum ada material. Ini bukan kegagalan
            koneksi atau hasil filter pencarian.
          </p>
          {gagalRack ? (
            <Alert variant="warning" className="mt-5 w-full text-left">
              {gagalRack.pesan} Material pertama belum dapat ditambahkan sampai daftar Rack tersedia.
            </Alert>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={bukaTambah} disabled={!penulisanTersedia}>
              <Plus /> Tambah Material Pertama
            </Button>
            <Button type="button" variant="outline" onClick={() => void muatData(false)} disabled={menyegarkan}>
              {menyegarkan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Perbarui
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Gagal memuat tapi data lama masih ada di layar: beri peringatan bahwa
          yang tampil mungkin sudah basi, tanpa menghapus isinya. */}
      {gagalMuat && items.length > 0 ? (
        <Alert variant="warning" aria-live="assertive">
          {gagalMuat.pesan} Daftar di bawah adalah data terakhir yang berhasil dimuat, jadi mungkin
          sudah tidak mutakhir. Tambah, edit, dan nonaktifkan material dikunci sampai tombol Perbarui
          berhasil memuat data terbaru.
        </Alert>
      ) : null}
      {gagalRack ? (
        <Alert variant="warning" aria-live="assertive">
          <p className="font-semibold">Daftar Rack belum dapat dipastikan</p>
          <p className="mt-1">
            {gagalRack.kode === "NOT_CONFIGURED"
              ? "Integrasi Google Sheets untuk membaca daftar Rack belum dikonfigurasi."
              : gagalRack.pesan}{" "}
            {rackTersedia
              ? "Daftar Rack terakhir tetap ditampilkan dan mungkin belum mutakhir."
              : "Tambah dan edit material dinonaktifkan sementara; data yang sudah ada tetap dapat dilihat."}
          </p>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive" aria-live="assertive">{error}</Alert> : null}
      {peringatan ? <Alert variant="warning" aria-live="assertive">{peringatan}</Alert> : null}
      {pesan ? <Alert variant="info" aria-live="polite">{pesan}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Ringkasan pemetaan rack">
        <div className="card-surface p-4">
          <p className="text-xs font-medium text-muted">Material pada status terpilih</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {ringkasanRack.total.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="card-surface flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium text-muted">Rack sudah dipetakan</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">
              {ringkasanRack.terpetakan.toLocaleString("id-ID")}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-brand-dark" aria-hidden="true" />
        </div>
        <div className="rounded-xl border border-gold/50 bg-gold/10 p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-gold-ink">Rack belum dipetakan</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gold-ink">
                {ringkasanRack.belum.toLocaleString("id-ID")}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-gold-ink" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="card-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cari-master">Cari material</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="cari-master"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama, material number, rack, area…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="xl:w-44">
            <Label>Status</Label>
            <div className="mt-1.5">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
                <SelectTrigger aria-label="Filter status material"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIF">Aktif</SelectItem>
                  <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
                  <SelectItem value="SEMUA">Semua status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="xl:w-52">
            <Label>Pemetaan Rack</Label>
            <div className="mt-1.5">
              <Select value={filterRack} onValueChange={(value) => setFilterRack(value as typeof filterRack)}>
                <SelectTrigger aria-label="Filter pemetaan rack"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA">Semua pemetaan</SelectItem>
                  <SelectItem value="TERPETAKAN">Sudah dipetakan</SelectItem>
                  <SelectItem value="BELUM">Belum dipetakan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void muatData(false)} disabled={menyegarkan}>
              {menyegarkan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Perbarui
            </Button>
            <Button
              type="button"
              onClick={bukaTambah}
              disabled={!penulisanTersedia}
              title={!penulisanTersedia ? "Data terbaru dan daftar Rack harus tersedia sebelum menambah material." : undefined}
            >
              <Plus />
              Tambah Material
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted" aria-live="polite">
          Menampilkan {hasil.length.toLocaleString("id-ID")} dari {items.length.toLocaleString("id-ID")} material.
          Status kosong pada data lama diperlakukan sebagai Aktif.
        </p>
      </div>

      {itemHalaman.length === 0 ? (
        <div className="card-surface flex flex-col items-center px-4 py-12 text-center">
          <Database className="h-8 w-8 text-muted" />
          <h2 className="mt-3 text-base font-semibold">Material tidak ditemukan</h2>
          <p className="mt-1 text-sm text-muted">Coba ubah pencarian, filter status, atau filter rack.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {itemHalaman.map((item) => (
              <article
                key={String(item.id)}
                className={item.rack == null ? "rounded-xl border border-gold/50 bg-gold/5 p-4 shadow-card" : "card-surface p-4"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">No. {item.no} · {item.material_number || "Tanpa material number"}</p>
                    <div className="mt-1 flex items-start gap-1.5">
                      <h2 className="font-semibold leading-snug text-ink">{item.nama_barang}</h2>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-mt-2 h-9 w-9"
                        onClick={() => bukaEdit(item)}
                        disabled={!penulisanTersedia}
                        title={!penulisanTersedia ? "Muat data terbaru dan daftar Rack sebelum mengedit." : undefined}
                        aria-label={`Edit ${item.nama_barang}`}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </div>
                  <Badge variant={item.status === "AKTIF" ? "default" : "outline"}>{item.status}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                  <div><dt className="text-xs text-muted">Kategori</dt><dd className="mt-0.5">{item.kategori || "—"}</dd></div>
                  <div><dt className="text-xs text-muted">Klasifikasi</dt><dd className="mt-0.5">{item.klasifikasi || "—"}</dd></div>
                  <div>
                    <dt className="text-xs text-muted">Rack / Area</dt>
                    <dd className="mt-0.5">
                      {item.rack == null ? (
                        <Badge variant="outline" className="border-gold/60 bg-gold/10 text-gold-ink">Belum dipetakan</Badge>
                      ) : (
                        `${item.rack} / ${item.area || "—"}`
                      )}
                    </dd>
                  </div>
                  <div><dt className="text-xs text-muted">Lokasi</dt><dd className="mt-0.5">{item.lokasi || "—"}</dd></div>
                </dl>
                {item.status === "AKTIF" ? (
                  <Button type="button" variant="ghost" size="sm" className="mt-3 text-destructive hover:text-destructive" onClick={() => void nonaktifkan(item)} disabled={!penulisanTersedia}>
                    <CircleOff /> Nonaktifkan
                  </Button>
                ) : null}
              </article>
            ))}
          </div>

          <div className="card-surface hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>No.</TableHead>
                  <TableHead>Material Number</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Klasifikasi</TableHead>
                  <TableHead>Rack</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemHalaman.map((item) => (
                  <TableRow
                    key={String(item.id)}
                    className={[
                      item.rack == null ? "bg-gold/5" : "",
                      item.status === "NONAKTIF" ? "opacity-60" : "",
                    ].filter(Boolean).join(" ") || undefined}
                  >
                    <TableCell className="tabular-nums text-muted">{item.no}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{item.material_number || "—"}</TableCell>
                    <TableCell className="min-w-64 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {item.nama_barang}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => bukaEdit(item)}
                          disabled={!penulisanTersedia}
                          title={!penulisanTersedia ? "Muat data terbaru dan daftar Rack sebelum mengedit." : undefined}
                          aria-label={`Edit ${item.nama_barang}`}
                        >
                          <Pencil />
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell>{item.kategori || "—"}</TableCell>
                    <TableCell>{item.klasifikasi || "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {item.rack == null ? (
                        <Badge variant="outline" className="whitespace-nowrap border-gold/60 bg-gold/10 text-gold-ink">Belum dipetakan</Badge>
                      ) : item.rack}
                    </TableCell>
                    <TableCell className="min-w-40">{item.rack == null ? "Perlu dipilih" : item.area || "—"}</TableCell>
                    <TableCell>{item.lokasi || "—"}</TableCell>
                    <TableCell><Badge variant={item.status === "AKTIF" ? "default" : "outline"}>{item.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {item.status === "AKTIF" ? (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void nonaktifkan(item)} disabled={!penulisanTersedia}>
                          <CircleOff /> Nonaktifkan
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => bukaEdit(item)}
                          disabled={!penulisanTersedia}
                          title={!penulisanTersedia ? "Muat data terbaru dan daftar Rack sebelum mengubah status." : undefined}
                        >
                          Ubah status
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {jumlahHalaman > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row">
          <p className="text-sm text-muted">Halaman {halamanAktif} dari {jumlahHalaman}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={halamanAktif <= 1} onClick={() => setHalaman((nilai) => Math.max(1, nilai - 1))}>
              <ChevronLeft /> Sebelumnya
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={halamanAktif >= jumlahHalaman} onClick={() => setHalaman((nilai) => Math.min(jumlahHalaman, nilai + 1))}>
              Berikutnya <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogTerbuka} onOpenChange={(terbuka) => !menyimpan && setDialogTerbuka(terbuka)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={simpan} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{itemDiedit ? "Edit Material" : "Tambah Material"}</DialogTitle>
              <DialogDescription>
                Nomor urut diisi otomatis mengikuti posisi baris. Area terisi dari rack dan masih dapat diganti.
              </DialogDescription>
            </DialogHeader>

            {errorForm ? <Alert variant="destructive" aria-live="assertive">{errorForm}</Alert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="master-material-number">Material Number <span className="text-destructive">*</span></Label>
                <Input id="master-material-number" value={form.material_number} onChange={(event) => setForm((nilai) => ({ ...nilai, material_number: event.target.value }))} className="mt-1.5" maxLength={100} required />
              </div>
              <div>
                <Label htmlFor="master-nama">Nama Barang <span className="text-destructive">*</span></Label>
                <Input id="master-nama" value={form.nama_barang} onChange={(event) => setForm((nilai) => ({ ...nilai, nama_barang: event.target.value }))} className="mt-1.5" maxLength={200} required />
              </div>
              <div>
                <Label htmlFor="master-kategori">Kategori</Label>
                <Input id="master-kategori" value={form.kategori} onChange={(event) => setForm((nilai) => ({ ...nilai, kategori: event.target.value }))} className="mt-1.5" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="master-klasifikasi">Klasifikasi</Label>
                <Input id="master-klasifikasi" value={form.klasifikasi} onChange={(event) => setForm((nilai) => ({ ...nilai, klasifikasi: event.target.value }))} className="mt-1.5" maxLength={120} />
              </div>
              <div>
                <Label>Rack <span className="text-destructive">*</span></Label>
                <div className="mt-1.5">
                  <Select value={form.rack} onValueChange={pilihRack}>
                    <SelectTrigger aria-label="Pilih rack"><SelectValue placeholder="Pilih nomor rack" /></SelectTrigger>
                    <SelectContent>
                      {racks.map((item) => <SelectItem key={item.rack} value={String(item.rack)}>Rack {item.rack} — {item.area}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Area <span className="text-destructive">*</span></Label>
                <div className="mt-1.5">
                  <Select value={form.area} onValueChange={(area) => setForm((nilai) => ({ ...nilai, area }))}>
                    <SelectTrigger aria-label="Pilih area"><SelectValue placeholder="Pilih area" /></SelectTrigger>
                    <SelectContent>
                      {daftarArea.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1.5 text-xs text-muted">Otomatis mengikuti rack, tetapi dapat dioverride.</p>
              </div>
              <div>
                <Label htmlFor="master-lokasi">Lokasi</Label>
                <Input id="master-lokasi" value={form.lokasi} onChange={(event) => setForm((nilai) => ({ ...nilai, lokasi: event.target.value }))} className="mt-1.5" maxLength={120} />
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-1.5">
                  <Select value={form.status} onValueChange={(status) => setForm((nilai) => ({ ...nilai, status: status as StatusMaterial }))}>
                    <SelectTrigger aria-label="Pilih status material"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AKTIF">AKTIF</SelectItem>
                      <SelectItem value="NONAKTIF">NONAKTIF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogTerbuka(false)} disabled={menyimpan}>Batal</Button>
              <Button type="submit" disabled={menyimpan}>
                {menyimpan ? <Loader2 className="animate-spin" /> : null}
                {menyimpan ? "Menyimpan…" : "Simpan Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
