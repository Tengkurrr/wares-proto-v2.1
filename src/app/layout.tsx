import type { Metadata, Viewport } from "next";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Jangan kunci zoom: user gudang sering perlu memperbesar tabel barang.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00A547" },
    { media: "(prefers-color-scheme: dark)", color: "#14161A" },
  ],
};

export const metadata: Metadata = {
  title: "WARES — Warehouse Request System",
  description:
    "Sistem permintaan barang gudang Departemen Pergudangan & Pengantongan, Petrokimia Gresik.",
};

/*
 * Dijalankan SEBELUM browser menggambar apa pun, sehingga halaman tidak pernah
 * berkedip putih dulu lalu berubah gelap. Sengaja ditulis sebagai string ES5
 * tanpa dependensi: skrip ini harus jalan mendahului seluruh bundle React.
 * Urutan: pilihan tersimpan → setelan perangkat.
 */
const SKRIP_TEMA = `(function(){try{var t=localStorage.getItem("wares-tema");if(t==="gelap"||(t!=="terang"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: skrip di atas menambah kelas `dark` pada <html>
    // sebelum React hidup, jadi atribut class server & browser memang beda.
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
