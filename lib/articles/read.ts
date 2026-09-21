import "server-only";

import type {
  ArticleDetail,
  FeedArticle,
  RelatedArticle,
} from "@/lib/articles/view-models";
import {
  toArticleDetail,
  toFeedArticle,
  toRelatedArticle,
} from "@/lib/supabase/mappers";
import {
  getArticleById,
  getFeedArticles,
  getRecentArticlesExcluding,
} from "@/lib/supabase/queries/articles";

/**
 * The read boundary the pages use: Supabase rows in, view models out.
 *
 * Pages import from here rather than from `lib/supabase/*` so the render tree
 * never sees a database row, only the fields it displays (AGENTS.md section 5 -
 * the UI displays stored data and nothing else).
 */

/** Cards per feed page - what "View more" adds each time. */
export const FEED_PAGE_SIZE = 24;

/** Upper bound on the page a caller may ask for, so an offset stays sane. */
export const MAX_FEED_PAGE = 50;

/** One page of the home feed, plus whether another page exists. */
export type FeedPage = {
  articles: FeedArticle[];
  /** Zero-based: page 0 is what the home page renders on first paint. */
  page: number;
  hasMore: boolean;
};

/**
 * One page of the home feed: newest analysed articles first.
 *
 * One extra row is fetched and dropped again - that is what answers "is there
 * another page?" without a second count query.
 */
export async function getHomeFeed(page = 0): Promise<FeedPage> {
  const safePage = Math.min(Math.max(Math.trunc(page), 0), MAX_FEED_PAGE);

  const rows = await getFeedArticles(
    FEED_PAGE_SIZE + 1,
    safePage * FEED_PAGE_SIZE
  );

  return {
    articles: rows.slice(0, FEED_PAGE_SIZE).map(toFeedArticle),
    page: safePage,
    hasMore: rows.length > FEED_PAGE_SIZE && safePage < MAX_FEED_PAGE,
  };
}

/** One article and its analysis, or null when either is missing. */
export async function getArticleDetail(
  id: string
): Promise<ArticleDetail | null> {
  const row = await getArticleById(id);

  return row ? toArticleDetail(row) : null;
}

/**
 * Related stories. Until pgvector lands (AGENTS.md section 20) this is the
 * most recent other analysed articles rather than a similarity search.
 */
export async function getRelatedArticles(
  id: string,
  limit = 6
): Promise<RelatedArticle[]> {
  const rows = await getRecentArticlesExcluding(id, limit);

  return rows.map(toRelatedArticle);
}
