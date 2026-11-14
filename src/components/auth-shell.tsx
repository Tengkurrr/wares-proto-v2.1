import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Kartu autentikasi di atas foto Pabrik 1A. Overlay memakai token `surface`
 * (bukan putih mati) supaya di mode gelap foto ikut diredupkan, bukan disorot.
 */
export function AuthShell({
  children,
  lebar = "max-w-md",
}: {
  children: React.ReactNode;
  lebar?: string;
}) {
  return (
    <div className="relative min-h-screen">
      <Image
        src="/brand/bg-pabrik.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-surface/90 via-surface/[0.62] to-surface/[0.88] dark:from-bg/90 dark:via-bg/75 dark:to-bg/95"
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className={`w-full ${lebar}`}>
          {/* Identitas aplikasi di luar kartu: logo korporat tetap di dalam kartu,
              jadi ketiganya tidak berdesakan di satu blok. */}
          <div className="mb-5 flex justify-center">
            <Image
              src="/brand/wares-logo-badge.png"
              alt="WARES"
              width={512}
              height={512}
              priority
              className="h-16 w-16 drop-shadow-sm sm:h-20 sm:w-20"
            />
          </div>

          <div className="rounded-xl border border-border bg-surface/95 p-7 shadow-pop backdrop-blur-sm sm:p-8">
            {/*
             * Kedua logo ini bertuliskan teks gelap. Di mode gelap logo diberi
             * alas terang tipis agar tetap terbaca — bukan di-invert, supaya
             * warna korporat tidak berubah.
             */}
            <div className="flex justify-center pb-6">
              <div className="flex items-center gap-5 dark:rounded-xl dark:bg-white/90 dark:px-4 dark:py-2.5">
                <Image
                  src="/brand/logo-petrokimia.png"
                  alt="Petrokimia Gresik"
                  width={1200}
                  height={530}
                  priority
                  className="h-10 w-auto"
                />
                <span className="h-9 w-px bg-border dark:bg-black/15" aria-hidden />
                <Image
                  src="/brand/logo-departemen.png"
                  alt="Departemen Pergudangan & Pengantongan"
                  width={1200}
                  height={419}
                  priority
                  className="h-10 w-auto"
                />
              </div>
            </div>

            {children}
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            WARES — Warehouse Request System · Dept. Pergudangan &amp; Pengantongan
          </p>
        </div>
      </div>
    </div>
  );
}
