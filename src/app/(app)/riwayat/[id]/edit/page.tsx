import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { RequisitionForm, type NilaiAwal } from "@/components/requisition-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { ambilRequest } from "@/lib/queries";
import { tanggalIndonesia } from "@/lib/utils";

export const metadata = { title: "Edit Permintaan — WARES" };

export default async function EditRiwayatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const hasil = await ambilRequest(id);

  if (hasil.status === "not-found") notFound();

  if (hasil.status === "error") {
    return (
      <div className="space-y-4">
        <Alert variant="warning">{hasil.pesan} Coba muat ulang sebentar lagi.</Alert>
        <Button variant="outline" asChild>
          <Link href={`/riwayat/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke detail
          </Link>
        </Button>
      </div>
    );
  }

  const request = hasil.request;

  if (!profile.is_admin) {
    redirect(`/riwayat/${request.id}?pesan=khusus-admin`);
  }

  const awal: NilaiAwal = {
    requestId: request.id,
    pekerjaan: request.pekerjaan,
    lokasi: request.lokasi_pekerjaan,
    kategori: request.kategori,
    nama_penyerah: request.nama_penyerah,
    nama_penerima: request.nama_penerima,
    tanggal: tanggalIndonesia(request.created_at),
    items: request.items.map((it) => ({
      catalog_item_id: it.catalog_item_id,
      kode_barang: it.kode_barang,
      nama_barang: it.nama_barang,
      kategori_barang: it.kategori_barang ?? "",
      lokasi_barang: it.lokasi_barang ?? "",
      satuan: it.satuan,
      stok_tersedia: 0,
      jumlah_permintaan: it.jumlah_permintaan,
      jumlah_diberikan: it.jumlah_diberikan,
    })),
  };

  return <RequisitionForm profile={profile} awal={awal} />;
}
