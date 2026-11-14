import { cn } from "@/lib/utils";

/**
 * Warna status mengikuti arti operasional, bukan sekadar estetika:
 * Kritis = merah (harus pesan sekarang & stok diproyeksikan tekor sebelum tiba),
 * Pesan sekarang = kuning (ada pesanan pada review ini), Cukup = hijau.
 */
const GAYA: Record<string, string> = {
  Kritis: "bg-destructive/15 text-destructive border-destructive/30",
  "Pesan sekarang": "bg-gold/20 text-gold-ink border-gold/40",
  Cukup: "bg-brand-light text-brand-dark border-transparent",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        GAYA[status] ?? "border-border text-muted",
        className
      )}
    >
      {status}
    </span>
  );
}
