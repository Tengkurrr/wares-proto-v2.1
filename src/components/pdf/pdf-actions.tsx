"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";

import { BatasError } from "@/components/batas-error";
import { Button } from "@/components/ui/button";
import type { SuratData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * @react-pdf/renderer tidak bisa dirender di server, jadi seluruh runtime-nya
 * (lihat pdf-runtime.tsx) hanya dimuat di browser lewat next/dynamic.
 *
 * Semua pemakaiannya dikurung `BatasError`. Runtime PDF adalah bagian paling
 * rapuh di aplikasi ini (pernah melumpuhkan seluruh halaman Riwayat saat versinya
 * tidak cocok dengan React bawaan Next). Bila ia gagal, yang rusak cuma tombolnya —
 * data surat di halaman tetap terbaca dan bisa dicetak lewat browser.
 */

const PesanGagal = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800",
      className
    )}
  >
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <span>PDF tidak dapat dimuat. Gunakan Cetak browser (Ctrl+P) sebagai gantinya.</span>
  </div>
);

const TombolMemuat = (
  <Button type="button" size="lg" disabled>
    <Loader2 className="h-4 w-4 animate-spin" />
    Menyiapkan PDF…
  </Button>
);

const UnduhPdf = dynamic(() => import("@/components/pdf/pdf-runtime").then((m) => m.UnduhPdf), {
  ssr: false,
  loading: () => TombolMemuat,
});

const ViewerPdf = dynamic(() => import("@/components/pdf/pdf-runtime").then((m) => m.ViewerPdf), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-border bg-bg text-sm text-muted sm:h-[70vh]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Memuat pratinjau PDF…
    </div>
  ),
});

export function TombolUnduhPdf({
  data,
  namaFile,
  className,
  variant = "default",
}: {
  data: SuratData;
  namaFile: string;
  className?: string;
  variant?: "default" | "outline";
}) {
  return (
    <BatasError label="Tombol unduh PDF" fallback={<PesanGagal className={className} />}>
      <UnduhPdf data={data} namaFile={namaFile} className={className} variant={variant} />
    </BatasError>
  );
}

export function TombolPratinjau({
  tampil,
  onToggle,
  className,
}: {
  tampil: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button type="button" variant="outline" size="lg" onClick={onToggle} className={className}>
      <FileText className="h-4 w-4" />
      {tampil ? "Sembunyikan Pratinjau" : "Lihat Pratinjau PDF"}
    </Button>
  );
}

export function KotakPratinjauPdf({ data, className }: { data: SuratData; className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <BatasError label="Pratinjau PDF" fallback={<PesanGagal />}>
        <ViewerPdf data={data} />
      </BatasError>
    </div>
  );
}
