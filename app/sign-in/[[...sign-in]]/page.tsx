import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in — biasly",
  description: "Sign in to read full biasly article analysis.",
};

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
