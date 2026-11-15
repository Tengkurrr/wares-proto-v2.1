import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_PERAN, isLocalMode } from "@/lib/local-mode";
import { isPeran, peranDariProfile, type Peran } from "@/lib/roles";
import { cobaUlangKueri } from "@/lib/supabase/retry";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Profil sintetis untuk mode lokal (tanpa database). Peran diambil dari cookie
 * yang di-set pengalih peran dev-only; default maintenance.
 */
async function profilLokal(): Promise<Profile> {
  let peran: Peran = "maintenance";
  try {
    const nilai = (await cookies()).get(COOKIE_PERAN)?.value;
    if (isPeran(nilai)) peran = nilai;
  } catch {
    /* abaikan: pakai default */
  }
  const label =
    peran === "admin" ? "Administrator" : peran === "warehouse" ? "Petugas Gudang" : "Mekanik";
  return {
    id: `local-${peran}`,
    username: `PG-${peran.toUpperCase()}`,
    nama_lengkap: `${label} (Demo)`,
    no_hp: null,
    email_kerja: null,
    is_admin: peran === "admin",
    role: peran,
    created_at: new Date().toISOString(),
  };
}

/**
 * Ambil user + profil yang sedang login. Redirect ke /login kalau belum login.
 * Middleware sudah menjaga route, ini lapis kedua supaya tipe data pasti ada.
 *
 * Dibungkus `cache()` React: dalam satu render request, layout dan page (juga
 * requireAdmin) berbagi satu hasil, jadi getUser + query profiles tidak dobel.
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  // Mode lokal: lewati Supabase sepenuhnya, pakai profil demo dari cookie peran.
  if (isLocalMode()) return profilLokal();

  const supabase = await createClient();

  // getUser di-retry: satu gangguan sesaat tidak boleh melempar pengguna yang
  // sebenarnya masih login (middleware sudah melewatkan mereka ke sini).
  const { data } = await cobaUlangKueri(async () => {
    const res = await supabase.auth.getUser();
    return { data: { user: res.data.user ?? null }, error: res.error };
  });
  const user = data?.user;

  if (!user) redirect("/login");

  const { data: profile } = await cobaUlangKueri(() =>
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>()
  );

  if (!profile) {
    // Akun auth ada tapi baris profiles hilang — paksa login ulang.
    redirect("/login?error=profil-tidak-ditemukan");
  }

  return profile;
});

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) {
    redirect("/buat-permintaan?pesan=akses-dashboard-ditolak");
  }
  return profile;
}
