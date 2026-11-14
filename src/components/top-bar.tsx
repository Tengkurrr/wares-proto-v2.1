"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Database,
  FilePlus2,
  History,
  Home,
  Lock,
  LogOut,
  Menu,
  PackagePlus,
  PackageSearch,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WaresMark } from "@/components/wares-mark";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof FilePlus2; terkunci?: boolean };

const BASE_NAV: NavItem[] = [
  { href: "/home", label: "Beranda", icon: Home },
  { href: "/buat-permintaan", label: "Buat Permintaan", icon: FilePlus2 },
  { href: "/stok", label: "Informasi Stok", icon: PackageSearch },
  { href: "/riwayat", label: "Riwayat Saya", icon: History },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/master-data", label: "Master Data", icon: Database },
  { href: "/input-stok", label: "Input Stok", icon: PackagePlus },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export function TopBar({ namaLengkap, isAdmin }: { namaLengkap: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [keluar, setKeluar] = useState(false);
  const [errorKeluar, setErrorKeluar] = useState<string | null>(null);
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  // Mekanik tetap melihat menu admin agar tahu fitur itu ada, tetapi ditandai
  // gembok; halamannya sendiri tampil buram dengan pesan menghubungi admin.
  const nav: NavItem[] = isAdmin
    ? [...BASE_NAV, ...ADMIN_NAV]
    : [...BASE_NAV, ...ADMIN_NAV.map((item) => ({ ...item, terkunci: true }))];

  const labelPeran = isAdmin ? "Administrator" : "Mekanik";

  async function handleKeluar() {
    setKeluar(true);
    setErrorKeluar(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch {
      setErrorKeluar("Gagal keluar. Periksa koneksi lalu coba lagi.");
    } finally {
      setKeluar(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      {/* px harus sama dengan <main> & footer di (app)/layout.tsx agar logo
          sejajar dengan judul halaman di bawahnya. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/home" className="shrink-0" aria-label="Kembali ke beranda WARES">
          <WaresMark />
        </Link>

        <nav className="hidden items-center gap-0.5 2xl:flex">
          {nav.map((item) => {
            const aktif = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.terkunci ? "Kontak admin warehouse untuk mengakses fitur ini." : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  aktif ? "bg-brand-light text-brand-dark" : "text-muted hover:bg-bg hover:text-ink",
                  item.terkunci && !aktif && "opacity-60"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.terkunci ? (
                  <Lock className="h-3 w-3 shrink-0" aria-label="terkunci" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 xl:gap-3">
          {/* Tujuh menu penuh mulai tampil di 2xl. Nama ditunda sampai layar lebar
              agar top bar 1536px tetap punya ruang aman dan tidak meluber. */}
          <div className="hidden max-w-[12rem] text-right leading-tight min-[1800px]:block">
            <div className="truncate text-sm font-semibold text-ink">{namaLengkap}</div>
            <div className="text-[11px] text-muted">{labelPeran}</div>
          </div>
          {/* Target sentuh 40px selama tombol hamburger masih tampil (< 2xl),
              dirampingkan jadi 36px di desktop tempat kursor lebih presisi. */}
          <ThemeToggle className="h-10 w-10 2xl:h-9 2xl:w-9" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleKeluar}
            disabled={keluar}
            className="hidden 2xl:inline-flex"
          >
            <LogOut className="h-4 w-4" />
            {keluar ? "Keluar…" : "Keluar"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="2xl:hidden"
            aria-label={menuTerbuka ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuTerbuka}
            onClick={() => setMenuTerbuka((v) => !v)}
          >
            {menuTerbuka ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuTerbuka ? (
        <div className="border-t border-border bg-surface px-4 py-3 2xl:hidden">
          <div className="mb-2 border-b border-border pb-3">
            <div className="text-sm font-semibold">{namaLengkap}</div>
            <div className="text-[11px] text-muted">{labelPeran}</div>
          </div>
          <div className="flex flex-col gap-1">
            {nav.map((item) => {
              const aktif = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuTerbuka(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                    aktif ? "bg-brand-light text-brand-dark" : "text-muted hover:bg-bg hover:text-ink",
                    item.terkunci && !aktif && "opacity-60"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.terkunci ? (
                    <Lock className="h-3 w-3 shrink-0" aria-label="terkunci" />
                  ) : null}
                </Link>
              );
            })}
            <Button variant="outline" onClick={handleKeluar} disabled={keluar} className="mt-2 justify-start">
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </div>
      ) : null}
      {errorKeluar ? (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-center text-xs font-medium text-destructive" role="alert">
          {errorKeluar}
        </div>
      ) : null}
    </header>
  );
}
