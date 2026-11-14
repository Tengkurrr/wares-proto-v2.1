"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OpRencana, SumberData } from "@/lib/inventory/types";
import { cn, formatAngka, formatRupiah, tanggalIndonesia } from "@/lib/utils";

export function BiayaEvaluasiView({
  data,
  sumber,
}: {
  data: OpRencana;
  sumber: SumberData;
}) {
  const { params, ringkasan, items } = data;
  const [cari, setCari] = useState("");

  // Biaya simpan & nilai stok bisa diturunkan per SKU; biaya PESAN bersifat
  // per-PO (per review yang memesan), jadi sengaja TIDAK dibagi per SKU.
  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return items
      .map((it) => ({
        ...it,
        nilaiPesSku: it.dipesanTahunAcuan * it.harga,
        nilaiStokSku: it.rataStok * it.harga,
        biayaSimpanSku: it.rataStok * it.biayaSimpanUnit,
      }))
      .filter((r) => (q === "" ? true : r.nama.toLowerCase().includes(q)))
      .sort((a, b) => b.biayaSimpanSku - a.biayaSimpanSku);
  }, [items, cari]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Biaya &amp; Evaluasi</h1>
          <p className="mt-1 text-sm text-muted">
            Evaluasi kebijakan (R,S) untuk tahun acuan {params.tahunAcuan}: nilai stok,
            biaya pesan + simpan.
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

      {/* Parameter kebijakan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Parameter kebijakan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Param label="Periode review R" nilai={`${formatAngka(params.periodeReviewHari)} hari`} />
          <Param label="Service level" nilai={`${formatAngka(params.serviceLevel * 100)}%`} />
          <Param label="Biaya pesan / PO" nilai={formatRupiah(params.biayaPesanK)} />
          <Param label="Biaya simpan / tahun" nilai={`${formatAngka(params.biayaSimpanTahun * 100)}%`} />
          <Param label="Mulai review" nilai={tanggalIndonesia(params.tanggalReviewPertama)} />
          <Param label="Akhir horizon" nilai={tanggalIndonesia(params.akhirHorizon)} />
          <Param label="Tahun acuan" nilai={String(params.tahunAcuan)} />
          <Param label="Jumlah review" nilai={formatAngka(params.jumlahReview)} />
        </CardContent>
      </Card>

      {/* Ringkasan biaya tahun acuan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuBiaya label="Jumlah PO" nilai={formatAngka(ringkasan.jumlahPO)} />
        <KartuBiaya label="Total unit dipesan" nilai={formatAngka(ringkasan.totalUnitDipesan)} />
        <KartuBiaya label="Nilai pesanan" nilai={formatRupiah(ringkasan.nilaiPesanan)} />
        <KartuBiaya label="Biaya pesan" nilai={formatRupiah(ringkasan.biayaPesan)} />
        <KartuBiaya label="Rata-rata nilai stok" nilai={formatRupiah(ringkasan.rataNilaiStok)} />
        <KartuBiaya label="Biaya simpan" nilai={formatRupiah(ringkasan.biayaSimpan)} />
        <KartuBiaya
          label="Biaya pesan + simpan"
          nilai={formatRupiah(ringkasan.biayaPesanSimpan)}
          sorot
        />
        <KartuBiaya
          label="Kejadian kekurangan"
          nilai={`${formatAngka(ringkasan.kejadianKekurangan)} SKU`}
        />
      </div>

      {/* Tabel biaya per SKU */}
      <Card>
        <CardHeader className="gap-3 pb-3">
          <CardTitle className="text-base">Biaya per SKU (urut biaya simpan tertinggi)</CardTitle>
          <Input
            placeholder="Cari sparepart…"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="h-9 w-full max-w-xs"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Sparepart</th>
                <th className="px-3 py-2.5 text-right font-medium">Harga/unit</th>
                <th className="px-3 py-2.5 text-right font-medium">Dipesan {params.tahunAcuan}</th>
                <th className="px-3 py-2.5 text-right font-medium">Nilai pesanan</th>
                <th className="px-3 py-2.5 text-right font-medium">Rata stok</th>
                <th className="px-3 py-2.5 text-right font-medium">Nilai stok</th>
                <th className="px-4 py-2.5 text-right font-medium">Biaya simpan/thn</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((r) => (
                <tr key={r.no} className="border-b border-border/50 last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{r.nama}</div>
                    <div className="text-xs text-muted">{r.bagian}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(r.harga)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(r.dipesanTahunAcuan)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(r.nilaiPesSku)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(r.rataStok, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(r.nilaiStokSku)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatRupiah(r.biayaSimpanSku)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Param({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{nilai}</p>
    </div>
  );
}

function KartuBiaya({ label, nilai, sorot }: { label: string; nilai: string; sorot?: boolean }) {
  return (
    <Card className={cn(sorot && "border-brand/40 bg-brand-light/50")}>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className={cn("mt-1 text-lg font-bold", sorot ? "text-brand-dark" : "text-ink")}>{nilai}</p>
      </CardContent>
    </Card>
  );
}
