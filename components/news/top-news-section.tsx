"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useState, useTransition } from "react";
import { loadFeedPage } from "@/app/_actions/feed";
import { NewsCard } from "@/components/news/news-card";
import { Button } from "@/components/ui/button";
import type { FeedPage } from "@/lib/articles/read";
import type { FeedArticle } from "@/lib/articles/view-models";

export type TopNewsSectionProps = {
  /** The first page, rendered on the server so the feed needs no JS to appear. */
  initial: FeedPage;
};

/**
 * The "Top News" heading, its three-up card grid, and the View more control.
 *
 * A Client Component only for the append-in-place behaviour: the first page is
 * server-rendered, and each further page is fetched through a read-only Server
 * Action. Nothing here talks to Supabase or the pipeline (AGENTS.md section 5).
 */
export function TopNewsSection({ initial }: TopNewsSectionProps) {
  const [articles, setArticles] = useState<FeedArticle[]>(initial.articles);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function viewMore() {
    setError(null);

    startTransition(async () => {
      try {
        const next = await loadFeedPage(page + 1);

        // An article inserted between requests shifts every offset by one, so
        // a page can repeat a card that is already on screen. Key by id.
        setArticles((current) => {
          const seen = new Set(current.map((article) => article.id));

          return [
            ...current,
            ...next.articles.filter((article) => !seen.has(article.id)),
          ];
        });

        setPage(next.page);
        setHasMore(next.hasMore);
        posthog.capture("feed_page_loaded", {
          page: next.page,
          articles_loaded: next.articles.length,
          has_more: next.hasMore,
        });
      } catch (error) {
        posthog.captureException(error);
        setError("Could not load more articles. Please try again.");
      }
    });
  }

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
          <>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/news/${article.id}`}
                  onClick={() =>
                    posthog.capture("article_selected", {
                      article_id: article.id,
                      source_name: article.sourceName,
                      framing_label: article.framingLabel,
                      feed_page: page,
                      position: index + 1,
                    })
                  }
                  className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2"
                >
                  <NewsCard article={article} priority={index < 3} />
                </Link>
              ))}
            </div>

            {error !== null && (
              <p
                role="status"
                className="text-body-md mt-6 text-center text-text-secondary"
              >
                {error}
              </p>
            )}

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={viewMore}
                  disabled={isPending}
                  aria-busy={isPending}
                  className="rounded-full px-8 uppercase tracking-[0.08em]"
                >
                  {isPending ? "Loading…" : "View more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
