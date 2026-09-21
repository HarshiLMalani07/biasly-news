import { DesignSystemSheet } from "./_components/design-system-sheet";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TopicRail } from "@/components/layout/topic-rail";
import { UtilityBar } from "@/components/layout/utility-bar";
import { TopNewsSection } from "@/components/news/top-news-section";
import { topNewsArticles } from "@/lib/demo/top-news";

export default function Home() {
  return (
    <>
      <UtilityBar />
      <SiteHeader />
      <TopicRail />

      <main className="flex-1">
        <TopNewsSection articles={topNewsArticles} />

        {/* The design-system reference sheet, kept on the home route so the
            tokens stay visually verifiable against the live feed above. */}
        <section className="border-t border-border bg-bg-secondary py-8">
          <div className="container-biasly">
            <h2 className="text-h2 text-text-primary">Design System v1.0</h2>
            <p className="text-body-md mt-1 text-text-secondary">
              Stay consistent. Stay unbiased.
            </p>
          </div>
          <div className="mt-6">
            <DesignSystemSheet />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
