"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Divide,
  RefreshCw,
  Table2,
} from "lucide-react";

import { ChipSelisih } from "@/components/dashboard/chip-selisih";
import { gayaTooltip, useLayarKecil, useWarnaGrafik } from "@/components/dashboard/warna-grafik";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatNilaiKpi,
  hitungKpi,
  hitungSatuKpi,
  jumlahkanBulan,
  KPI_FIELDS,
  KPI_UTAMA,
  labelBulan,
  labelBulanSingkat,
  rumusKpi,
  satuanKpi,
  selisihKpi,
  type KpiBulan,
  type KpiDataset,
  type KpiDefinition,
  type KpiHasil,
  type KpiMuat,
} from "@/lib/kpi/definitions";
import { cn, tanggalJamIndonesia } from "@/lib/utils";

const OVERALL = "overall";

/** Bulan dianggap terisi bila ada satu saja angka yang bukan nol. */
function punyaData(bulan: KpiBulan) {
  return KPI_FIELDS.some((field) => bulan.nilai[field] > 0);
}

function angkaMentah(nilai: number) {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

function tampilNilai(hasil: KpiHasil) {
  if (hasil.nilai === null) return { angka: "—", satuan: "" };
  return {
    angka: formatNilaiKpi(hasil),
    satuan: hasil.definisi.format === "hari" ? "hari" : "",
  };
}

function labelTarget(definisi: KpiDefinition, target: number) {
  const pembatas = definisi.arah === "tinggi-baik" ? "≥" : "≤";
  return `Target ${pembatas} ${target.toLocaleString("id-ID")}${satuanKpi(definisi) === "%" ? "%" : " hari"}`;
}

function targetTercapai(definisi: KpiDefinition, nilai: number, target: number) {
  return definisi.arah === "tinggi-baik" ? nilai >= target : nilai <= target;
}

export function KpiSection({ muat }: { muat: KpiMuat }) {
  const [muatLokal, setMuatLokal] = useState<KpiMuat>(muat);
  const [periode, setPeriode] = useState<string>(OVERALL);
  const [terbuka, setTerbuka] = useState<KpiDefinition | null>(null);
  const [memuat, setMemuat] = useState(false);

  const dataset: KpiDataset | null = muatLokal.ok ? muatLokal.data : null;

  const bulanBerdata = useMemo(
    () => (dataset?.bulan ?? []).filter(punyaData),
    [dataset]
  );

  // Bila bulan yang sedang dipilih hilang setelah pemuatan ulang, tampilan
  // otomatis kembali ke Overall alih-alih menampilkan periode kosong.
  const periodeEfektif =
    periode !== OVERALL && bulanBerdata.some((b) => b.bulan === periode) ? periode : OVERALL;

  const bulanTerpilih = useMemo(
    () =>
      periodeEfektif === OVERALL
        ? bulanBerdata
        : bulanBerdata.filter((b) => b.bulan === periodeEfektif),
    [bulanBerdata, periodeEfektif]
  );

  const hasil = useMemo(() => hitungKpi(bulanTerpilih), [bulanTerpilih]);

  // Pembanding hanya masuk akal untuk satu bulan; Overall sudah menggabungkan semuanya.
  const pembanding = useMemo(() => {
    if (periodeEfektif === OVERALL) return null;
    const indeks = bulanBerdata.findIndex((b) => b.bulan === periodeEfektif);
    return indeks > 0 ? bulanBerdata[indeks - 1] : null;
  }, [bulanBerdata, periodeEfektif]);

  const hasilPembanding = useMemo(
    () => (pembanding ? hitungKpi([pembanding]) : null),
    [pembanding]
  );

  async function muatUlang() {
    setMemuat(true);
    try {
      const response = await fetch("/api/kpi?refresh=1", { cache: "no-store" });
      const isi = await response.json();
      if (!response.ok) {
        setMuatLokal({
          ok: false,
          kode: typeof isi?.code === "string" ? isi.code : "UNKNOWN",
          pesan: typeof isi?.error === "string" ? isi.error : "Data KPI gagal dimuat ulang.",
        });
        return;
      }
      setMuatLokal({ ok: true, data: isi as KpiDataset });
    } catch {
      setMuatLokal({
        ok: false,
        kode: "NETWORK",
        pesan: "Tidak dapat menghubungi server untuk memuat ulang data KPI.",
      });
    } finally {
      setMemuat(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Dashboard KPI Warehouse</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Delapan KPI inti manajemen sparepart. Angkanya diisi admin di sheet{" "}
            <span className="font-medium text-ink">
              &laquo;{dataset?.sheetName ?? "Dashboard KPI"}&raquo;
            </span>{" "}
            pada Google Spreadsheet, lalu dihitung ulang di sini dengan rumus yang sama.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            aria-label="Periode KPI"
            value={periodeEfektif}
            onChange={(e) => setPeriode(e.target.value)}
            disabled={bulanBerdata.length === 0}
            className="flex h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
          >
            <option value={OVERALL}>Overall</option>
            {bulanBerdata.map((b) => (
              <option key={b.bulan} value={b.bulan}>
                {labelBulan(b.bulan)}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={muatUlang} disabled={memuat}>
            <RefreshCw className={cn("h-4 w-4", memuat && "animate-spin")} />
            {memuat ? "Memuat" : "Muat ulang"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!muatLokal.ok ? (
          <Alert variant="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Dashboard KPI belum dapat dimuat.</p>
                <p className="mt-0.5">{muatLokal.pesan}</p>
                {muatLokal.kode === "KPI_SHEET_MISSING" ? (
                  <p className="mt-1.5">
                    Buka Apps Script pada spreadsheet, lalu jalankan fungsi{" "}
                    <code className="rounded bg-gold/20 px-1 py-0.5 font-mono text-[11px]">
                      setupDashboardKpi
                    </code>{" "}
                    satu kali untuk membuat sheet beserta rumusnya.
                  </p>
                ) : null}
              </div>
            </div>
          </Alert>
        ) : bulanBerdata.length === 0 ? (
          <Alert variant="info">
            <div className="flex items-start gap-2">
              <Table2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Belum ada angka KPI yang diisi.</p>
                <p className="mt-0.5">
                  Isi kolom di sisi kiri sheet &laquo;{dataset?.sheetName}&raquo; mulai baris{" "}
                  Juli 2026, lalu tekan Muat ulang. Yang diisi adalah angka mentahnya
                  (pembilang dan penyebut) — persentasenya dihitung otomatis.
                </p>
              </div>
            </div>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge variant="solid">
                {periodeEfektif === OVERALL ? "Overall" : labelBulan(periodeEfektif)}
              </Badge>
              <span>
                {periodeEfektif === OVERALL
                  ? `${bulanBerdata.length} bulan digabung — pembilang dan penyebut dijumlahkan lebih dulu, baru dibagi.`
                  : pembanding
                    ? `Dibandingkan dengan ${labelBulan(pembanding.bulan)}.`
                    : "Belum ada bulan sebelumnya untuk dibandingkan."}
              </span>
              {dataset ? (
                <span className="ml-auto">
                  Diperbarui {tanggalJamIndonesia(dataset.generatedAt)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hasil.map((item, index) => (
                <KartuKpi
                  key={item.definisi.id}
                  hasil={item}
                  selisih={selisihKpi(item, hasilPembanding?.[index])}
                  labelPembanding={pembanding ? labelBulanSingkat(pembanding.bulan) : null}
                  target={dataset?.target[item.definisi.id]}
                  utama={(KPI_UTAMA as readonly string[]).includes(item.definisi.id)}
                  onBuka={() => setTerbuka(item.definisi)}
                />
              ))}
            </div>

            {hasil.some((item) => item.anomali) ? (
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Ada isian yang perlu diperiksa.</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {hasil
                        .filter((item) => item.anomali)
                        .map((item) => (
                          <li key={item.definisi.id}>{item.anomali}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>

      <DialogDetailKpi
        definisi={terbuka}
        bulanBerdata={bulanBerdata}
        bulanTerpilih={bulanTerpilih}
        labelPeriode={periodeEfektif === OVERALL ? "Overall" : labelBulan(periodeEfektif)}
        target={terbuka ? dataset?.target[terbuka.id] : undefined}
        onTutup={() => setTerbuka(null)}
      />
    </Card>
  );
}

function KartuKpi({
  hasil,
  selisih,
  labelPembanding,
  target,
  utama,
  onBuka,
}: {
  hasil: KpiHasil;
  selisih: { delta: number; membaik: boolean } | null;
  labelPembanding: string | null;
  target?: number;
  utama: boolean;
  onBuka: () => void;
}) {
  const { definisi } = hasil;
  const { angka, satuan } = tampilNilai(hasil);
  const ArahIkon = definisi.arah === "tinggi-baik" ? ArrowUpRight : ArrowDownRight;
  const tercapai =
    target != null && hasil.nilai !== null ? targetTercapai(definisi, hasil.nilai, target) : null;

  return (
    <button
      type="button"
      onClick={onBuka}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-surface p-4 text-left transition-all",
        "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        utama ? "border-brand/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-light text-[11px] font-bold text-brand-dark">
          {definisi.nomor}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted"
          title={
            definisi.arah === "tinggi-baik"
              ? "Semakin tinggi semakin baik"
              : "Semakin rendah semakin baik"
          }
        >
          <ArahIkon className="h-3.5 w-3.5" aria-hidden />
          {definisi.arah === "tinggi-baik" ? "Makin tinggi" : "Makin rendah"}
        </span>
      </div>

      <div className="mt-2.5 text-xs font-semibold uppercase leading-tight tracking-wide text-muted">
        {definisi.nama}
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold leading-none text-ink">{angka}</span>
          {satuan ? <span className="text-sm font-medium text-muted">{satuan}</span> : null}
        </div>

        <div className="mt-2 min-h-[18px]">
          {selisih && labelPembanding ? (
            <ChipSelisih
              delta={selisih.delta}
              membaik={selisih.membaik}
              satuan={satuanKpi(definisi)}
              keterangan={labelPembanding}
            />
          ) : hasil.nilai === null ? (
            <span className="text-[11px] text-muted">Belum ada data</span>
          ) : null}
        </div>

        {target != null ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-[11px] text-muted">{labelTarget(definisi, target)}</span>
            {tercapai === null ? null : (
              <Badge variant={tercapai ? "default" : "outline"} className="text-[10px]">
                {tercapai ? "Tercapai" : "Belum tercapai"}
              </Badge>
            )}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function DialogDetailKpi({
  definisi,
  bulanBerdata,
  bulanTerpilih,
  labelPeriode,
  target,
  onTutup,
}: {
  definisi: KpiDefinition | null;
  bulanBerdata: KpiBulan[];
  bulanTerpilih: KpiBulan[];
  labelPeriode: string;
  target?: number;
  onTutup: () => void;
}) {
  const w = useWarnaGrafik();
  const layarKecil = useLayarKecil();
  const tooltipStyle = gayaTooltip(w);

  const hasil = useMemo(
    () => (definisi ? hitungSatuKpi(definisi, jumlahkanBulan(bulanTerpilih)) : null),
    [definisi, bulanTerpilih]
  );

  const seri = useMemo(() => {
    if (!definisi) return [];
    return bulanBerdata.map((bulan) => ({
      label: labelBulanSingkat(bulan.bulan),
      nilai: hitungSatuKpi(definisi, bulan.nilai).nilai,
    }));
  }, [definisi, bulanBerdata]);

  if (!definisi || !hasil) return null;
  const { angka, satuan } = tampilNilai(hasil);
  const unit = satuanKpi(definisi);

  return (
    <Dialog open onOpenChange={(buka) => (buka ? null : onTutup())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-light text-[11px] font-bold text-brand-dark">
              {definisi.nomor}
            </span>
            <DialogTitle>{definisi.nama}</DialogTitle>
          </div>
          <DialogDescription>{definisi.penjelasan}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-bg p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {labelPeriode}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold leading-none text-ink">{angka}</span>
              {satuan ? <span className="text-sm font-medium text-muted">{satuan}</span> : null}
            </div>
          </div>
          {target != null ? (
            <Badge
              variant={
                hasil.nilai !== null && targetTercapai(definisi, hasil.nilai, target)
                  ? "default"
                  : "outline"
              }
            >
              {labelTarget(definisi, target)}
            </Badge>
          ) : null}
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Divide className="h-3.5 w-3.5" aria-hidden />
            Cara menghitung
          </div>
          <p className="mt-2 text-sm text-ink">{rumusKpi(definisi)}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">{definisi.labelPembilang}</dt>
              <dd className="shrink-0 font-semibold text-ink">{angkaMentah(hasil.pembilang)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-border pt-2">
              <dt className="text-muted">{definisi.labelPenyebut}</dt>
              <dd className="shrink-0 font-semibold text-ink">{angkaMentah(hasil.penyebut)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            {definisi.arah === "tinggi-baik"
              ? "Semakin tinggi semakin baik."
              : "Semakin rendah semakin baik."}
          </p>
        </div>

        {hasil.anomali ? (
          <Alert variant="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{hasil.anomali}</p>
            </div>
          </Alert>
        ) : null}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Tren per bulan
          </div>
          {seri.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada data bulanan.</p>
          ) : (
            <ResponsiveContainer width="100%" height={layarKecil ? 180 : 220}>
              <LineChart data={seri} margin={{ left: 0, right: 12, top: 12 }}>
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
                  width={44}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [
                    `${value.toLocaleString("id-ID", {
                      minimumFractionDigits: unit === "hari" ? 1 : 2,
                      maximumFractionDigits: unit === "hari" ? 1 : 2,
                    })}${unit === "%" ? "%" : " hari"}`,
                    definisi.namaSingkat,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="nilai"
                  stroke={w.seri[0]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: w.seri[0] }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
