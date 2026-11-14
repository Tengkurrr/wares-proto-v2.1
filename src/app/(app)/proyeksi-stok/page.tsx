import { ProyeksiStokView, type SeriProyeksi } from "@/components/inventory/proyeksi-stok";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import {
  ambilDashboardInventory,
  ambilProyeksiStok,
  sumberInventory,
} from "@/lib/inventory/source";

export const metadata = { title: "Proyeksi Stok — WARES" };

const kunci = (s: string) => s.trim().toUpperCase();

export default async function ProyeksiStokPage() {
  await requireProfile();

  try {
    const [dash, proy] = await Promise.all([
      ambilDashboardInventory(),
      ambilProyeksiStok(),
    ]);

    const petaDash = new Map(
      dash.items.map((it) => [kunci(it.sparepart), it])
    );

    const series: SeriProyeksi[] = proy.series.map((s) => {
      const d = petaDash.get(kunci(s.nama));
      return {
        nama: s.nama,
        bagian: s.bagian,
        stok: s.stok,
        targetS: d?.targetS ?? 0,
        status: d?.status ?? "",
      };
    });

    return (
      <ProyeksiStokView
        reviewDates={proy.reviewDates}
        series={series}
        nilaiStok={proy.nilaiStok}
        jumlahKurang={proy.jumlahKurang}
        sumber={sumberInventory()}
      />
    );
  } catch (error) {
    console.error("Gagal memuat Proyeksi Stok", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Proyeksi Stok</h1>
        <Alert variant="destructive">Data proyeksi stok tidak dapat dimuat saat ini.</Alert>
      </div>
    );
  }
}
