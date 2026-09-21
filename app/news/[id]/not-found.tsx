import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UtilityBar } from "@/components/layout/utility-bar";
import { Button } from "@/components/ui/button";

export default function ArticleNotFound() {
  return (
    <>
      <UtilityBar />
      <SiteHeader />

      <main className="flex-1 bg-surface">
        <div className="container-biasly py-16">
          <h1 className="text-h1 text-text-primary">Article not found</h1>
          <p className="text-body-md mt-2 text-text-secondary">
            This story is not in biasly&apos;s index. It may have been removed,
            or the link may be wrong.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/">Back to Top News</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
