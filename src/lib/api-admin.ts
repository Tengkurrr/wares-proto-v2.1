import "server-only";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function requireApiAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (error || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 403 }),
    };
  }
  if (!profile.is_admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Akses hanya tersedia untuk admin." }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, user };
}
