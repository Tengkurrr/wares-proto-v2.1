"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { COOKIE_PERAN } from "@/lib/local-mode";
import { DAFTAR_PERAN, type Peran } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Pengalih peran DEV-ONLY untuk mode lokal: mengganti peran demo tanpa login.
 * Menyetel cookie peran lalu refresh agar server (requireProfile) membacanya.
 * Dicabut saat auth sungguhan (Supabase) aktif.
 */
export function RoleSwitcher({ peran }: { peran: Peran }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pilih(p: Peran) {
    if (p === peran) return;
    document.cookie = `${COOKIE_PERAN}=${p}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", pending && "opacity-60")}
      title="Pengalih peran (mode lokal/demo)"
    >
      <span className="hidden text-[11px] font-medium text-muted sm:inline">Peran</span>
      <div className="flex rounded-lg border border-border p-0.5">
        {DAFTAR_PERAN.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pilih(p.id)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              peran === p.id ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
