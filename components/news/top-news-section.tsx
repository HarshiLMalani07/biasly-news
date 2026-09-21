import Link from "next/link";
import { NewsCard } from "@/components/news/news-card";
import type { FeedArticle } from "@/lib/articles/view-models";

export type TopNewsSectionProps = {
  articles: readonly FeedArticle[];
};

/** The "Top News" heading and its three-up card grid. */
export function TopNewsSection({ articles }: TopNewsSectionProps) {
  return (
    <section className="bg-surface py-8">
      <div className="container-biasly">
        <h2 className="text-h2 text-text-primary">Top News</h2>

        {articles.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-bg-primary p-8 text-center">
            <p className="text-card-title text-text-primary">
              No analysed articles yet
            </p>
            <p className="text-body-md mt-2 text-text-secondary">
              Run the scraper and AI analysis to populate the feed.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <Link
                key={article.id}
                href={`/news/${article.id}`}
                className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2"
              >
                <NewsCard article={article} priority={index < 3} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
