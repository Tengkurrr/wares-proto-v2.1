import { cobaUlangKueri } from "@/lib/supabase/retry";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RequestItemRow, RequestRow } from "@/lib/types";

export type RequestLengkap = RequestRow & {
  items: RequestItemRow[];
  pemilik: Pick<Profile, "username" | "nama_lengkap"> | null;
};

export type HasilAmbilRequest =
  | { status: "ok"; request: RequestLengkap }
  | { status: "not-found" }
  | { status: "error"; pesan: string };

/**
 * Ambil satu request beserta barangnya. RLS yang memutuskan boleh/tidak:
 * user hanya bisa membaca miliknya, admin bisa membaca semua.
 *
 * Tidak melempar: mengembalikan status "error" supaya halaman bisa menampilkan
 * banner in-line alih-alih memicu error boundary penuh.
 */
export async function ambilRequest(id: string): Promise<HasilAmbilRequest> {
  const supabase = await createClient();

  const { data: request, error: requestError } = await cobaUlangKueri(() =>
    supabase.from("requests").select("*").eq("id", id).maybeSingle<RequestRow>()
  );

  if (requestError) return { status: "error", pesan: "Gagal memuat permintaan dari database." };
  if (!request) return { status: "not-found" };

  // Kueri sekunder tidak menjatuhkan halaman: bila gagal, tampilkan seadanya.
  const { data: items } = await cobaUlangKueri(() =>
    supabase.from("request_items").select("*").eq("request_id", id).order("urutan")
  );

  const { data: pemilik } = await cobaUlangKueri(() =>
    supabase
      .from("profiles")
      .select("username, nama_lengkap")
      .eq("id", request.user_id)
      .maybeSingle<Pick<Profile, "username" | "nama_lengkap">>()
  );

  return {
    status: "ok",
    request: {
      ...request,
      items: (items as RequestItemRow[]) ?? [],
      pemilik: pemilik ?? null,
    },
  };
}

export type RingkasanRiwayat = RequestRow & {
  jumlah_item: number;
  total_permintaan: number;
  total_diberikan: number;
  /** Alias sementara untuk tampilan lama; nilainya adalah total yang diberikan. */
  total_unit: number;
  nama_pemilik: string | null;
};

export type HasilDaftarRiwayat = {
  items: RingkasanRiwayat[];
  /** Berisi pesan bila kueri utama gagal, supaya halaman bisa menampilkan banner. */
  errorPesan: string | null;
};

/** Daftar riwayat: milik user sendiri, atau seluruhnya untuk admin (dijaga RLS). */
export async function ambilDaftarRiwayat(): Promise<HasilDaftarRiwayat> {
  const supabase = await createClient();

  const { data: requests, error: requestsError } = await cobaUlangKueri(() =>
    supabase.from("requests").select("*").order("created_at", { ascending: false })
  );

  if (requestsError) {
    return { items: [], errorPesan: "Koneksi database sedang tersendat. Coba muat ulang sebentar lagi." };
  }

  const daftar = (requests as RequestRow[]) ?? [];
  if (daftar.length === 0) return { items: [], errorPesan: null };

  const ids = daftar.map((r) => r.id);

  // Kueri sekunder degradasi anggun: bila gagal (mis. gangguan sesaat atau kolom
  // baru belum ada di database), daftar tetap tampil tanpa angka agregat, bukan
  // menampilkan halaman error.
  const { data: items } = await cobaUlangKueri(() =>
    supabase
      .from("request_items")
      .select("request_id, jumlah, jumlah_permintaan, jumlah_diberikan")
      .in("request_id", ids)
  );

  const { data: profil } = await cobaUlangKueri(() =>
    supabase.from("profiles").select("id, nama_lengkap")
  );

  const petaNama = new Map((profil ?? []).map((p) => [p.id as string, p.nama_lengkap as string]));

  type ItemRingkas = {
    request_id: string;
    jumlah: number;
    jumlah_permintaan: number | null;
    jumlah_diberikan: number | null;
  };
  const agregat = new Map<
    string,
    { jumlah_item: number; total_permintaan: number; total_diberikan: number }
  >();
  for (const it of (items as ItemRingkas[]) ?? []) {
    const cur = agregat.get(it.request_id) ?? {
      jumlah_item: 0,
      total_permintaan: 0,
      total_diberikan: 0,
    };
    cur.jumlah_item += 1;
    cur.total_permintaan += it.jumlah_permintaan ?? it.jumlah;
    cur.total_diberikan += it.jumlah_diberikan ?? it.jumlah;
    agregat.set(it.request_id, cur);
  }

  return {
    items: daftar.map((r) => {
      const total = agregat.get(r.id);
      return {
        ...r,
        jumlah_item: total?.jumlah_item ?? 0,
        total_permintaan: total?.total_permintaan ?? 0,
        total_diberikan: total?.total_diberikan ?? 0,
        total_unit: total?.total_diberikan ?? 0,
        nama_pemilik: petaNama.get(r.user_id) ?? null,
      };
    }),
    errorPesan: null,
  };
}
