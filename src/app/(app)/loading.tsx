export default function AppLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Memuat halaman">
      {/* Rangka memakai token tema: di mode gelap skeleton putih akan menyilaukan. */}
      <div className="h-8 w-48 animate-pulse rounded bg-border" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-border/60" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <span className="sr-only">Memuat data...</span>
    </div>
  );
}
