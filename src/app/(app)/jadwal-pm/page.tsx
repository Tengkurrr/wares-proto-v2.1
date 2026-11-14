import { JadwalPmView } from "@/components/inventory/jadwal-pm";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import { ambilPmOverhaul, sumberInventory } from "@/lib/inventory/source";

export const metadata = { title: "Jadwal PM & Overhaul — WARES" };

export default async function JadwalPmPage() {
  await requireProfile();
  try {
    const data = await ambilPmOverhaul();
    return <JadwalPmView data={data} sumber={sumberInventory()} />;
  } catch (error) {
    console.error("Gagal memuat Jadwal PM & Overhaul", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Jadwal PM &amp; Overhaul</h1>
        <Alert variant="destructive">Data jadwal PM &amp; overhaul tidak dapat dimuat saat ini.</Alert>
      </div>
    );
  }
}
