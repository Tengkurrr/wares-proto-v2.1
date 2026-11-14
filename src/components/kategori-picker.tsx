"use client";

import { Check } from "lucide-react";

import { KATEGORI } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Jenis pekerjaan (multi-select). Selain masuk ke surat, pilihan di sini
 * juga menjadi FILTER katalog barang di bawahnya.
 */
export function KategoriPicker({
  terpilih,
  onChange,
  invalid,
}: {
  terpilih: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
}) {
  function toggle(k: string) {
    onChange(terpilih.includes(k) ? terpilih.filter((x) => x !== k) : [...terpilih, k]);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-lg p-0.5",
        invalid && "ring-2 ring-destructive/30 ring-offset-2"
      )}
    >
      {KATEGORI.map((k) => {
        const aktif = terpilih.includes(k);
        return (
          <button
            key={k}
            type="button"
            role="checkbox"
            aria-checked={aktif}
            onClick={() => toggle(k)}
            className={cn(
              "inline-flex min-h-[2.5rem] items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 sm:min-h-0 sm:py-2",
              aktif
                ? "border-brand bg-brand text-brand-fg hover:bg-brand-dark"
                : "border-border bg-surface text-muted hover:border-brand/40 hover:bg-brand-light hover:text-brand-dark"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
                aktif ? "border-white/70 bg-white/20" : "border-border bg-bg"
              )}
            >
              {aktif ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
            </span>
            {k}
          </button>
        );
      })}
    </div>
  );
}
