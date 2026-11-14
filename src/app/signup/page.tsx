import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Daftar — WARES" };

export default function SignupPage() {
  return (
    <AuthShell lebar="max-w-2xl">
      <SignupForm />
    </AuthShell>
  );
}
