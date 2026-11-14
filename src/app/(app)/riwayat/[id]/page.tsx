import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";

import { AksiSurat } from "@/components/aksi-surat";
import { SuratRingkasan } from "@/components/surat-ringkasan";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { ambilRequest } from "@/lib/queries";
import type { SuratData } from "@/lib/types";
import { tanggalIndonesia, tanggalJamIndonesia } from "@/lib/utils";

export const metadata = { title: "Detail Permintaan — WARES" };

export default async function DetailRiwayatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tersimpan?: string; pesan?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const profile = await requireProfile();
  const hasil = await ambilRequest(id);

  if (hasil.status === "not-found") notFound();

  if (hasil.status === "error") {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          {hasil.pesan} Koneksi database sedang tersendat — data Anda tidak dihapus.
        </Alert>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/riwayat/${id}`}>Coba muat ulang</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/riwayat">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke riwayat
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const request = hasil.request;
  const milikSendiri = request.user_id === profile.id;

  const surat: SuratData = {
    pekerjaan: request.pekerjaan,
    lokasi: request.lokasi_pekerjaan,
    kategori: request.kategori,
    // Keduanya diketik manual saat permintaan dibuat.
    namaPenyerah: request.nama_penyerah,
    namaPenerima: request.nama_penerima,
    tanggal: tanggalIndonesia(request.created_at),
    items: request.items.map((it) => ({
      nama_barang: it.nama_barang,
      satuan: it.satuan,
      jumlahPermintaan: it.jumlah_permintaan,
      jumlahDiberikan: it.jumlah_diberikan,
    })),
  };

  const usernameFile = request.pemilik?.username ?? profile.username;
  const tersimpan = query.tersimpan;

  return (
    <div className="space-y-6">
      {query.pesan === "khusus-admin" ? (
        <Alert variant="warning">
          Hanya administrator yang dapat mengedit permintaan tersimpan.
        </Alert>
      ) : null}

      {tersimpan ? (
        <Alert variant="info" className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {tersimpan === "diperbarui"
              ? "Perubahan tersimpan. Unduh ulang PDF bila surat perlu dicetak lagi."
              : "Permintaan tersimpan. Silakan unduh PDF untuk dicetak dan ditandatangani."}
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Detail Permintaan</h1>
          <p className="mt-1.5 text-sm text-muted">
            Dibuat {tanggalJamIndonesia(request.created_at)}
            {request.updated_at !== request.created_at
              ? ` · diperbarui ${tanggalJamIndonesia(request.updated_at)}`
              : ""}
            {!milikSendiri && request.pemilik ? ` · oleh ${request.pemilik.nama_lengkap}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/riwayat">
              <ArrowLeft className="h-4 w-4" />
              Riwayat
            </Link>
          </Button>
          {profile.is_admin ? (
            <Button variant="outline" asChild>
              <Link href={`/riwayat/${request.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <SuratRingkasan data={surat} />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-base font-semibold">Dokumen PDF</h2>
        <p className="mt-1 text-sm text-muted">
          Cetak lalu tandatangani secara basah. Nama penyerah dan penerima sudah mengikuti data permintaan.
        </p>
        <div className="mt-4">
          <AksiSurat data={surat} username={usernameFile} />
        </div>
      </div>
    </div>
  );
}
