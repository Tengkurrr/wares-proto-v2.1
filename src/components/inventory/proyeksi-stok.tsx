"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gayaTooltip, useLayarKecil, useWarnaGrafik } from "@/components/dashboard/warna-grafik";
import type { SumberData } from "@/lib/inventory/types";
import { cn, formatAngka, formatRupiah } from "@/lib/utils";

export type SeriProyeksi = {
  nama: string;
  bagian: string;
  stok: number[];
  targetS: number;
  status: string;
};

function tglPendek(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function ProyeksiStokView({
  reviewDates,
  series,
  nilaiStok,
  jumlahKurang,
  sumber,
}: {
  reviewDates: string[];
  series: SeriProyeksi[];
  nilaiStok: number[];
  jumlahKurang: number[];
  sumber: SumberData;
}) {
  const warna = useWarnaGrafik();
  const kecil = useLayarKecil();
  // Default: SKU kritis pertama bila ada, agar yang paling perlu perhatian tampil lebih dulu.
  const indeksAwal = Math.max(0, series.findIndex((s) => s.status === "Kritis"));
  const [idx, setIdx] = useState(indeksAwal);
  const dipilih = series[idx] ?? series[0];

  const dataSku = useMemo(
    () =>
      reviewDates.map((tgl, i) => ({
        tgl: tglPendek(tgl),
        stok: dipilih?.stok[i] ?? 0,
        target: dipilih?.targetS ?? 0,
      })),
    [reviewDates, dipilih]
  );

  const dataNilai = useMemo(
    () => reviewDates.map((tgl, i) => ({ tgl: tglPendek(tgl), nilai: nilaiStok[i] ?? 0 })),
    [reviewDates, nilaiStok]
  );

  const interval = kecil ? Math.ceil(reviewDates.length / 6) : Math.ceil(reviewDates.length / 12);
  const totalKurang = jumlahKurang.reduce((a, b) => Math.max(a, b), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Proyeksi Stok</h1>
          <p className="mt-1 text-sm text-muted">
            Proyeksi posisi stok fisik per review vs target S (order-up-to level).
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

      <Card>
        <CardHeader className="gap-3 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Stok vs Target S per SKU</CardTitle>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="h-9 max-w-xs rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {series.map((s, i) => (
                <option key={s.nama + i} value={i}>
                  {s.status === "Kritis" ? "⚠ " : ""}
                  {s.nama}
                </option>
              ))}
            </select>
          </div>
          {dipilih ? (
            <p className="text-xs text-muted">
              {dipilih.bagian} · Target S = {formatAngka(dipilih.targetS)} · status {dipilih.status}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataSku} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={warna.grid} vertical={false} />
                <XAxis
                  dataKey="tgl"
                  interval={interval}
                  tick={{ fontSize: 11, fill: warna.sumbu }}
                  stroke={warna.sumbu}
                />
                <YAxis tick={{ fontSize: 11, fill: warna.sumbu }} stroke={warna.sumbu} allowDecimals={false} />
                <Tooltip {...gayaTooltip(warna)} />
                <ReferenceLine
                  y={dipilih?.targetS ?? 0}
                  stroke={warna.seri[2]}
                  strokeDasharray="5 4"
                  label={{ value: "Target S", position: "right", fontSize: 11, fill: warna.seri[2] }}
                />
                <Line
                  type="monotone"
                  dataKey="stok"
                  name="Stok fisik"
                  stroke={warna.seri[0]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nilai stok positif (Rp) per review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataNilai} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradNilai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={warna.seri[0]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={warna.seri[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={warna.grid} vertical={false} />
                  <XAxis
                    dataKey="tgl"
                    interval={interval}
                    tick={{ fontSize: 11, fill: warna.sumbu }}
                    stroke={warna.sumbu}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: warna.sumbu }}
                    stroke={warna.sumbu}
                    width={64}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)} jt`}
                  />
                  <Tooltip
                    {...gayaTooltip(warna)}
                    formatter={(v) => [formatRupiah(Number(v)), "Nilai stok"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="nilai"
                    stroke={warna.seri[0]}
                    strokeWidth={2}
                    fill="url(#gradNilai)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Jumlah SKU kekurangan per review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted">
              Puncak kekurangan pada horizon ini: {formatAngka(totalKurang)} SKU.
            </p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={reviewDates.map((tgl, i) => ({ tgl: tglPendek(tgl), kurang: jumlahKurang[i] ?? 0 }))}
                  margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={warna.grid} vertical={false} />
                  <XAxis
                    dataKey="tgl"
                    interval={interval}
                    tick={{ fontSize: 11, fill: warna.sumbu }}
                    stroke={warna.sumbu}
                  />
                  <YAxis tick={{ fontSize: 11, fill: warna.sumbu }} stroke={warna.sumbu} allowDecimals={false} />
                  <Tooltip {...gayaTooltip(warna)} />
                  <Line
                    type="stepAfter"
                    dataKey="kurang"
                    name="SKU kurang"
                    stroke={warna.seri[5] ?? warna.seri[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
