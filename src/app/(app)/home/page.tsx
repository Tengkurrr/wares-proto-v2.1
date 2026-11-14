import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  FilePlus2,
  History,
  Lock,
  PackagePlus,
  PackageSearch,
  ShieldCheck,
} from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata = { title: "Beranda — WARES" };

type MenuPortal = {
  href: string;
  judul: string;
  deskripsi: string;
  aksi: string;
  icon: typeof FilePlus2;
  adminOnly?: boolean;
  utama?: boolean;
};

const MENU_PORTAL: MenuPortal[] = [
  {
    href: "/buat-permintaan",
    judul: "Buat Permintaan",
    deskripsi: "Catat pengambilan material dengan jumlah yang diminta dan diberikan.",
    aksi: "Buat permintaan",
    icon: FilePlus2,
    utama: true,
  },
  {
    href: "/stok",
    judul: "Informasi Stok",
    deskripsi: "Periksa ketersediaan material terkini sebelum membuat permintaan.",
    aksi: "Lihat stok",
    icon: PackageSearch,
  },
  {
    href: "/riwayat",
    judul: "Riwayat Permintaan",
    deskripsi: "Temukan kembali catatan permintaan dan dokumen pengambilan barang.",
    aksi: "Buka riwayat",
    icon: History,
  },
  {
    href: "/master-data",
    judul: "Master Data",
    deskripsi: "Tambah dan perbarui identitas material, rack, area, serta status penggunaannya.",
    aksi: "Kelola master data",
    icon: Database,
    adminOnly: true,
  },
  {
    href: "/input-stok",
    judul: "Input Stok",
    deskripsi: "Catat kedatangan material agar jumlah stok gudang tetap mutakhir.",
    aksi: "Tambahkan stok",
    icon: PackagePlus,
    adminOnly: true,
  },
  {
    href: "/dashboard",
    judul: "Dashboard",
    deskripsi: "Tinjau aktivitas pengeluaran material dan kebutuhan operasional gudang.",
    aksi: "Buka dashboard",
    icon: BarChart3,
    adminOnly: true,
  },
];

export default async function HomePage() {
  const profile = await requireProfile();
  // Mekanik tetap melihat kartu fitur admin, tetapi ditandai terkunci — sama
  // seperti menu di top bar, supaya mereka tahu fitur itu ada dan siapa yang dihubungi.
  const menu = MENU_PORTAL.map((item) => ({
    ...item,
    terkunci: Boolean(item.adminOnly) && !profile.is_admin,
  }));

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="overflow-hidden rounded-2xl border border-brand/20 bg-surface shadow-card">
        <div className="grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1.5 text-xs font-semibold text-brand-dark">
              <ShieldCheck className="h-4 w-4" />
              {profile.is_admin ? "Akses Administrator" : "Akses Mekanik"}
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
              Portal Operasional Gudang
            </p>
            <h1 className="mt-2 max-w-3xl">Selamat datang, {profile.nama_lengkap}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
              WARES membantu pencatatan permintaan, pengeluaran, dan kedatangan material dalam satu
              alur yang terhubung dengan data stok gudang.
            </p>
          </div>

          {/* Hanya logo — teksnya dihapus, jadi alt kini memikul maknanya sendiri
              (bukan lagi dekoratif/aria-hidden). */}
          <div className="hidden rounded-2xl bg-brand-light p-6 lg:block">
            <Image
              src="/brand/wares-logo-badge.png"
              alt="WARES — Warehouse Request System"
              width={512}
              height={512}
              priority
              className="h-32 w-32"
            />
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand via-brand to-gold" />
      </section>

      <section aria-labelledby="menu-utama">
        <div>
          <h2 id="menu-utama">Pilih layanan</h2>
          <p className="mt-1.5 text-sm text-muted">
            Buka halaman yang Anda perlukan untuk melanjutkan pekerjaan.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex min-h-48 flex-col rounded-xl border bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 sm:p-6",
                item.utama ? "border-brand/30" : "border-border",
                item.terkunci && "opacity-70"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                  item.terkunci
                    ? "bg-bg text-muted"
                    : item.utama
                      ? "bg-brand text-brand-fg"
                      : "bg-brand-light text-brand-dark group-hover:bg-brand group-hover:text-brand-fg"
                )}
              >
                {item.terkunci ? <Lock className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{item.judul}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{item.deskripsi}</p>
              <div
                className={cn(
                  "mt-5 flex items-center gap-2 text-sm font-semibold",
                  item.terkunci ? "text-muted" : "text-brand-dark"
                )}
              >
                {item.terkunci ? "Kontak admin warehouse" : item.aksi}
                {item.terkunci ? null : (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
