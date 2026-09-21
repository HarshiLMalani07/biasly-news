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
            <NewsCard
              key={article.id}
              article={article}
              priority={index < 3}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
