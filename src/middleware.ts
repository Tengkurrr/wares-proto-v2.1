import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";
import { isLocalMode } from "@/lib/local-mode";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Mode lokal (review tanpa DB): teruskan semua request; auth distub di
  // requireProfile dan data dari fixture. Tidak ada redirect ke /setup atau /login.
  if (isLocalMode()) return NextResponse.next();

  // Belum ada kredensial Supabase → tampilkan panduan setup, jangan error.
  if (!hasSupabaseEnv()) {
    if (pathname === "/setup") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/setup") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Setiap Route Handler memverifikasi sesi dan hak aksesnya sendiri. Melewati
  // updateSession di sini menghindari dua panggilan Supabase Auth untuk satu API call.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Lapis terakhir: apa pun yang gagal di updateSession tidak boleh membuat
  // seluruh situs membalas 500. Lebih baik permintaan diteruskan — guard halaman
  // (requireProfile) dan RLS tetap menjaga akses data.
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("[WARES] Middleware gagal, permintaan diteruskan:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Semua path kecuali aset statis & gambar.
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
