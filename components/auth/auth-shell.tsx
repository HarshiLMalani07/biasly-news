import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export type AuthShellProps = {
  children: React.ReactNode;
};

/**
 * Minimal chrome for the /sign-in and /sign-up routes: the wordmark over a
 * centered Clerk card. The masthead is intentionally left off - its own Login
 * button would be redundant on the login page.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-bg-secondary px-4 py-16">
      <Link href="/" aria-label="biasly News home">
        <Logo size="md" />
      </Link>
      {children}
    </main>
  );
}
