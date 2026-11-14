/** Supabase mengembalikan pesan bahasa Inggris; UI WARES berbahasa Indonesia. */
export function pesanErrorAuth(pesan: string | undefined): string {
  if (!pesan) return "Terjadi kesalahan. Coba lagi.";
  const p = pesan.toLowerCase();

  if (p.includes("invalid login credentials")) return "Username atau password salah.";
  if (p.includes("email not confirmed")) {
    return 'Akun belum aktif. Matikan "Confirm email" di Supabase → Authentication → Providers → Email.';
  }
  if (p.includes("user already registered") || p.includes("already been registered")) {
    return "Username ini sudah terdaftar. Silakan pilih username lain atau langsung masuk.";
  }
  if (p.includes("duplicate key") && p.includes("username")) {
    return "Username ini sudah dipakai. Silakan pilih username lain.";
  }
  if (p.includes("password should be at least")) return "Password minimal 6 karakter.";
  if (p.includes("username_prefix")) return 'Username wajib diawali "PG".';
  if (p.includes("rate limit") || p.includes("too many requests")) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  }
  if (p.includes("failed to fetch") || p.includes("networkerror")) {
    return "Tidak bisa terhubung ke server. Periksa koneksi dan kredensial Supabase di .env.local.";
  }

  return pesan;
}
