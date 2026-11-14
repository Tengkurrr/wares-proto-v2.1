"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gayaTooltip, useLayarKecil, useWarnaGrafik } from "@/components/dashboard/warna-grafik";
import type { PmOverhaul, SumberData } from "@/lib/inventory/types";
import { cn, formatAngka, tanggalIndonesia } from "@/lib/utils";

function bulanSingkat(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const b = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
  return `${b} ${String(d.getFullYear()).slice(2)}`;
}

function tambahHari(iso: string, hari: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + hari);
  return d.toISOString().slice(0, 10);
}

export function JadwalPmView({
  data,
  sumber,
}: {
  data: PmOverhaul;
  sumber: SumberData;
}) {
  const { config, periods, totalPerPeriode, items } = data;
  const warna = useWarnaGrafik();
  const kecil = useLayarKecil();
  const [idx, setIdx] = useState(0);

  const kebutuhanPeriode = useMemo(
    () =>
      items
        .map((it) => ({ nama: it.nama, bagian: it.bagian, satuan: it.satuan, qty: it.perPeriode[idx] ?? 0 }))
        .filter((r) => r.qty > 0)
        .sort((a, b) => b.qty - a.qty),
    [items, idx]
  );

  const dataChart = useMemo(
    () =>
      periods.map((p, i) => ({
        label: bulanSingkat(p.awal),
        overhaul: totalPerPeriode.dariOverhaul[i] ?? 0,
        penggantian: totalPerPeriode.dariPenggantian[i] ?? 0,
      })),
    [periods, totalPerPeriode]
  );
  const interval = kecil ? 2 : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Jadwal PM &amp; Overhaul</h1>
          <p className="mt-1 text-sm text-muted">
            Kalender overhaul per mesin dan kebutuhan sparepart per periode ({config.modeTampilan.toLowerCase()}).
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
            sumber === "sheets"
              ? "border-brand/30 bg-brand-light text-brand-dark"
              : "border-gold/40 bg-gold/15 text-gold-ink"
          )}
        >
          Sumber: {sumber === "sheets" ? "Google Sheets" : "fixture (Excel)"}
        </span>
      </header>

      {/* Kalender overhaul per mesin */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Siklus overhaul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-dark" />
              <span className="text-muted">Siklus C</span>
              <span className="ml-auto font-semibold text-ink">{formatAngka(config.siklusC)} hari</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-dark" />
              <span className="text-muted">Kelompok mesin G</span>
              <span className="ml-auto font-semibold text-ink">{formatAngka(config.jumlahMesinG)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overhaul per mesin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Mesin</th>
                  <th className="pb-2 px-3 font-medium">Overhaul pertama</th>
                  <th className="pb-2 pl-3 font-medium">Overhaul berikutnya (+C)</th>
                </tr>
              </thead>
              <tbody>
                {config.overhaulPertama.map((o) => (
                  <tr key={o.mesin} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{o.mesin}</td>
                    <td className="py-2 px-3 text-muted">{tanggalIndonesia(o.tanggal)}</td>
                    <td className="py-2 pl-3 text-muted">
                      {tanggalIndonesia(tambahHari(o.tanggal, config.siklusC))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Kebutuhan sparepart per periode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Kebutuhan sparepart per periode (unit)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataChart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={warna.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={interval}
                  tick={{ fontSize: 11, fill: warna.sumbu }}
                  stroke={warna.sumbu}
                />
                <YAxis tick={{ fontSize: 11, fill: warna.sumbu }} stroke={warna.sumbu} allowDecimals={false} />
                <Tooltip {...gayaTooltip(warna)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="overhaul" name="Dari overhaul" stackId="a" fill={warna.seri[0]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="penggantian" name="Penggantian tambahan" stackId="a" fill={warna.seri[1]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daftar kebutuhan per periode terpilih */}
      <Card>
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Sparepart dibutuhkan pada periode ini ({kebutuhanPeriode.length})
            </CardTitle>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {periods.map((p, i) => (
                <option key={p.no} value={i}>
                  Periode {p.no} — {tanggalIndonesia(p.awal)} s/d {tanggalIndonesia(p.akhir)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Sparepart</th>
                <th className="px-3 py-2.5 font-medium">Mesin</th>
                <th className="px-4 py-2.5 text-right font-medium">Kebutuhan</th>
              </tr>
            </thead>
            <tbody>
              {kebutuhanPeriode.map((r) => (
                <tr key={r.nama} className="border-b border-border/50 last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.nama}</td>
                  <td className="px-3 py-2.5 text-muted">{r.bagian}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {formatAngka(r.qty)} {r.satuan}
                  </td>
                </tr>
              ))}
              {kebutuhanPeriode.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">
                    Tidak ada kebutuhan PM pada periode ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
