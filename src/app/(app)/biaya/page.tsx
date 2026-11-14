import { BiayaEvaluasiView } from "@/components/inventory/biaya-evaluasi";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import { ambilOpRencana, sumberInventory } from "@/lib/inventory/source";

export const metadata = { title: "Biaya & Evaluasi — WARES" };

export default async function BiayaPage() {
  // Halaman ini memuat harga & nilai Rupiah. Pada matriks akses, kolom harga/biaya
  // adalah milik Warehouse & Admin; Maintenance tidak. Role 3-tier belum dibangun,
  // jadi untuk sementara cukup login. Pembatasan per-peran menyusul.
  await requireProfile();
  try {
    const data = await ambilOpRencana();
    return <BiayaEvaluasiView data={data} sumber={sumberInventory()} />;
  } catch (error) {
    console.error("Gagal memuat Biaya & Evaluasi", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Biaya &amp; Evaluasi</h1>
        <Alert variant="destructive">Data biaya &amp; evaluasi tidak dapat dimuat saat ini.</Alert>
      </div>
    );
  }
}
