import { Suspense } from "react";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk — WARES" };

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
