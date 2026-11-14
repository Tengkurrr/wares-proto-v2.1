import Link from "next/link";
import { FilePlus2, Inbox } from "lucide-react";

import { RiwayatList } from "@/components/riwayat-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { ambilDaftarRiwayat } from "@/lib/queries";

export const metadata = { title: "Riwayat — WARES" };

export default async function RiwayatPage() {
  const profile = await requireProfile();
  const { items: daftar, errorPesan } = await ambilDaftarRiwayat();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{profile.is_admin ? "Riwayat Permintaan" : "Riwayat Saya"}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {profile.is_admin
              ? "Seluruh Surat Pengambilan Barang yang pernah diajukan."
              : "Surat Pengambilan Barang yang pernah kamu ajukan."}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/buat-permintaan">
            <FilePlus2 className="h-4 w-4" />
            Buat Permintaan
          </Link>
        </Button>
      </div>

      {errorPesan ? (
        <Alert variant="warning">
          {errorPesan}{" "}
          <Link href="/riwayat" className="underline">
            Muat ulang
          </Link>
        </Alert>
      ) : null}

      {daftar.length === 0 && !errorPesan ? (
        <div className="card-surface flex flex-col items-center justify-center px-4 py-14 text-center sm:px-6 sm:py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-dark">
            <Inbox className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Belum ada permintaan</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Permintaan yang kamu simpan akan muncul di sini, lengkap dengan tombol untuk mengunduh ulang
            PDF-nya.
          </p>
          <Button asChild className="mt-6 w-full sm:w-auto">
            <Link href="/buat-permintaan">
              <FilePlus2 className="h-4 w-4" />
              Buat Permintaan Pertama
            </Link>
          </Button>
        </div>
      ) : daftar.length > 0 ? (
        <RiwayatList daftar={daftar} isAdmin={profile.is_admin} />
      ) : null}
    </div>
  );
}
