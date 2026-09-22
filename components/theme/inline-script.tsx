/**
 * Runs `html` synchronously while the browser parses the markup, so the DOM is
 * corrected before the first paint and before React hydrates.
 *
 * The type swap is from the Next.js "preventing flash before hydration" guide:
 * React warns in development when a render produces a <script>, and on a
 * client-side navigation the script would not execute anyway - the client
 * render already has the right values. suppressHydrationWarning covers the
 * resulting type mismatch.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
