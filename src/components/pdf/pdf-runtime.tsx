"use client";

import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";

import { SuratPdf } from "@/components/pdf/surat-pdf";
import { Button } from "@/components/ui/button";
import type { SuratData } from "@/lib/types";

/**
 * Seluruh pemakaian @react-pdf/renderer dikurung di file ini.
 * File ini HANYA boleh di-import lewat next/dynamic dengan ssr:false — paketnya
 * tidak bisa dirender di server dan akan menggagalkan render halaman kalau ikut masuk graf SSR.
 */

export function UnduhPdf({
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
    // className juga diteruskan ke anchor-nya, supaya tombol ikut melebar penuh di layar kecil.
    <PDFDownloadLink document={<SuratPdf data={data} />} fileName={namaFile} className={className}>
      {/* @react-pdf mendukung children berupa fungsi, tapi tipenya belum mencakup itu. */}
      {(({ loading, error }: { loading: boolean; error: string | null }) => {
        if (error) {
          if (typeof window !== "undefined") {
            const e = error as unknown;
            const detail =
              e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : JSON.stringify(e);
            console.error("[WARES] Gagal membuat PDF:", detail);
          }
          return (
            <Button type="button" size="lg" variant="outline" className={className} asChild>
              <span className="text-destructive">Gagal membuat PDF</span>
            </Button>
          );
        }
        return (
          <Button type="button" size="lg" variant={variant} className={className} asChild>
            <span>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {loading ? "Menyiapkan PDF…" : "Download PDF"}
            </span>
          </Button>
        );
      }) as never}
    </PDFDownloadLink>
  );
}

export function ViewerPdf({ data }: { data: SuratData }) {
  return (
    <PDFViewer showToolbar className="h-[60vh] w-full rounded-xl border border-border bg-bg sm:h-[70vh]">
      <SuratPdf data={data} />
    </PDFViewer>
  );
}
