import { DetailSkuView } from "@/components/inventory/detail-sku";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import {
  ambilDashboardInventory,
  ambilDataDemand,
  ambilPolaDemand,
  ambilRmHasil,
  sumberInventory,
} from "@/lib/inventory/source";
import type { DetailSkuRow } from "@/lib/inventory/types";

export const metadata = { title: "Detail SKU — WARES" };

const kunci = (s: string) => s.trim().toUpperCase();

export default async function DetailSkuPage() {
  await requireProfile();

  let rows: DetailSkuRow[];
  let minggu = 35;
  try {
    const [dash, rm, pola, demand] = await Promise.all([
      ambilDashboardInventory(),
      ambilRmHasil(),
      ambilPolaDemand(),
      ambilDataDemand(),
    ]);
    minggu = demand.minggu.length || 35;

    const petaRm = new Map(rm.items.map((r) => [kunci(r.namaBarang), r]));
    const petaPola = new Map(pola.items.map((p) => [kunci(p.nama), p]));
    const petaDemand = new Map(demand.items.map((d) => [kunci(d.nama), d.mingguan]));

    rows = dash.items.map((it) => {
      const k = kunci(it.sparepart);
      const r = petaRm.get(k);
      const p = petaPola.get(k);
      return {
        no: it.no,
        sparepart: it.sparepart,
        mesin: it.mesin,
        satuan: it.satuan,
        kriteria: r?.kriteria ?? "",
        pola: p?.pola ?? "",
        leadTime: it.leadTime,
        ropRekomendasi: r?.ropRekomendasi ?? 0,
        ssRekomendasi: r?.ssRekomendasi ?? 0,
        dasar: r?.dasar ?? "",
        totalKeluar35: r?.totalKeluar35 ?? 0,
        rataPerMinggu: r?.rataPerMinggu ?? 0,
        status: it.status,
        targetS: it.targetS,
        stokFisik: it.stokFisik,
        demand35: petaDemand.get(k) ?? [],
      };
    });
  } catch (error) {
    console.error("Gagal memuat Detail SKU", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Detail SKU</h1>
        <Alert variant="destructive">Data detail SKU tidak dapat dimuat saat ini.</Alert>
      </div>
    );
  }

  return <DetailSkuView rows={rows} sumber={sumberInventory()} minggu={minggu} />;
}
