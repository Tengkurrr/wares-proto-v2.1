import { CheckCircle2 } from "lucide-react";

import { WaresMark } from "@/components/wares-mark";

const LANGKAH = [
  {
    judul: "Buat project Supabase",
    detail: (
      <>
        Buka{" "}
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand dark:text-brand-dark underline underline-offset-2"
        >
          supabase.com/dashboard
        </a>{" "}
        → <strong>New Project</strong>. Setelah jadi, buka <strong>Project Settings → API</strong> dan catat{" "}
        <em>Project URL</em>, <em>anon public key</em>, dan <em>service_role key</em>.
      </>
    ),
  },
  {
    judul: "Matikan konfirmasi email",
    detail: (
      <>
        <strong>Authentication → Sign In / Providers → Email</strong>: matikan{" "}
        <strong>&ldquo;Confirm email&rdquo;</strong>. WARES memakai email sintetis internal
        (<code className="rounded bg-bg px-1 py-0.5 text-[13px]">username@wares.local</code>), jadi tidak ada
        email yang benar-benar terkirim.
      </>
    ),
  },
  {
    judul: "Jalankan skema database",
    detail: (
      <>
        Buka <strong>SQL Editor</strong>, salin seluruh isi{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[13px]">supabase/schema.sql</code> dari folder project, lalu{" "}
        <strong>Run</strong>.
      </>
    ),
  },
  {
    judul: "Deploy integrasi Google Sheets",
    detail: (
      <>
        Buka spreadsheet stok → <strong>Extensions → Apps Script</strong>, lalu salin file dari folder{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[13px]">google-apps-script</code>. Buat Script
        Property <code className="rounded bg-bg px-1 py-0.5 text-[13px]">WARES_API_SECRET</code>, jalankan{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[13px]">installMonthlyTrigger()</code>, dan deploy
        sebagai Web App.
      </>
    ),
  },
  {
    judul: "Isi .env.local",
    detail: (
      <>
        Salin <code className="rounded bg-bg px-1 py-0.5 text-[13px]">.env.local.example</code> menjadi{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[13px]">.env.local</code>, lalu isi kunci Supabase,
        URL Web App Apps Script, dan secret yang sama.
      </>
    ),
  },
  {
    judul: "Isi katalog & akun admin",
    detail: (
      <>
        Jalankan <code className="rounded bg-bg px-1 py-0.5 text-[13px]">npm run seed</code> — mengisi 1.271 item
        katalog dan membuat akun admin <strong>PGADMIN</strong>.
      </>
    ),
  },
  {
    judul: "Nyalakan ulang server",
    detail: (
      <>
        Hentikan lalu jalankan lagi <code className="rounded bg-bg px-1 py-0.5 text-[13px]">npm run dev</code>.
        Next.js hanya membaca <code className="rounded bg-bg px-1 py-0.5 text-[13px]">.env.local</code> saat start.
      </>
    ),
  },
];

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <WaresMark />

        <div className="mt-8 card-surface p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold-ink">
            Setup belum selesai
          </div>
          <h1 className="mt-4">Hubungkan Supabase dulu</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Aplikasi berhasil berjalan, tapi kredensial Supabase di{" "}
            <code className="rounded bg-bg px-1 py-0.5 text-[13px]">.env.local</code> belum terisi. Selesaikan tujuh
            langkah di bawah, lalu muat ulang halaman ini.
          </p>

          <ol className="mt-8 space-y-6">
            {LANGKAH.map((l, i) => (
              <li key={l.judul} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-ink">{l.judul}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{l.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-start gap-2 rounded-lg border border-brand/25 bg-brand-light px-4 py-3 text-sm text-brand-dark">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Panduan lengkap ada di <strong>README.md</strong> pada folder project.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
