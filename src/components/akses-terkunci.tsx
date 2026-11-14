import { Lock } from "lucide-react";

/**
 * Tampilan halaman yang hanya boleh dibuka admin, saat diakses oleh mekanik.
 *
 * Penting: yang diburamkan hanya KERANGKA HIASAN, bukan data asli — halaman
 * pemanggil tidak boleh mengambil datanya sama sekali untuk peran ini. Jadi
 * tidak ada data admin yang terkirim ke browser mekanik, dan buram di sini
 * murni isyarat visual (bukan pengaman). Pengamanan sesungguhnya tetap di
 * RLS database dan pemeriksaan admin pada setiap route API.
 */
export function AksesTerkunci({
  judul,
  deskripsi,
}: {
  judul: string;
  deskripsi: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1>{judul}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">{deskripsi}</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        {/* Kerangka hiasan — sekadar memberi bentuk halaman di balik lapisan buram. */}
        <div
          className="pointer-events-none select-none blur-[6px]"
          aria-hidden="true"
        >
          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-bg p-4">
                  <div className="h-3 w-20 rounded bg-border" />
                  <div className="mt-3 h-7 w-24 rounded bg-brand/25" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-bg p-4">
              <div className="h-3 w-32 rounded bg-border" />
              <div className="mt-4 flex items-end gap-2">
                {[38, 64, 28, 52, 72, 44, 60].map((tinggi, i) => (
                  <div
                    key={i}
                    className="w-full rounded-t bg-brand/30"
                    style={{ height: `${tinggi}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-bg p-3">
                  <div className="h-3 w-1/3 rounded bg-border" />
                  <div className="h-3 w-1/5 rounded bg-border" />
                  <div className="ml-auto h-3 w-16 rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lapisan pesan */}
        <div className="absolute inset-0 flex items-center justify-center bg-surface/70 p-4">
          <div className="max-w-sm rounded-xl border border-border bg-surface px-6 py-7 text-center shadow-card">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-dark">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold text-ink">Fitur terkunci</p>
            <p className="mt-1.5 text-sm text-muted">
              Kontak admin warehouse untuk mengakses fitur ini.
            </p>
            <p className="mt-3 text-xs text-muted">
              Akun Anda terdaftar sebagai <strong className="text-ink">Mekanik</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
