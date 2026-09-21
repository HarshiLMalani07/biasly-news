import Link from "next/link";
import { NewsCard } from "@/components/news/news-card";
import type { HomeArticle } from "@/lib/demo/top-news";

export type TopNewsSectionProps = {
  articles: readonly HomeArticle[];
};

/** The "Top News" heading and its three-up card grid. */
export function TopNewsSection({ articles }: TopNewsSectionProps) {
  return (
    <section className="bg-surface py-8">
      <div className="container-biasly">
        <h2 className="text-h2 text-text-primary">Top News</h2>

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
      </div>
    </section>
  );
}
