"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  Download,
  FileText,
  PackageMinus,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ChipSelisih } from "@/components/dashboard/chip-selisih";
import { KpiSection } from "@/components/dashboard/kpi-section";
import { RingProgres } from "@/components/dashboard/ring-progres";
import { gayaTooltip, useLayarKecil, useWarnaGrafik } from "@/components/dashboard/warna-grafik";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BarisKeluar } from "@/lib/dashboard";
import { labelBulan, type KpiMuat } from "@/lib/kpi/definitions";
import { cn, tanggalIsoWib, tanggalJamIndonesia } from "@/lib/utils";

type Granularitas = "harian" | "bulanan";

const TANPA_KATEGORI = "Tanpa kategori";

function formatTanggalSumbu(kunci: string, granularitas: Granularitas) {
  if (granularitas === "bulanan") {
    const [th, bl] = kunci.split("-");
    const nama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${nama[Number(bl) - 1]} ${th}`;
  }
  const [, bl, hr] = kunci.split("-");
  return `${hr}/${bl}`;
}

type Ringkasan = {
  diberikan: number;
  diminta: number;
  jumlahSurat: number;
  userAktif: number;
  /** Σ diberikan ÷ Σ diminta × 100. `null` bila belum ada permintaan sama sekali. */
  pemenuhan: number | null;
};

function ringkas(baris: BarisKeluar[]): Ringkasan {
  const diberikan = baris.reduce((n, b) => n + b.jumlah_diberikan, 0);
  const diminta = baris.reduce((n, b) => n + b.jumlah_permintaan, 0);
  return {
    diberikan,
    diminta,
    jumlahSurat: new Set(baris.map((b) => b.request_id)).size,
    userAktif: new Set(baris.map((b) => b.user_id)).size,
    pemenuhan: diminta > 0 ? (diberikan / diminta) * 100 : null,
  };
}

function persen(nilai: number | null, desimal = 2) {
  if (nilai === null) return "—";
  return `${nilai.toLocaleString("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  })}%`;
}

/** Penilaian sederhana berbasis tingkat pemenuhan permintaan. */
function verdikPemenuhan(nilai: number | null) {
  if (nilai === null) return { label: "Belum ada data", nada: "netral" as const };
  if (nilai >= 95) return { label: "Sangat baik", nada: "baik" as const };
  if (nilai >= 85) return { label: "Baik", nada: "baik" as const };
  if (nilai >= 70) return { label: "Perlu perhatian", nada: "sedang" as const };
  return { label: "Perlu tindakan", nada: "buruk" as const };
}

function StatRingkas({
  label,
  nilai,
  satuan,
  icon: Icon,
  selisih,
  labelPembanding,
}: {
  label: string;
  nilai: number;
  satuan: string;
  icon: typeof Boxes;
  selisih: number | null;
  labelPembanding: string | null;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="text-[11px] font-medium uppercase leading-tight tracking-wide text-muted">
          {label}
        </div>
      </div>
      <div>
        <div className="whitespace-nowrap text-2xl font-bold leading-tight text-ink">
          {nilai.toLocaleString("id-ID")}
          <span className="ml-1.5 text-sm font-medium text-muted">{satuan}</span>
        </div>
        <div className="mt-1 min-h-[16px]">
          {selisih !== null && labelPembanding ? (
            <ChipSelisih
              delta={selisih}
              membaik={selisih >= 0}
              satuan={satuan}
              keterangan={labelPembanding}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({ baris, kpi }: { baris: BarisKeluar[]; kpi: KpiMuat }) {
  const [dariTanggal, setDariTanggal] = useState("");
  const [sampaiTanggal, setSampaiTanggal] = useState("");
  const [kategoriPilih, setKategoriPilih] = useState<string[]>([]);
  const [lokasiPilih, setLokasiPilih] = useState("");
  const [granularitas, setGranularitas] = useState<Granularitas>("harian");
  const layarKecil = useLayarKecil();
  const w = useWarnaGrafik();
  const tooltipStyle = gayaTooltip(w);

  const daftarLokasi = useMemo(
    () => Array.from(new Set(baris.map((b) => b.lokasi_pekerjaan))).sort(),
    [baris]
  );
  const daftarKategori = useMemo(
    () =>
      Array.from(
        new Set(baris.map((b) => b.kategori_barang?.trim() || TANPA_KATEGORI))
      ).sort((a, b) => a.localeCompare(b, "id-ID")),
    [baris]
  );

  const terfilter = useMemo(() => {
    return baris.filter((b) => {
      const tgl = tanggalIsoWib(b.created_at);
      if (dariTanggal && tgl < dariTanggal) return false;
      if (sampaiTanggal && tgl > sampaiTanggal) return false;
      const kategoriBarang = b.kategori_barang?.trim() || TANPA_KATEGORI;
      if (kategoriPilih.length > 0 && !kategoriPilih.includes(kategoriBarang)) return false;
      if (lokasiPilih && b.lokasi_pekerjaan !== lokasiPilih) return false;
      return true;
    });
  }, [baris, dariTanggal, sampaiTanggal, kategoriPilih, lokasiPilih]);

  const total = useMemo(() => ringkas(terfilter), [terfilter]);

  /**
   * Pembanding antar bulan memakai bulan terakhir yang ada datanya versus bulan
   * berdata sebelumnya — bukan "30 hari terakhir" — supaya angkanya sejajar
   * dengan cara laporan bulanan gudang dibaca.
   */
  const perBulan = useMemo(() => {
    const peta = new Map<string, BarisKeluar[]>();
    for (const b of terfilter) {
      const kunci = tanggalIsoWib(b.created_at).slice(0, 7);
      const isi = peta.get(kunci);
      if (isi) isi.push(b);
      else peta.set(kunci, [b]);
    }
    return [...peta.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kunci, isi]) => ({ kunci, ringkasan: ringkas(isi) }));
  }, [terfilter]);

  const bulanTerakhir = perBulan.length > 0 ? perBulan[perBulan.length - 1] : null;
  const bulanSebelum = perBulan.length > 1 ? perBulan[perBulan.length - 2] : null;
  const labelPembanding = bulanSebelum ? labelBulan(bulanSebelum.kunci) : null;

  function selisih(ambil: (r: Ringkasan) => number | null): number | null {
    if (!bulanTerakhir || !bulanSebelum) return null;
    const sekarang = ambil(bulanTerakhir.ringkasan);
    const lalu = ambil(bulanSebelum.ringkasan);
    if (sekarang === null || lalu === null) return null;
    return sekarang - lalu;
  }

  const selisihPemenuhan = selisih((r) => r.pemenuhan);
  const verdik = verdikPemenuhan(total.pemenuhan);

  const topBarang = useMemo(() => {
    const peta = new Map<string, number>();
    for (const b of terfilter) peta.set(b.nama_barang, (peta.get(b.nama_barang) ?? 0) + b.jumlah);
    return [...peta.entries()]
      .map(([nama, jumlah]) => ({ nama, total: jumlah }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .reverse();
  }, [terfilter]);

  const tren = useMemo(() => {
    const peta = new Map<string, number>();
    for (const b of terfilter) {
      const tanggalWib = tanggalIsoWib(b.created_at);
      const kunci = granularitas === "bulanan" ? tanggalWib.slice(0, 7) : tanggalWib;
      peta.set(kunci, (peta.get(kunci) ?? 0) + b.jumlah);
    }
    return [...peta.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kunci, jumlah]) => ({
        kunci,
        label: formatTanggalSumbu(kunci, granularitas),
        total: jumlah,
      }));
  }, [terfilter, granularitas]);

  const perKategori = useMemo(() => {
    const peta = new Map<string, number>();
    for (const b of terfilter) {
      const k = b.kategori_barang?.trim() || TANPA_KATEGORI;
      peta.set(k, (peta.get(k) ?? 0) + b.jumlah);
    }
    return [...peta.entries()]
      .map(([nama, jumlah]) => ({ nama, total: jumlah }))
      .sort((a, b) => b.total - a.total);
  }, [terfilter]);

  const perLokasi = useMemo(() => {
    const peta = new Map<string, number>();
    for (const b of terfilter) {
      peta.set(b.lokasi_pekerjaan, (peta.get(b.lokasi_pekerjaan) ?? 0) + b.jumlah);
    }
    return [...peta.entries()]
      .map(([nama, jumlah]) => ({ nama, total: jumlah }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [terfilter]);

  const adaFilter = Boolean(dariTanggal || sampaiTanggal || kategoriPilih.length || lokasiPilih);
  const transaksiTerbaru = terfilter.length > 0 ? terfilter[0].created_at : null;

  function resetFilter() {
    setDariTanggal("");
    setSampaiTanggal("");
    setKategoriPilih([]);
    setLokasiPilih("");
  }

  function exportCsv() {
    const kepala = [
      "Tanggal",
      "Pekerjaan",
      "Lokasi Pekerjaan",
      "Pemohon",
      "Nama Barang",
      "Kategori Barang",
      "Satuan",
      "Jumlah Diminta",
      "Jumlah Diberikan",
    ];
    const sel = (v: string | number | null) => {
      const raw = String(v ?? "");
      // Cegah nilai buatan pengguna dieksekusi sebagai formula saat CSV dibuka di Excel/Sheets.
      const s = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const isi = terfilter.map((b) =>
      [
        b.created_at,
        b.pekerjaan,
        b.lokasi_pekerjaan,
        b.nama_pemohon ?? "",
        b.nama_barang,
        b.kategori_barang ?? "",
        b.satuan,
        b.jumlah_permintaan,
        b.jumlah_diberikan,
      ]
        .map(sel)
        .join(";")
    );

    // BOM supaya Excel membaca UTF-8 dengan benar.
    const blob = new Blob(["﻿" + [kepala.join(";"), ...isi].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wares-barang-keluar-${tanggalIsoWib()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted">
            Analitik barang keluar dari seluruh Surat Pengambilan Barang.
          </p>
        </div>
        {transaksiTerbaru ? (
          <div className="text-right text-xs leading-relaxed text-muted">
            Transaksi terakhir
            <br />
            <span className="font-medium text-ink">{tanggalJamIndonesia(transaksiTerbaru)}</span>
          </div>
        ) : null}
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/*
           * Filter dikelompokkan di kiri dengan lebar tetap yang wajar, aksi
           * dipatok di kanan. Susunan grid sebelumnya memberi kolom lokasi
           * `1fr` sehingga melar sampai ~586px di layar lebar — jauh lebih besar
           * dari isinya dan membuat baris ini terlihat timpang.
           */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <div className="lg:w-40">
                <Label htmlFor="dari">Dari tanggal</Label>
                <Input
                  id="dari"
                  type="date"
                  value={dariTanggal}
                  onChange={(e) => setDariTanggal(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="lg:w-40">
                <Label htmlFor="sampai">Sampai tanggal</Label>
                <Input
                  id="sampai"
                  type="date"
                  value={sampaiTanggal}
                  onChange={(e) => setSampaiTanggal(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2 lg:w-72">
                <Label htmlFor="lokasi-filter">Lokasi pekerjaan</Label>
                <select
                  id="lokasi-filter"
                  value={lokasiPilih}
                  onChange={(e) => setLokasiPilih(e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                >
                  <option value="">Semua lokasi</option>
                  {daftarLokasi.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 lg:shrink-0">
              <Button
                variant="outline"
                onClick={resetFilter}
                disabled={!adaFilter}
                className="flex-1 lg:flex-none"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={terfilter.length === 0}
                className="flex-1 lg:flex-none"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-xs uppercase tracking-wide text-muted">Kategori barang</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {daftarKategori.map((k) => {
                const aktif = kategoriPilih.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setKategoriPilih((prev) =>
                        prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                      aktif
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-border bg-surface text-muted hover:border-brand/40 hover:bg-brand-light hover:text-brand-dark"
                    )}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ringkasan utama */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted">
              Pemenuhan Permintaan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-center gap-5 pt-4 sm:justify-start">
            <RingProgres nilai={total.pemenuhan} ukuran={layarKecil ? 132 : 152} tebal={13}>
              <span className="text-2xl font-bold leading-none text-ink">
                {total.pemenuhan === null
                  ? "—"
                  : total.pemenuhan.toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                {total.pemenuhan === null ? "" : "%"}
              </span>
              <span className="mt-1 px-3 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted">
                dari yang diminta
              </span>
            </RingProgres>
            <div className="min-w-[7rem] space-y-2.5">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Diminta</div>
                <div className="text-base font-semibold text-ink">
                  {total.diminta.toLocaleString("id-ID")} unit
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Diberikan</div>
                <div className="text-base font-semibold text-ink">
                  {total.diberikan.toLocaleString("id-ID")} unit
                </div>
              </div>
              {selisihPemenuhan !== null && labelPembanding ? (
                <ChipSelisih
                  delta={selisihPemenuhan}
                  membaik={selisihPemenuhan >= 0}
                  satuan="%"
                  keterangan={labelPembanding}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatRingkas
              label="Total barang keluar"
              nilai={total.diberikan}
              satuan="unit"
              icon={Boxes}
              selisih={selisih((r) => r.diberikan)}
              labelPembanding={labelPembanding}
            />
            <StatRingkas
              label="Jumlah surat"
              nilai={total.jumlahSurat}
              satuan="surat"
              icon={FileText}
              selisih={selisih((r) => r.jumlahSurat)}
              labelPembanding={labelPembanding}
            />
            <StatRingkas
              label="User aktif"
              nilai={total.userAktif}
              satuan="orang"
              icon={Users}
              selisih={selisih((r) => r.userAktif)}
              labelPembanding={labelPembanding}
            />
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted">
              Ringkasan Performa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  verdik.nada === "baik"
                    ? "bg-brand-light text-brand-dark"
                    : verdik.nada === "sedang"
                      ? "bg-gold/20 text-gold-ink"
                      : verdik.nada === "buruk"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-bg text-muted"
                )}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-lg font-bold leading-tight",
                    verdik.nada === "baik"
                      ? "text-brand-dark"
                      : verdik.nada === "sedang"
                        ? "text-gold-ink"
                        : verdik.nada === "buruk"
                          ? "text-destructive"
                          : "text-muted"
                  )}
                >
                  {verdik.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {total.pemenuhan === null ? (
                    "Belum ada permintaan pada rentang filter ini."
                  ) : (
                    <>
                      {persen(total.pemenuhan, 1)} dari unit yang diminta berhasil diberikan.
                      {total.diminta > total.diberikan ? (
                        <>
                          {" "}
                          Kurang{" "}
                          <span className="font-semibold text-ink">
                            {(total.diminta - total.diberikan).toLocaleString("id-ID")} unit
                          </span>{" "}
                          dari yang diajukan.
                        </>
                      ) : (
                        " Seluruh permintaan terpenuhi."
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
              <PackageMinus className="h-3.5 w-3.5 shrink-0" />
              <span>
                {perBulan.length > 0
                  ? `${perBulan.length} bulan berdata pada filter ini.`
                  : "Belum ada bulan berdata."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {terfilter.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted">
              Tidak ada data pada rentang filter ini. Ubah filter atau tekan Reset.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Top 10 barang */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Barang Paling Banyak Keluar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, topBarang.length * (layarKecil ? 40 : 34))}
              >
                <BarChart
                  data={topBarang}
                  layout="vertical"
                  margin={{ left: layarKecil ? 0 : 8, right: layarKecil ? 12 : 24 }}
                >
                  <CartesianGrid horizontal={false} stroke={w.grid} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nama"
                    width={layarKecil ? 96 : 150}
                    tick={{ fontSize: layarKecil ? 9 : 11, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} unit`, "Keluar"]} />
                  <Bar dataKey="total" fill={w.seri[0]} radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tren */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Tren Barang Keluar</CardTitle>
              <div className="flex gap-1 rounded-lg bg-bg p-1">
                {(["harian", "bulanan"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularitas(g)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors",
                      granularitas === g ? "bg-surface text-brand-dark shadow-card" : "text-muted"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={layarKecil ? 240 : 300}>
                <LineChart data={tren} margin={{ left: 0, right: layarKecil ? 8 : 16 }}>
                  <CartesianGrid stroke={w.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} unit`, "Keluar"]} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={w.seri[0]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: w.seri[0] }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per kategori */}
          <Card>
            <CardHeader>
              <CardTitle>Barang Keluar per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={layarKecil ? 340 : 320}>
                <PieChart>
                  <Pie
                    data={perKategori}
                    dataKey="total"
                    nameKey="nama"
                    innerRadius={layarKecil ? 48 : 70}
                    outerRadius={layarKecil ? 78 : 110}
                    paddingAngle={2}
                    stroke={w.permukaan}
                    strokeWidth={2}
                  >
                    {perKategori.map((entry, i) => (
                      <Cell key={entry.nama} fill={w.seri[i % w.seri.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} unit`, "Keluar"]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per lokasi */}
          <Card>
            <CardHeader>
              <CardTitle>Barang Keluar per Lokasi Pekerjaan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={layarKecil ? 300 : 320}>
                <BarChart data={perLokasi} margin={{ left: 0, right: layarKecil ? 8 : 16 }}>
                  <CartesianGrid stroke={w.grid} vertical={false} />
                  <XAxis
                    dataKey="nama"
                    tick={{ fontSize: layarKecil ? 9 : 10, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={layarKecil ? 84 : 60}
                    angle={layarKecil ? -45 : -20}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: w.sumbu }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} unit`, "Keluar"]} />
                  <Bar dataKey="total" fill={w.seri[1]} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard KPI — sumber datanya spreadsheet, bukan transaksi di atas. */}
      <KpiSection muat={kpi} />

      {terfilter.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Transaksi Terbaru</CardTitle>
            <Badge variant="outline">{terfilter.length.toLocaleString("id-ID")} baris</Badge>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* Layar kecil: kartu ringkas, karena 7 kolom tidak terbaca kalau digeser. */}
            <div className="space-y-3 px-4 pb-1 md:hidden">
              {terfilter.slice(0, 25).map((b, i) => (
                <div
                  key={`m-${b.request_id}-${b.nama_barang}-${i}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-medium leading-snug text-ink">
                      {b.nama_barang}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-ink">
                      {b.jumlah_diberikan} {b.satuan}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <Badge variant="outline">{b.kategori_barang ?? "—"}</Badge>
                    <span>{b.lokasi_pekerjaan}</span>
                    <span aria-hidden>·</span>
                    <span>{tanggalJamIndonesia(b.created_at)}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-muted">
                    {b.pekerjaan}
                    {b.nama_pemohon ? ` — ${b.nama_pemohon}` : ""}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Tanggal</TableHead>
                    <TableHead>Barang</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Pekerjaan</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Pemohon</TableHead>
                    <TableHead className="text-right">Diminta</TableHead>
                    <TableHead className="pr-6 text-right">Diberikan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terfilter.slice(0, 25).map((b, i) => (
                    <TableRow key={`${b.request_id}-${b.nama_barang}-${i}`}>
                      <TableCell className="whitespace-nowrap pl-6 text-muted">
                        {tanggalJamIndonesia(b.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-ink">{b.nama_barang}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.kategori_barang ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted">{b.pekerjaan}</TableCell>
                      <TableCell className="text-muted">{b.lokasi_pekerjaan}</TableCell>
                      <TableCell className="text-muted">{b.nama_pemohon ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted">
                        {b.jumlah_permintaan} {b.satuan}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-6 text-right font-semibold">
                        {b.jumlah_diberikan} {b.satuan}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {terfilter.length > 25 ? (
              <div className="mt-3 border-t border-border px-4 py-3 text-xs text-muted sm:px-6">
                Menampilkan 25 dari {terfilter.length.toLocaleString("id-ID")} baris. Gunakan Export
                CSV untuk data lengkap.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
