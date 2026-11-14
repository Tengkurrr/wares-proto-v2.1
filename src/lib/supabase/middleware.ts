import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Keep this call directly after createServerClient: it refreshes the auth token.
  //
  // Dibedakan dengan tegas:
  //   • gagal teknis (jaringan/cold start)  → `gangguan = true`
  //   • berhasil tapi memang belum login    → `gangguan = false`, user null
  // Membedakan keduanya penting: gangguan sesaat TIDAK boleh melogout pengguna
  // yang sebenarnya masih punya sesi sah.
  let user = null;
  let gangguan = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) gangguan = true;
    user = data.user ?? null;
  } catch {
    // getUser() melempar saat fetch ke Supabase putus. Tanpa tangkapan ini
    // middleware ikut melempar dan SELURUH situs balas 500.
    gangguan = true;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  // Saat gangguan, teruskan saja permintaannya. Halaman tetap aman: `requireProfile`
  // punya retry sendiri dan mengarahkan ke /login bila memang tak ada sesi, dan RLS
  // tetap menjaga datanya. Ini jauh lebih baik daripada melempar user ke /login.
  if (gangguan) return supabaseResponse;

  function redirectDenganCookie(url: URL) {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectDenganCookie(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return redirectDenganCookie(url);
  }

  return supabaseResponse;
}
