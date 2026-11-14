import { RencanaPesananView } from "@/components/inventory/rencana-pesanan";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import { ambilOpOrder, sumberInventory } from "@/lib/inventory/source";

export const metadata = { title: "Rencana Pesanan — WARES" };

export default async function RencanaPesananPage() {
  await requireProfile();
  try {
    const data = await ambilOpOrder();
    return <RencanaPesananView data={data} sumber={sumberInventory()} />;
  } catch (error) {
    console.error("Gagal memuat Rencana Pesanan", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Rencana Pesanan</h1>
        <Alert variant="destructive">Data rencana pesanan tidak dapat dimuat saat ini.</Alert>
      </div>
    );
  }
}
