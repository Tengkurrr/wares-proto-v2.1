import Image from "next/image";

import { KATEGORI } from "@/lib/constants";
import type { SuratData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ringkasan surat di layar — mengikuti susunan form "Surat Pengambilan Barang"
 * supaya user mengenali bentuk yang sama sebelum mengunduh PDF.
 */
export function SuratRingkasan({ data }: { data: SuratData }) {
  const totalPermintaan = data.items.reduce((n, it) => n + it.jumlahPermintaan, 0);
  const totalDiberikan = data.items.reduce((n, it) => n + it.jumlahDiberikan, 0);

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Kop surat */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        {/* Susunan kop mengikuti form cetak: logo di atas, nama departemen di bawahnya. */}
        <div>
          {/* Logo bertuliskan teks gelap: di mode gelap diberi alas terang tipis
              agar tetap terbaca, tanpa mengubah warna korporatnya. */}
          <span className="inline-block dark:rounded-lg dark:bg-white/90 dark:px-2 dark:py-1.5">
            <Image
              src="/brand/logo-petrokimia.png"
              alt="Petrokimia Gresik"
              width={1200}
              height={530}
              priority
              className="h-11 w-auto"
            />
          </span>
          <div className="mt-2 text-sm font-semibold text-ink">
            Dept. Pergudangan &amp; Pengantongan
          </div>
        </div>

        <div className="text-sm leading-relaxed text-ink sm:text-right">
          <div className="text-muted">Kepada:</div>
          <div className="font-semibold">AVP Pengelolaan &amp; Pemeliharaan Gudang</div>
          <div className="font-semibold">Inbound &amp; Outbound</div>
          <div className="text-muted">di Tempat</div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="text-center">
          <h2 className="text-lg font-bold uppercase tracking-wide underline underline-offset-4 sm:text-xl">
            Surat Pengambilan Barang
          </h2>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
            Pemeliharaan Pergudangan
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-ink">
          Untuk Pekerjaan &amp; Lokasi{" "}
          <span className="font-semibold underline decoration-border underline-offset-4">
            {data.pekerjaan} — {data.lokasi}
          </span>
          , barang sebagai berikut:
        </p>

        {/* Checkbox 10 kategori, sama seperti di surat */}
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border bg-bg px-3 py-3 sm:flex sm:flex-wrap sm:gap-x-4 sm:px-4">
          {KATEGORI.map((k) => {
            const aktif = data.kategori.includes(k);
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase">
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border text-[9px] font-bold leading-none",
                    aktif ? "border-brand bg-brand text-brand-fg" : "border-muted/50 bg-surface"
                  )}
                  aria-hidden
                >
                  {aktif ? "✓" : ""}
                </span>
                <span className={aktif ? "text-ink" : "text-muted"}>{k}</span>
              </span>
            );
          })}
        </div>

        {/* Tabel barang */}
        <p className="mt-5 text-xs text-muted sm:hidden">Geser tabel ke samping untuk kolom lainnya.</p>
        <div className="mt-2 overflow-x-auto scrollbar-slim sm:mt-5">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="w-12 border border-border bg-bg px-2 py-2 text-center text-xs font-semibold uppercase"
                >
                  No
                </th>
                <th
                  rowSpan={2}
                  className="border border-border bg-bg px-3 py-2 text-left text-xs font-semibold uppercase"
                >
                  Nama Barang
                </th>
                <th
                  rowSpan={2}
                  className="w-24 border border-border bg-bg px-2 py-2 text-center text-xs font-semibold uppercase"
                >
                  Satuan
                </th>
                <th
                  colSpan={2}
                  className="border border-border bg-bg px-2 py-2 text-center text-xs font-semibold uppercase"
                >
                  Jumlah
                </th>
              </tr>
              <tr>
                <th className="w-28 border border-border bg-bg px-2 py-1.5 text-center text-[11px] font-semibold uppercase">
                  Permintaan
                </th>
                <th className="w-28 border border-border bg-bg px-2 py-1.5 text-center text-[11px] font-semibold uppercase">
                  Diberikan
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={`${item.nama_barang}-${i}`}>
                  <td className="border border-border px-2 py-2 text-center text-muted">{i + 1}</td>
                  <td className="border border-border px-3 py-2">{item.nama_barang}</td>
                  <td className="border border-border px-2 py-2 text-center">{item.satuan}</td>
                  <td className="border border-border px-2 py-2 text-center font-semibold">
                    {item.jumlahPermintaan}
                  </td>
                  <td className="border border-border px-2 py-2 text-center font-semibold">
                    {item.jumlahDiberikan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted">
          {data.items.length} jenis barang · total permintaan {totalPermintaan.toLocaleString("id-ID")} unit ·
          total diberikan {totalDiberikan.toLocaleString("id-ID")} unit.
        </p>

        <p className="mt-6 text-sm text-ink">
          Demikian atas bantuan dan kerja samanya yang baik disampaikan terima kasih.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div className="text-sm">
            <div className="text-ink">Yang menyerahkan,</div>
            <div className="mt-14 border-t border-ink pt-1.5 font-semibold text-ink">
              {data.namaPenyerah}
            </div>
          </div>
          <div className="text-sm">
            <div className="text-muted">Gresik, {data.tanggal}</div>
            <div className="mt-1 text-ink">Yang menerima,</div>
            <div className="mt-11 border-t border-ink pt-1.5 font-semibold text-ink">{data.namaPenerima}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
