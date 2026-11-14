"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, PackageCheck, ShoppingCart, Boxes } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/inventory/status-badge";
import type { DashboardInventory, SumberData } from "@/lib/inventory/types";
import { formatAngka, formatRupiah, tanggalIndonesia, cn } from "@/lib/utils";

const STATUS_URUT: Record<string, number> = { Kritis: 0, "Pesan sekarang": 1, Cukup: 2 };

export function DashboardInventoryView({
  data,
  sumber,
}: {
  data: DashboardInventory;
  sumber: SumberData;
}) {
  const { ringkasan, perMesin, items } = data;
  const [mesin, setMesin] = useState<string>("SEMUA");
  const [status, setStatus] = useState<string>("SEMUA");
  const [cari, setCari] = useState("");

  const daftarMesin = useMemo(
    () => ["SEMUA", ...Array.from(new Set(items.map((i) => i.mesin)))],
    [items]
  );

  const terfilter = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return items
      .filter((i) => (mesin === "SEMUA" ? true : i.mesin === mesin))
      .filter((i) => (status === "SEMUA" ? true : i.status === status))
      .filter((i) => (q === "" ? true : i.sparepart.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          (STATUS_URUT[a.status] ?? 9) - (STATUS_URUT[b.status] ?? 9) || a.no - b.no
      );
  }, [items, mesin, status, cari]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard Status Sparepart</h1>
          <p className="mt-1 text-sm text-muted">
            Posisi persediaan pada review {tanggalIndonesia(ringkasan.tanggalAcuan)} · R ={" "}
            {formatAngka(ringkasan.periodeReviewHari)} hari · service level{" "}
            {formatAngka(ringkasan.serviceLevel * 100)}%
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
            sumber === "sheets"
              ? "border-brand/30 bg-brand-light text-brand-dark"
              : "border-gold/40 bg-gold/15 text-gold-ink"
          )}
          title={
            sumber === "sheets"
              ? "Angka dibaca langsung dari Google Sheets model."
              : "Angka dari fixture lokal hasil ekstraksi Excel (Apps Script belum di-deploy)."
          }
        >
          Sumber: {sumber === "sheets" ? "Google Sheets" : "fixture (Excel)"}
        </span>
      </header>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuStat
          label="Total SKU"
          nilai={formatAngka(ringkasan.totalSku)}
          ikon={<Boxes className="h-5 w-5" />}
          warna="text-ink"
        />
        <KartuStat
          label="Kritis"
          nilai={formatAngka(ringkasan.kritis)}
          ikon={<AlertTriangle className="h-5 w-5" />}
          warna="text-destructive"
        />
        <KartuStat
          label="Pesan sekarang"
          nilai={formatAngka(ringkasan.pesanSekarang)}
          ikon={<ShoppingCart className="h-5 w-5" />}
          warna="text-gold-ink"
        />
        <KartuStat
          label="Cukup"
          nilai={`${formatAngka(ringkasan.cukup)} · ${formatAngka(ringkasan.persenCukup * 100, 1)}%`}
          ikon={<PackageCheck className="h-5 w-5" />}
          warna="text-brand-dark"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Nilai pesanan */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nilai pesanan pada review ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-ink">{formatRupiah(ringkasan.nilaiPesanan)}</p>
            <p className="mt-1 text-xs text-muted">
              Total nilai barang yang perlu dipesan pada tanggal acuan.
            </p>
          </CardContent>
        </Card>

        {/* Breakdown per mesin */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status per mesin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Mesin</th>
                  <th className="pb-2 px-3 text-right font-medium">Kritis</th>
                  <th className="pb-2 px-3 text-right font-medium">Pesan</th>
                  <th className="pb-2 px-3 text-right font-medium">Cukup</th>
                  <th className="pb-2 pl-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {perMesin.map((m) => (
                  <tr key={m.mesin} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{m.mesin}</td>
                    <td className="py-2 px-3 text-right text-destructive">{m.kritis}</td>
                    <td className="py-2 px-3 text-right text-gold-ink">{m.pesanSekarang}</td>
                    <td className="py-2 px-3 text-right text-brand-dark">{m.cukup}</td>
                    <td className="py-2 pl-3 text-right font-semibold">{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Tabel SKU */}
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
            <PilihSederhana nilai={mesin} set={setMesin} opsi={daftarMesin} />
            <PilihSederhana
              nilai={status}
              set={setStatus}
              opsi={["SEMUA", "Kritis", "Pesan sekarang", "Cukup"]}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Sparepart</th>
                <th className="px-3 py-2.5 font-medium">Mesin</th>
                <th className="px-3 py-2.5 text-right font-medium">Target S</th>
                <th className="px-3 py-2.5 text-right font-medium">Stok fisik</th>
                <th className="px-3 py-2.5 text-right font-medium">Posisi</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Pesan</th>
                <th className="px-4 py-2.5 font-medium">Perkiraan tiba</th>
              </tr>
            </thead>
            <tbody>
              {terfilter.map((i) => (
                <tr
                  key={i.no}
                  className={cn(
                    "border-b border-border/50 last:border-0 hover:bg-bg/40",
                    i.status === "Kritis" && "bg-destructive/[0.04]"
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-ink">{i.sparepart}</td>
                  <td className="px-3 py-2.5 text-muted">{i.mesin}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(i.targetS)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(i.stokFisik)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(i.posisiPersediaan)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={i.status} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {i.jumlahPesan > 0 ? `${formatAngka(i.jumlahPesan)} ${i.satuan}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {i.perkiraanTiba && i.perkiraanTiba !== "-"
                      ? tanggalIndonesia(i.perkiraanTiba)
                      : "—"}
                  </td>
                </tr>
              ))}
              {terfilter.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
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

function KartuStat({
  label,
  nilai,
  ikon,
  warna,
}: {
  label: string;
  nilai: string;
  ikon: React.ReactNode;
  warna: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold", warna)}>{nilai}</p>
        </div>
        <span className={cn("shrink-0", warna)}>{ikon}</span>
      </CardContent>
    </Card>
  );
}

function PilihSederhana({
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
