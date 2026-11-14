"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export const KUNCI_TEMA = "wares-tema";

/**
 * Tombol ganti tema.
 *
 * Ikon dan teksnya digerakkan MURNI oleh kelas `dark:` (CSS), bukan state React.
 * Ini disengaja: kelas `.dark` sudah dipasang skrip anti-kedip sebelum React
 * hidup, jadi kalau tampilan tombol bergantung pada state, hasil render server
 * dan browser akan berbeda dan memicu hydration mismatch.
 */
export function ThemeToggle({
  className,
  tampilkanLabel = false,
}: {
  className?: string;
  tampilkanLabel?: boolean;
}) {
  // Selama pengguna belum pernah memilih sendiri, ikuti setelan perangkat
  // secara langsung (mis. HP berganti ke mode gelap saat malam).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const ikutiSistem = () => {
      try {
        if (localStorage.getItem(KUNCI_TEMA)) return;
      } catch {
        return;
      }
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", ikutiSistem);
    return () => mq.removeEventListener("change", ikutiSistem);
  }, []);

  function gantiTema() {
    const root = document.documentElement;
    const jadiGelap = !root.classList.contains("dark");

    // Transisi hanya dinyalakan selama pergantian, lalu dilepas — supaya
    // hover/fokus biasa tidak ikut melambat.
    root.classList.add("theme-transition");
    root.classList.toggle("dark", jadiGelap);
    try {
      localStorage.setItem(KUNCI_TEMA, jadiGelap ? "gelap" : "terang");
    } catch {
      // Mode privat / storage diblokir: tema tetap berganti untuk sesi ini.
    }
    window.setTimeout(() => root.classList.remove("theme-transition"), 360);
  }

  return (
    <button
      type="button"
      onClick={gantiTema}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-brand-light hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        tampilkanLabel ? "h-10 w-full justify-start px-3 text-sm font-medium" : "h-10 w-10 justify-center",
        className
      )}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Sun
          className="absolute h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0"
          aria-hidden="true"
        />
        <Moon
          className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100"
          aria-hidden="true"
        />
      </span>
      {tampilkanLabel ? (
        <>
          <span className="dark:hidden">Mode gelap</span>
          <span className="hidden dark:inline">Mode terang</span>
        </>
      ) : null}
      <span className="sr-only dark:hidden">Aktifkan mode gelap</span>
      <span className="sr-only hidden dark:inline">Aktifkan mode terang</span>
    </button>
  );
}
