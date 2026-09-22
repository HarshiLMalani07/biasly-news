import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UtilityBar } from "@/components/layout/utility-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The root not-found renders both for `notFound()` in the root segment and for
 * every URL the app does not match, so it doubles as biasly's "not built yet"
 * page: the masthead points at /for-you, /local and /blindspot long before
 * those sections exist.
 *
 * Missing articles keep their own page at app/news/[id]/not-found.tsx - a wrong
 * id is a missing story, not a section that has yet to be built.
 */
export default function NotFound() {
  return (
    <>
      <UtilityBar />
      <SiteHeader />

      <main className="flex-1 bg-surface">
        <div className="container-biasly flex min-h-[60vh] flex-col items-center justify-center py-20 text-center sm:py-28">
          <Badge
            variant="outline"
            className="gap-2 uppercase tracking-[0.12em]"
          >
            <span
              aria-hidden
              className="size-1.5 animate-pulse rounded-full bg-bias-left motion-reduce:animate-none"
            />
            Coming soon
          </Badge>

          <h1 className="text-h1 mt-6 max-w-[20ch] text-balance text-text-primary">
            Coming soon to the front page.
          </h1>

          {/* The meter's left / center / right motif, as a rule. Decorative on
              purpose - BiasMeter carries real analysis and must never render
              invented numbers. The middle block borrows the breakdown row's
              grey, since bias-center is also this page's background colour. */}
          <span
            aria-hidden
            className="mt-8 flex h-1 w-40 overflow-hidden rounded-full"
          >
            <span className="w-1/3 bg-bias-left" />
            <span className="w-1/3 bg-text-secondary/30" />
            <span className="w-1/3 bg-bias-right" />
          </span>

          <p className="text-body-lg mt-8 max-w-[56ch] text-pretty text-text-secondary">
            This section hasn&apos;t gone to press yet. biasly is busy reading
            the day&apos;s news and measuring how each story is framed &mdash;
            this page joins the front page once it can do the same.
          </p>

          <Button asChild variant="primary" size="lg" className="mt-10">
            <Link href="/">Back to Top News</Link>
          </Button>

          <p className="text-caption mt-6 text-text-secondary">
            The news index keeps updating on its own while this page is built.
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
