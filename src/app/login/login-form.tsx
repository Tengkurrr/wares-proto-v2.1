"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pesanErrorAuth } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import { usernameToEmail } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorServer, setErrorServer] = useState<string | null>(null);
  const [lihatPassword, setLihatPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setErrorServer(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(values.username),
      password: values.password,
    });

    if (error) {
      setErrorServer(pesanErrorAuth(error.message));
      return;
    }

    const next = searchParams.get("next");
    const tujuanAman = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
    router.push(tujuanAman);
    router.refresh();
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-[28px]">Selamat Datang</h1>
        <p className="mt-1.5 text-sm text-muted">Masuk dengan username &amp; password</p>
      </div>

      {searchParams.get("error") === "profil-tidak-ditemukan" ? (
        <Alert variant="warning" className="mt-6">
          Profil untuk akun ini tidak ditemukan. Hubungi administrator.
        </Alert>
      ) : null}

      {errorServer ? (
        <Alert variant="destructive" className="mt-6">
          {errorServer}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="PG123456"
            className="mt-1.5"
            aria-invalid={Boolean(errors.username)}
            {...register("username")}
          />
          <FieldError pesan={errors.username?.message} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={lihatPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setLihatPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-bg hover:text-ink"
              aria-label={lihatPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {lihatPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError pesan={errors.password?.message} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Memproses…
            </>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/signup" className="font-semibold text-brand dark:text-brand-dark underline-offset-4 hover:underline">
          Daftar di sini
        </Link>
      </p>
    </div>
  );
}
