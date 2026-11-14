import { cobaUlangKueri } from "@/lib/supabase/retry";
import { createClient } from "@/lib/supabase/server";

/** Satu baris barang keluar, sudah diratakan dari request_items + requests + catalog_items. */
export type BarisKeluar = {
  request_id: string;
  user_id: string;
  nama_pemohon: string | null;
  created_at: string;
  pekerjaan: string;
  lokasi_pekerjaan: string;
  nama_barang: string;
  satuan: string;
  /** Yang diminta pemohon — dipakai menghitung tingkat pemenuhan permintaan. */
  jumlah_permintaan: number;
  jumlah_diberikan: number;
  /** Alias untuk komponen dashboard lama; selalu berisi jumlah yang diberikan. */
  jumlah: number;
  /** Kategori asli barang di katalog — null kalau item tidak tertaut katalog. */
  kategori_barang: string | null;
};

/** Batas aman untuk prototype; katalog & transaksi internal masih jauh di bawah angka ini. */
const BATAS_BARIS = 5000;

type BarisMentah = {
  jumlah: number;
  jumlah_diberikan: number | null;
  kategori_barang: string | null;
  lokasi_barang: string | null;
  nama_barang: string;
  satuan: string;
  requests: {
    id: string;
    created_at: string;
    pekerjaan: string;
    lokasi_pekerjaan: string;
    user_id: string;
  } | null;
  catalog_items: { kategori: string } | null;
};

/**
 * Agregasi barang keluar untuk dashboard admin.
 * RLS memastikan hanya admin yang benar-benar menerima seluruh baris.
 */
export async function ambilBarisKeluar(): Promise<BarisKeluar[]> {
  const supabase = await createClient();

  const { data, error } = await cobaUlangKueri(() =>
    supabase
      .from("request_items")
      .select(
        `jumlah, jumlah_diberikan, kategori_barang, lokasi_barang,
       nama_barang,
       satuan,
       requests!inner ( id, created_at, pekerjaan, lokasi_pekerjaan, user_id ),
       catalog_items ( kategori )`
      )
      .limit(BATAS_BARIS)
  );

  if (error) throw new Error("Gagal memuat data dashboard.");
  if (!data) return [];

  const { data: profil, error: profilError } = await supabase
    .from("profiles")
    .select("id, nama_lengkap");
  if (profilError) throw new Error("Gagal memuat nama pemohon untuk dashboard.");
  const petaNama = new Map((profil ?? []).map((p) => [p.id as string, p.nama_lengkap as string]));

  const baris = data as unknown as BarisMentah[];

  return baris
    .filter((b) => b.requests !== null)
    .map((b) => ({
      request_id: b.requests!.id,
      user_id: b.requests!.user_id,
      nama_pemohon: petaNama.get(b.requests!.user_id) ?? null,
      created_at: b.requests!.created_at,
      pekerjaan: b.requests!.pekerjaan,
      lokasi_pekerjaan: b.requests!.lokasi_pekerjaan,
      nama_barang: b.nama_barang,
      satuan: b.satuan,
      jumlah_permintaan: b.jumlah,
      jumlah_diberikan: b.jumlah_diberikan ?? b.jumlah,
      jumlah: b.jumlah_diberikan ?? b.jumlah,
      kategori_barang: b.kategori_barang?.trim() || b.catalog_items?.kategori || null,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
