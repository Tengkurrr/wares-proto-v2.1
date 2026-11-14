"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Bertahan lintas remount error boundary supaya auto-retry tidak berulang tanpa henti.
// Jendela 30 detik: dalam kurun itu maksimal 3× otomatis, lalu berhenti sampai user aksi.
let jumlahAutoRetry = 0;
let jendelaMulai = 0;

const JEDA_MS = [900, 2_000, 4_500];

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Sebagian besar error di sini adalah gangguan koneksi sesaat (cold start Vercel/
  // Supabase). Auto-retry berjenjang: 0.9s → 2s → 4.5s. Setelah 3× dalam 30 detik,
  // berhenti otomatis; user tinggal klik "Coba lagi" atau reload manual.
  useEffect(() => {
    const now = Date.now();
    if (now - jendelaMulai > 30_000) {
      jendelaMulai = now;
      jumlahAutoRetry = 0;
    }
    if (jumlahAutoRetry >= JEDA_MS.length) return;
    const jeda = JEDA_MS[jumlahAutoRetry];
    jumlahAutoRetry += 1;
    const timer = window.setTimeout(() => reset(), jeda);
    return () => window.clearTimeout(timer);
  }, [reset]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="rounded-full bg-gold/15 p-3 text-gold-ink" aria-hidden="true">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Data belum berhasil dimuat</h1>
          <p className="mt-2 text-sm text-muted">
            Koneksi ke database sedang bermasalah. Data Anda tidak dihapus; coba muat ulang halaman.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba lagi
          </Button>
          <Button asChild variant="outline">
            <Link href="/home">Kembali ke beranda</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
