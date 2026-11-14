import { DashboardInventoryView } from "@/components/inventory/dashboard-inventory";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";
import { ambilDashboardInventoryAman } from "@/lib/inventory/source";

export const metadata = { title: "Dashboard Status Sparepart — WARES" };

export default async function DashboardPage() {
  // Dashboard status stok dapat dilihat semua peran (matriks akses: L untuk
  // Maintenance, Warehouse, dan Admin). requireProfile cukup untuk memastikan
  // pengguna sudah login.
  await requireProfile();

  const hasil = await ambilDashboardInventoryAman();

  if (!hasil.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Dashboard Status Sparepart</h1>
        <Alert variant="destructive">
          Data status sparepart tidak dapat dimuat: {hasil.pesan}
        </Alert>
      </div>
    );
  }

  return <DashboardInventoryView data={hasil.data} sumber={hasil.sumber} />;
}
