/**
 * Percobaan ulang untuk kueri Supabase yang gagal karena gangguan sesaat
 * (cold start serverless, jaringan, pool koneksi). Fungsi serverless di Vercel
 * kerap gagal pada panggilan pertama lalu sukses saat diulang; retry singkat ini
 * membuat error sesaat tidak sampai menjatuhkan seluruh halaman.
 *
 * `buatKueri` HARUS membuat kueri baru tiap panggilan — builder Supabase sekali
 * pakai, jadi factory dijalankan ulang untuk tiap percobaan.
 */
type HasilKueri<T> = { data: T; error: { message?: string } | null };

export async function cobaUlangKueri<T>(
  buatKueri: () => PromiseLike<HasilKueri<T>>,
  opsi?: { percobaan?: number; jedaMs?: number }
): Promise<HasilKueri<T>> {
  const percobaan = Math.max(1, opsi?.percobaan ?? 4);
  const jedaMs = opsi?.jedaMs ?? 250;

  let hasil: HasilKueri<T> = {
    data: undefined as T,
    error: { message: "Kueri tidak dijalankan." },
  };

  for (let i = 0; i < percobaan; i += 1) {
    try {
      hasil = await buatKueri();
    } catch (error) {
      hasil = {
        data: undefined as T,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }

    if (!hasil.error) return hasil;

    // Backoff bertahap: 150ms, 300ms, … Hanya menunggu bila masih ada percobaan.
    if (i < percobaan - 1) {
      await new Promise((resolve) => setTimeout(resolve, jedaMs * (i + 1)));
    }
  }

  return hasil;
}
