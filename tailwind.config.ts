import type { Config } from "tailwindcss";

/**
 * Semua warna menunjuk ke CSS variable di `globals.css`, bukan hex mati.
 * Pola `rgb(var(--x) / <alpha-value>)` wajib dipertahankan supaya modifier
 * opasitas (bg-brand/25, border-gold/50, bg-surface/80, …) tetap berfungsi.
 */
const warna = (nama: string) => `rgb(var(${nama}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: warna("--brand"),
          dark: warna("--brand-dark"),
          light: warna("--brand-light"),
          fg: warna("--brand-fg"),
        },
        gold: {
          DEFAULT: warna("--gold"),
          ink: warna("--gold-ink"),
        },
        ink: warna("--ink"),
        muted: {
          DEFAULT: warna("--muted"),
          foreground: warna("--muted"),
        },
        surface: warna("--surface"),
        bg: warna("--bg"),
        border: warna("--border"),
        // Alias shadcn/ui, dipetakan ke palet WARES
        background: warna("--bg"),
        foreground: warna("--ink"),
        input: warna("--border"),
        ring: warna("--brand"),
        primary: {
          DEFAULT: warna("--brand"),
          foreground: warna("--brand-fg"),
        },
        secondary: {
          DEFAULT: warna("--brand-light"),
          foreground: warna("--brand-dark"),
        },
        accent: {
          DEFAULT: warna("--brand-light"),
          foreground: warna("--brand-dark"),
        },
        destructive: {
          DEFAULT: warna("--destructive"),
          foreground: warna("--destructive-fg"),
        },
        card: {
          DEFAULT: warna("--surface"),
          foreground: warna("--ink"),
        },
        popover: {
          DEFAULT: warna("--surface"),
          foreground: warna("--ink"),
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.625rem",
        sm: "0.5rem",
      },
      boxShadow: {
        // Bayangan ikut tema: di mode gelap --shadow-color jadi hitam pekat
        // supaya kartu tetap punya kedalaman, bukan kabut abu.
        card: "0 1px 2px 0 rgb(var(--shadow-color) / 0.04), 0 1px 3px 0 rgb(var(--shadow-color) / 0.06)",
        pop: "0 8px 24px -6px rgb(var(--shadow-color) / 0.12), 0 2px 6px -2px rgb(var(--shadow-color) / 0.06)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
