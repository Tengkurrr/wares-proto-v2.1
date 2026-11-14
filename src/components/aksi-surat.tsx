"use client";

import { useState } from "react";

import { KotakPratinjauPdf, TombolPratinjau, TombolUnduhPdf } from "@/components/pdf/pdf-actions";
import type { SuratData } from "@/lib/types";
import { namaFilePdf } from "@/lib/utils";

/**
 * Tombol unduh + pratinjau PDF. Nama file mengikuti pola SPB-{username}-{YYYYMMDD-HHmm}.pdf
 * dan dihitung di klien supaya jamnya sesuai waktu user mengunduh.
 */
export function AksiSurat({ data, username }: { data: SuratData; username: string }) {
  const [tampilPratinjau, setTampilPratinjau] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TombolUnduhPdf
          data={data}
          namaFile={namaFilePdf(username)}
          className="w-full sm:w-auto"
        />
        <TombolPratinjau
          tampil={tampilPratinjau}
          onToggle={() => setTampilPratinjau((v) => !v)}
          className="w-full sm:w-auto"
        />
      </div>

      {tampilPratinjau ? <KotakPratinjauPdf data={data} /> : null}
    </div>
  );
}
