"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Chip perubahan antar periode.
 *
 * Warnanya mengikuti MEMBAIK/MEMBURUK, bukan naik/turun — pada KPI seperti
 * Stockout Rate, angka yang naik justru kabar buruk.
 */
export function ChipSelisih({
  delta,
  membaik,
  satuan,
  keterangan,
  desimal,
  className,
}: {
  delta: number;
  membaik: boolean;
  satuan: string;
  keterangan: string;
  /** Default: 2 untuk persen, 1 untuk hari, 0 untuk satuan cacah (unit/surat/orang). */
  desimal?: number;
  className?: string;
}) {
  const angkaDesimal = desimal ?? (satuan === "%" ? 2 : satuan === "hari" ? 1 : 0);
  const datar = Math.abs(delta) < 0.005;
  const Ikon = datar ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const angka = Math.abs(delta).toLocaleString("id-ID", {
    minimumFractionDigits: angkaDesimal,
    maximumFractionDigits: angkaDesimal,
  });

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 text-[11px] font-medium leading-tight",
        datar ? "text-muted" : membaik ? "text-brand-dark" : "text-destructive",
        className
      )}
    >
      <Ikon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="font-semibold">
        {datar ? "Tetap" : `${angka}${satuan === "%" ? " p.p" : ` ${satuan}`}`}
      </span>
      <span className="text-muted">dari {keterangan}</span>
    </span>
  );
}
