"use client";

import { useEffect, useState } from "react";

/**
 * recharts butuh angka, bukan class CSS, untuk lebar sumbu & tinggi chart —
 * jadi ukuran layar dibaca lewat matchMedia.
 */
export function useLayarKecil(maxWidth = 640) {
  const [kecil, setKecil] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sinkron = () => setKecil(mq.matches);
    sinkron();
    mq.addEventListener("change", sinkron);
    return () => mq.removeEventListener("change", sinkron);
  }, [maxWidth]);

  return kecil;
}

/**
 * recharts menerima warna sebagai prop JS (bukan class CSS), jadi nilainya harus
 * dibaca dari CSS variable secara manual — dan dibaca ULANG saat tema berganti.
 * Tanpa ini, garis grid & label sumbu tetap memakai warna mode terang dan nyaris
 * tak terlihat di mode gelap.
 */
/** Nilai awal = palet mode terang. Dipakai pada render pertama sebelum efek
 *  membaca CSS variable, sehingga grafik tidak pernah tampil tanpa warna. */
const WARNA_AWAL = {
  grid: "#E5E7EB",
  sumbu: "#6B7280",
  permukaan: "#FFFFFF",
  teks: "#1A1A1A",
  garisTepi: "#E5E7EB",
  seri: [
    "#00A547",
    "#FBC800",
    "#00813A",
    "#5FCE93",
    "#C79F00",
    "#0B6E36",
    "#9BDFBB",
    "#FFE071",
    "#04512A",
    "#8A7100",
  ],
};

export type WarnaGrafik = typeof WARNA_AWAL;

export function useWarnaGrafik(): WarnaGrafik {
  const [warna, setWarna] = useState(WARNA_AWAL);

  useEffect(() => {
    const baca = () => {
      const gaya = getComputedStyle(document.documentElement);
      const ambil = (nama: string, cadangan: string) => {
        const kanal = gaya.getPropertyValue(nama).trim();
        return kanal ? `rgb(${kanal})` : cadangan;
      };
      setWarna({
        grid: ambil("--chart-grid", "#E5E7EB"),
        sumbu: ambil("--chart-axis", "#6B7280"),
        permukaan: ambil("--surface", "#FFFFFF"),
        teks: ambil("--ink", "#1A1A1A"),
        garisTepi: ambil("--border", "#E5E7EB"),
        seri: Array.from({ length: 10 }, (_, i) => ambil(`--chart-${i + 1}`, "#00A547")),
      });
    };

    baca();
    // Kelas `dark` dipasang/dilepas di <html> oleh tombol tema.
    const pengamat = new MutationObserver(baca);
    pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => pengamat.disconnect();
  }, []);

  return warna;
}

export function gayaTooltip(w: WarnaGrafik) {
  return {
    contentStyle: {
      borderRadius: 12,
      border: `1px solid ${w.garisTepi}`,
      backgroundColor: w.permukaan,
      boxShadow: "0 8px 24px -6px rgb(0 0 0 / 0.25)",
      fontSize: 12,
    },
    labelStyle: { fontWeight: 600, color: w.teks },
    itemStyle: { color: w.teks },
  };
}
