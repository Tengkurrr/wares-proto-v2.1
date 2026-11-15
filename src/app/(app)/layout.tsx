import { TopBar } from "@/components/top-bar";
import { requireProfile } from "@/lib/auth";
import { isLocalMode } from "@/lib/local-mode";
import { peranDariProfile } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        namaLengkap={profile.nama_lengkap}
        peran={peranDariProfile(profile)}
        lokal={isLocalMode()}
      />
      {/* Padding tepi naik jadi 40px di layar besar supaya konten tidak mepet tepi
          pada laptop 1280px (di sana max-w-7xl memenuhi lebar layar). Nilai ini
          WAJIB sama dengan top-bar dan footer agar semuanya tetap sejajar. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6 lg:px-10">
          WARES — Departemen Pergudangan &amp; Pengantongan, PT Petrokimia Gresik.
        </div>
      </footer>
    </div>
  );
}
