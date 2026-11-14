"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { signupSchema, type SignupValues } from "@/lib/schemas";
import { usernameToEmail } from "@/lib/utils";

export function SignupForm() {
  const router = useRouter();
  const [errorServer, setErrorServer] = useState<string | null>(null);
  const [lihatPassword, setLihatPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      nama_lengkap: "",
      no_hp: "",
      email_kerja: "",
      password: "",
      konfirmasi_password: "",
    },
  });

  async function onSubmit(values: SignupValues) {
    setErrorServer(null);
    const supabase = createClient();
    const username = values.username.trim().toUpperCase();

    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: values.password,
    });

    if (error) {
      setErrorServer(pesanErrorAuth(error.message));
      return;
    }

    if (!data.user) {
      setErrorServer("Pendaftaran gagal. Coba lagi.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      nama_lengkap: values.nama_lengkap.trim(),
      no_hp: values.no_hp?.trim() || null,
      email_kerja: values.email_kerja.trim(),
      is_admin: false,
    });

    if (profileError) {
      // Akun auth sudah terbentuk tapi profil gagal — keluarkan sesi supaya tidak nyangkut.
      await supabase.auth.signOut();
      setErrorServer(pesanErrorAuth(profileError.message));
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-[28px]">Buat Akun</h1>
        <p className="mt-1.5 text-sm text-muted">Daftar untuk mulai mengajukan permintaan barang</p>
      </div>

      {errorServer ? (
        <Alert variant="destructive" className="mt-6">
          {errorServer}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="PG123456"
              className="mt-1.5"
              aria-invalid={Boolean(errors.username)}
              {...register("username")}
            />
            {errors.username ? (
              <FieldError pesan={errors.username.message} />
            ) : (
              <p className="mt-1.5 text-xs text-muted">Wajib diawali &ldquo;PG&rdquo;.</p>
            )}
          </div>

          <div>
            <Label htmlFor="nama_lengkap">
              Nama Lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nama_lengkap"
              autoComplete="name"
              placeholder="Budi Santoso"
              className="mt-1.5"
              aria-invalid={Boolean(errors.nama_lengkap)}
              {...register("nama_lengkap")}
            />
            <FieldError pesan={errors.nama_lengkap?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="no_hp">
              No. HP <span className="text-muted">(opsional)</span>
            </Label>
            <Input
              id="no_hp"
              type="tel"
              autoComplete="tel"
              placeholder="08123456789"
              className="mt-1.5"
              aria-invalid={Boolean(errors.no_hp)}
              {...register("no_hp")}
            />
            <FieldError pesan={errors.no_hp?.message} />
          </div>

          <div>
            <Label htmlFor="email_kerja">
              Email Kerja <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email_kerja"
              type="email"
              autoComplete="email"
              placeholder="nama@petrokimia.co.id"
              className="mt-1.5"
              aria-invalid={Boolean(errors.email_kerja)}
              {...register("email_kerja")}
            />
            <FieldError pesan={errors.email_kerja?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={lihatPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
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

          <div>
            <Label htmlFor="konfirmasi_password">
              Konfirmasi Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="konfirmasi_password"
              type={lihatPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Ulangi password"
              className="mt-1.5"
              aria-invalid={Boolean(errors.konfirmasi_password)}
              {...register("konfirmasi_password")}
            />
            <FieldError pesan={errors.konfirmasi_password?.message} />
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mendaftarkan…
            </>
          ) : (
            "Daftar"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand dark:text-brand-dark underline-offset-4 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
