import { AksesTerkunci } from "@/components/akses-terkunci";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireProfile } from "@/lib/auth";
import { ambilBarisKeluar } from "@/lib/dashboard";
import { ambilDataKpiAman } from "@/lib/kpi/source";

export const metadata = { title: "Dashboard — WARES" };

export default async function DashboardPage() {
  const profile = await requireProfile();

  // Untuk mekanik, agregasi dashboard sengaja TIDAK diambil: tidak ada satu pun
  // angka milik admin yang dikirim ke browsernya. Yang tampil hanya kerangka buram.
  if (!profile.is_admin) {
    return (
      <AksesTerkunci
        judul="Dashboard"
        deskripsi="Ringkasan dan grafik aktivitas gudang hanya dapat dilihat administrator."
      />
    );
  }

  // Dua sumber yang saling bebas: transaksi dari Postgres, KPI dari spreadsheet.
  // `ambilDataKpiAman` tidak pernah melempar, jadi analitik barang keluar tetap
  // tampil meskipun sheet KPI belum dibuat.
  const [baris, kpi] = await Promise.all([ambilBarisKeluar(), ambilDataKpiAman()]);

  return <DashboardClient baris={baris} kpi={kpi} />;
}
