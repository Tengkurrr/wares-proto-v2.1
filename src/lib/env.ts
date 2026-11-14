/**
 * Prototype ini dijalankan sebelum user punya project Supabase.
 * Kalau env belum diisi, app mengarahkan ke /setup — bukan crash.
 */
export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
