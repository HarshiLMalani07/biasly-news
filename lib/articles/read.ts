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

/** The home feed: newest analysed articles first. */
export async function getHomeFeed(limit = 24): Promise<FeedArticle[]> {
  const rows = await getFeedArticles(limit);

  return rows.map(toFeedArticle);
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
