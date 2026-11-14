import { AksesTerkunci } from "@/components/akses-terkunci";
import { InputStockForm } from "@/components/input-stock-form";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Input Stok — WARES" };

export default async function InputStokPage() {
  const profile = await requireProfile();

  // Mekanik tetap boleh membuka halaman, tetapi hanya melihat kerangka buram —
  // formulirnya tidak dirender sama sekali. Route /api/stock/input juga tetap
  // menolak non-admin, jadi tidak ada jalan pintas lewat browser.
  if (!profile.is_admin) {
    return (
      <AksesTerkunci
        judul="Input Stok"
        deskripsi="Pencatatan kedatangan material hanya dapat dilakukan administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Input Stok</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Catat kedatangan material. Halaman ini hanya dapat diakses administrator.
        </p>
      </div>
      <InputStockForm actorId={profile.id} />
    </div>
  );
}
