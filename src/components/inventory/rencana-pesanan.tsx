"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gayaTooltip, useLayarKecil, useWarnaGrafik } from "@/components/dashboard/warna-grafik";
import type { OpOrder, SumberData } from "@/lib/inventory/types";
import { cn, formatAngka, formatRupiah, tanggalIndonesia } from "@/lib/utils";

function tglPendek(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function RencanaPesananView({
  data,
  sumber,
}: {
  data: OpOrder;
  sumber: SumberData;
}) {
  const { reviewDates, totalUnit, jumlahSku, nilaiPesanan, series } = data;
  const warna = useWarnaGrafik();
  const kecil = useLayarKecil();
  const [idx, setIdx] = useState(0);

  const pesananReview = useMemo(
    () =>
      series
        .map((s) => ({ nama: s.nama, bagian: s.bagian, qty: s.qty[idx] ?? 0 }))
        .filter((r) => r.qty > 0)
        .sort((a, b) => b.qty - a.qty),
    [series, idx]
  );

  const dataNilai = useMemo(
    () => reviewDates.map((tgl, i) => ({ tgl: tglPendek(tgl), nilai: nilaiPesanan[i] ?? 0 })),
    [reviewDates, nilaiPesanan]
  );
  const interval = kecil ? Math.ceil(reviewDates.length / 6) : Math.ceil(reviewDates.length / 12);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Rencana Pesanan</h1>
          <p className="mt-1 text-sm text-muted">
            Daftar pesanan per review mingguan (order-up-to level S).
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
            <CardTitle className="text-base">Pilih review</CardTitle>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {reviewDates.map((tgl, i) => (
                <option key={tgl + i} value={i}>
                  Review {i} — {tanggalIndonesia(tgl)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Total unit dipesan" nilai={formatAngka(totalUnit[idx] ?? 0)} />
          <Stat label="Jumlah SKU dipesan" nilai={formatAngka(jumlahSku[idx] ?? 0)} />
          <Stat
            label="Nilai pesanan"
            nilai={formatRupiah(nilaiPesanan[idx] ?? 0)}
            lebar
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nilai pesanan per review (Rp)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataNilai} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPesanan" x1="0" y1="0" x2="0" y2="1">
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
                  width={56}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)} jt`}
                />
                <Tooltip {...gayaTooltip(warna)} formatter={(v) => [formatRupiah(Number(v)), "Nilai"]} />
                <ReferenceLine x={tglPendek(reviewDates[idx] ?? "")} stroke={warna.seri[2]} strokeDasharray="4 3" />
                <Area type="monotone" dataKey="nilai" stroke={warna.seri[0]} strokeWidth={2} fill="url(#gradPesanan)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            SKU dipesan pada review ini ({pesananReview.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Sparepart</th>
                <th className="px-3 py-2.5 font-medium">Mesin</th>
                <th className="px-4 py-2.5 text-right font-medium">Qty pesan</th>
              </tr>
            </thead>
            <tbody>
              {pesananReview.map((r) => (
                <tr key={r.nama} className="border-b border-border/50 last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.nama}</td>
                  <td className="px-3 py-2.5 text-muted">{r.bagian}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatAngka(r.qty)}</td>
                </tr>
              ))}
              {pesananReview.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">
                    Tidak ada pesanan pada review ini.
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

function Stat({ label, nilai, lebar }: { label: string; nilai: string; lebar?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg/40 p-3", lebar && "col-span-2 sm:col-span-1")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{nilai}</p>
    </div>
  );
}
