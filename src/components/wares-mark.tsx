import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Wordmark WARES — "WA" beraksen hijau, dengan logo WARES di sebelahnya.
 *
 * Memakai varian badge (beralas lingkaran putih), bukan yang transparan: sisi
 * hijau tua logo hanya berkontras ~1,6:1 di atas permukaan mode gelap sehingga
 * satu sisi kubusnya hilang.
 */
export function WaresMark({
  className,
  showSubtext = true,
}: {
  className?: string;
  showSubtext?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/brand/wares-logo-badge.png"
        alt="Logo WARES"
        width={512}
        height={512}
        priority
        className="h-9 w-9"
      />
      <div className="leading-none">
        <div className="text-xl font-extrabold tracking-tight">
          <span className="text-brand dark:text-brand-dark">WA</span>
          <span className="text-ink">RES</span>
        </div>
        {showSubtext ? (
          <div className="mt-1 text-[11px] font-medium text-muted">Warehouse Request System</div>
        ) : null}
      </div>
    </div>
  );
}
