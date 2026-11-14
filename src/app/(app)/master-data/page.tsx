import { AksesTerkunci } from "@/components/akses-terkunci";
import { MasterDataEditor } from "@/components/master-data-editor";
import { requireProfile } from "@/lib/auth";
import { inspectMasterSource } from "@/lib/master-data/config";

export const metadata = { title: "Master Data — WARES" };

export default async function MasterDataPage() {
  const profile = await requireProfile();

  if (!profile.is_admin) {
    return (
      <AksesTerkunci
        judul="Master Data"
        deskripsi="Pengelolaan data material hanya dapat dilakukan administrator."
      />
    );
  }

  // Inspeksi non-throwing: halaman tetap dapat menjelaskan salah konfigurasi
  // MASTER_SOURCE alih-alih gagal render sebelum komponen diagnostik muncul.
  const sourceConfig = inspectMasterSource();

  return (
    <div className="space-y-6">
      <div>
        <h1>Master Data</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">
          Kelola identitas, lokasi, dan status material dari sumber data gudang yang aktif.
          Perubahan tersimpan cepat di database; status sinkronisasi spreadsheet ditampilkan terpisah
          agar proses latar tidak terasa sebagai halaman macet.
        </p>
      </div>
      <MasterDataEditor
        source={sourceConfig.ok ? sourceConfig.source : null}
        sourceConfigReason={sourceConfig.ok ? undefined : sourceConfig.reason}
      />
    </div>
  );
}
