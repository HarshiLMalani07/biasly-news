import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create account — biasly",
  description: "Create a biasly account to read full article analysis.",
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}
