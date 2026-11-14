"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Jaring pengaman paling luar: dipakai hanya bila root layout sendiri yang gagal,
 * saat `(app)/error.tsx` tidak sempat terpasang. Tanpa berkas ini user melihat
 * layar putih kosong tanpa jalan keluar.
 *
 * Sengaja tidak memakai komponen UI apa pun — kalau modul UI yang rusak, halaman
 * ini harus tetap bisa dirender.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[WARES] Kesalahan tingkat root:", error);
  }, [error]);

  return (
    // Halaman ini mengganti root layout sepenuhnya, jadi skrip tema di sana tidak
    // ikut jalan — diulang di sini supaya layar error tidak menyilaukan saat
    // pengguna sedang memakai mode gelap.
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("wares-tema");if(t==="gelap"||(t!=="terang"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          {/* Sengaja <img> biasa, bukan next/image: halaman ini adalah jaring
              pengaman terakhir dan tidak boleh bergantung pada pengoptimal gambar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wares-logo-badge.png" alt="WARES" width={56} height={56} />
          <h1 className="text-xl font-semibold">Aplikasi gagal dimuat</h1>
          <p className="text-sm text-muted">
            Terjadi kesalahan tak terduga. Data Anda tidak dihapus. Coba muat ulang halaman.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
            >
              Coba lagi
            </button>
            <a
              href="/home"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              Kembali ke beranda
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
