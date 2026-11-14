"use client";

import { cn } from "@/lib/utils";

/**
 * Cincin progres SVG.
 *
 * Warnanya memakai `currentColor` dan diatur lewat class Tailwind (`text-brand`,
 * `text-border`), bukan atribut warna literal — dengan begitu cincin ikut
 * berubah otomatis saat mode gelap dinyalakan, sama seperti komponen lain.
 */
export function RingProgres({
  nilai,
  ukuran = 168,
  tebal = 14,
  // `brand-dark` dipilih, bukan `brand`: di mode gelap token ini berbalik
  // menjadi aksen TERANG sehingga cincin tetap terbaca di atas permukaan gelap.
  warnaIsi = "text-brand-dark",
  children,
  className,
}: {
  /** 0–100. `null` berarti belum ada data sehingga cincin dibiarkan kosong. */
  nilai: number | null;
  ukuran?: number;
  tebal?: number;
  warnaIsi?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const jari = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * jari;
  const persen = nilai === null ? 0 : Math.max(0, Math.min(100, nilai));
  const sisa = keliling * (1 - persen / 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: ukuran, height: ukuran }}
    >
      <svg
        width={ukuran}
        height={ukuran}
        viewBox={`0 0 ${ukuran} ${ukuran}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={jari}
          fill="none"
          stroke="currentColor"
          strokeWidth={tebal}
          className="text-border"
        />
        {nilai === null ? null : (
          <circle
            cx={ukuran / 2}
            cy={ukuran / 2}
            r={jari}
            fill="none"
            stroke="currentColor"
            strokeWidth={tebal}
            strokeLinecap="round"
            strokeDasharray={keliling}
            strokeDashoffset={sisa}
            className={cn("transition-[stroke-dashoffset] duration-700 ease-out", warnaIsi)}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
