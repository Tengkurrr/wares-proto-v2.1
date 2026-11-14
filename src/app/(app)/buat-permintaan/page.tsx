import { RequisitionForm } from "@/components/requisition-form";
import { Alert } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Buat Permintaan — WARES" };

export default async function BuatPermintaanPage({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>;
}) {
  const query = await searchParams;
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      {query.pesan === "akses-dashboard-ditolak" ||
      query.pesan === "akses-input-stok-ditolak" ? (
        <Alert variant="warning">
          Halaman tersebut hanya bisa diakses oleh administrator.
        </Alert>
      ) : null}

      <RequisitionForm profile={profile} />
    </div>
  );
}
