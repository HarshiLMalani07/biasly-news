import { RelatedStoryCard } from "@/components/news/related-story-card";
import type { RelatedArticle } from "@/lib/articles/view-models";

export type RelatedStoriesProps = {
  articles: readonly RelatedArticle[];
};

/**
 * Stories covering adjacent ground. The demo picks other fixture articles;
 * AGENTS.md section 20 replaces the source with pgvector cosine distance.
 */
export function RelatedStories({ articles }: RelatedStoriesProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-card-title text-text-primary">Related Stories</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {articles.map((article) => (
          <RelatedStoryCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
