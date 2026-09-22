import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TopicRail } from "@/components/layout/topic-rail";
import { UtilityBar } from "@/components/layout/utility-bar";
import { TopNewsSection } from "@/components/news/top-news-section";
import { getHomeFeed } from "@/lib/articles/read";

/**
 * Read fresh on every request: the hourly pipeline adds articles continuously,
 * and this project does not enable Cache Components, so without this the feed
 * would be baked at build time.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await getHomeFeed();

  return (
    <>
      <UtilityBar />
      <SiteHeader />
      <TopicRail />

      <main className="flex-1">
        <TopNewsSection initial={feed} />
      </main>

      <SiteFooter />
    </>
  );
}
