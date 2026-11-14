"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/inventory/status-badge";
import { Sparkline } from "@/components/inventory/sparkline";
import type { DetailSkuRow, SumberData } from "@/lib/inventory/types";
import { cn, formatAngka } from "@/lib/utils";

function badgeKriteria(k: string) {
  const u = k.toUpperCase();
  if (u === "CRITICAL") return "bg-destructive/15 text-destructive border-destructive/30";
  if (u === "ESSENTIAL") return "bg-gold/20 text-gold-ink border-gold/40";
  return "bg-brand-light text-brand-dark border-transparent";
}

export function DetailSkuView({
  rows,
  sumber,
  minggu,
}: {
  rows: DetailSkuRow[];
  sumber: SumberData;
  minggu: number;
}) {
  const [cari, setCari] = useState("");
  const [mesin, setMesin] = useState("SEMUA");
  const [kriteria, setKriteria] = useState("SEMUA");
  const [pola, setPola] = useState("SEMUA");

  const daftarMesin = useMemo(
    () => ["SEMUA", ...Array.from(new Set(rows.map((r) => r.mesin)))],
    [rows]
  );

  const terfilter = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rows
      .filter((r) => (mesin === "SEMUA" ? true : r.mesin === mesin))
      .filter((r) => (kriteria === "SEMUA" ? true : r.kriteria.toUpperCase() === kriteria))
      .filter((r) => (pola === "SEMUA" ? true : r.pola === pola))
      .filter((r) => (q === "" ? true : r.sparepart.toLowerCase().includes(q)));
  }, [rows, cari, mesin, kriteria, pola]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-ink">Detail SKU</h1>
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
        </div>
        <p className="mt-1 text-sm text-muted">
          Reliability → kebutuhan: ROP &amp; safety stock rekomendasi, pola demand, dan
          pemakaian {minggu} minggu per SKU.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-3 pb-3">
          <CardTitle className="text-base">Daftar SKU ({terfilter.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Cari sparepart…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="h-9 w-full max-w-xs"
            />
            <Pilih nilai={mesin} set={setMesin} opsi={daftarMesin} />
            <Pilih nilai={kriteria} set={setKriteria} opsi={["SEMUA", "CRITICAL", "ESSENTIAL"]} />
            <Pilih nilai={pola} set={setPola} opsi={["SEMUA", "Intermittent", "Lumpy"]} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Sparepart</th>
                <th className="px-3 py-2.5 font-medium">Kriteria</th>
                <th className="px-3 py-2.5 font-medium">Pola</th>
                <th className="px-3 py-2.5 text-right font-medium">LT (hari)</th>
                <th className="px-3 py-2.5 text-right font-medium">ROP</th>
                <th className="px-3 py-2.5 text-right font-medium">SS</th>
                <th className="px-3 py-2.5 font-medium">Dasar</th>
                <th className="px-3 py-2.5 text-right font-medium">Σ {minggu} mgg</th>
                <th className="px-4 py-2.5 font-medium">Pemakaian mingguan</th>
              </tr>
            </thead>
            <tbody>
              {terfilter.map((r) => (
                <tr key={r.no} className="border-b border-border/50 last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{r.sparepart}</div>
                    <div className="text-xs text-muted">{r.mesin}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                        badgeKriteria(r.kriteria)
                      )}
                    >
                      {r.kriteria || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{r.pola || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(r.leadTime)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {formatAngka(r.ropRekomendasi)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAngka(r.ssRekomendasi, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{r.dasar || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAngka(r.totalKeluar35)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkline data={r.demand35} />
                      <StatusBadge status={r.status} />
                    </div>
                  </td>
                </tr>
              ))}
              {terfilter.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                    Tidak ada SKU yang cocok dengan filter.
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

function Pilih({
  nilai,
  set,
  opsi,
}: {
  nilai: string;
  set: (v: string) => void;
  opsi: string[];
}) {
  return (
    <select
      value={nilai}
      onChange={(e) => set(e.target.value)}
      className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
    >
      {opsi.map((o) => (
        <option key={o} value={o}>
          {o === "SEMUA" ? "Semua" : o}
        </option>
      ))}
    </select>
  );
}
