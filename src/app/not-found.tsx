import Image from "next/image";
import Link from "next/link";

/**
 * Halaman 404. Dipakai antara lain saat `notFound()` dipanggil di detail riwayat
 * (permintaan sudah dihapus atau bukan milik pengguna ini).
 */
export const metadata = { title: "Halaman tidak ditemukan — WARES" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Image
        src="/brand/wares-logo-badge.png"
        alt="WARES"
        width={512}
        height={512}
        priority
        className="h-14 w-14"
      />
      <p className="text-4xl font-bold text-brand dark:text-brand-dark">404</p>
      <h1 className="text-xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted">
        Alamat yang Anda buka tidak ada, atau permintaannya sudah tidak tersedia.
      </p>
      <Link
        href="/home"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}
