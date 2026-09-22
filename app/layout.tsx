import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { PostHogIdentity } from "@/components/analytics/posthog-identity";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "biasly — Balanced news coverage, powered by AI",
  description:
    "biasly analyses real news articles with AI and shows reader-friendly sentiment and political framing insights.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script below rewrites <html>'s class list before React
    // hydrates; suppressHydrationWarning tells React to keep the DOM.
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs while the browser parses <head>, so a dark-theme reload
            never paints the light palette first. Build-time constant with
            no interpolated input. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Clerk's shadcn theme reads the :root variables globals.css already
            re-points at the biasly palette, so Clerk UI inherits our colours. */}
        <ThemeProvider>
          <ClerkProvider appearance={{ theme: shadcn }}>
            <PostHogIdentity />
            {children}
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
