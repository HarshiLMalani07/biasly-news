import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { isMiss, unwrap } from "@/lib/supabase/queries/unwrap";
import type {
  ArticleAnalysisRow,
  ArticleInsert,
  ArticleRow,
} from "@/lib/supabase/types";

/**
 * Article reads and the append-only insert (AGENTS.md section 10).
 *
 * Joined tables are never filtered with `.eq('foreignTable.column', value)` -
 * that generates broken PostgREST SQL. Conditions on an embedded resource are
 * applied in JavaScript after the query returns (AGENTS.md section 21).
 */

/** An article joined to its source and its analysis, as the UI reads it. */
export type ArticleWithAnalysis = ArticleRow & {
  sources: { name: string; logo_url: string | null } | null;
  article_analyses: ArticleAnalysisRow | null;
};

/** The same row as PostgREST returns it, before embeds are flattened. */
type RawArticleRow = ArticleRow & {
  sources:
    | { name: string; logo_url: string | null }
    | { name: string; logo_url: string | null }[]
    | null;
  article_analyses: ArticleAnalysisRow | ArticleAnalysisRow[] | null;
};

const ARTICLE_SELECT = `
  id,
  source_id,
  url,
  canonical_url,
  title,
  image_url,
  published_at,
  raw_text,
  scraped_at,
  analyzed_at,
  created_at,
  sources ( name, logo_url ),
  article_analyses (
    id,
    article_id,
    summary,
    sentiment_score,
    sentiment_label,
    bias_score,
    bias_label,
    left_percentage,
    center_percentage,
    right_percentage,
    confidence,
    framing_notes,
    loaded_terms,
    disclaimer,
    model,
    created_at
  )
`;

/**
 * PostgREST returns a to-one embed as an object, but as an array when it
 * cannot prove the relationship is unique. Normalise both shapes.
 */
function firstOrNull<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function flatten(row: RawArticleRow): ArticleWithAnalysis {
  return {
    ...row,
    sources: firstOrNull(row.sources),
    article_analyses: firstOrNull(row.article_analyses),
  };
}

/**
 * The home feed: newest analysed articles first.
 *
 * An article only reaches a reader once its analysis exists (AGENTS.md
 * section 18), so rows without one are dropped here - in JS, not with a filter
 * on the embedded table.
 */
export async function getFeedArticles(
  limit = 24
): Promise<ArticleWithAnalysis[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getFeedArticles",
    await supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<RawArticleRow[]>()
  );

  return rows.map(flatten).filter((row) => row.article_analyses !== null);
}

/**
 * One article by id, or null when it does not exist, when the id is not a
 * uuid, or when it has no analysis yet.
 */
export async function getArticleById(
  id: string
): Promise<ArticleWithAnalysis | null> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("id", id)
    .maybeSingle<RawArticleRow>();

  if (error) {
    if (isMiss(error)) return null;
    throw new Error(`getArticleById: ${error.message}`);
  }

  if (!data) return null;

  const article = flatten(data);

  return article.article_analyses === null ? null : article;
}

/**
 * The Related Stories stand-in: the most recent other analysed articles.
 *
 * AGENTS.md section 20 replaces this with `getRelatedArticles(articleId,
 * embedding)`, ordering by cosine distance (`<=>`) once pgvector is enabled.
 */
export async function getRecentArticlesExcluding(
  id: string,
  limit = 6
): Promise<ArticleWithAnalysis[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getRecentArticlesExcluding",
    await supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .neq("id", id)
      .order("published_at", { ascending: false })
      .limit(limit + 1)
      .returns<RawArticleRow[]>()
  );

  return rows
    .map(flatten)
    .filter((row) => row.article_analyses !== null)
    .slice(0, limit);
}

/**
 * The URL existence check (AGENTS.md section 9): never pass more than 15 URLs
 * to a single `.in()` filter.
 */
export const URL_EXISTENCE_CHUNK_SIZE = 15;

/**
 * Which of these URLs are already stored, matched against both `url` and
 * `canonical_url`. Returns the subset of the input that already exists, so the
 * scraper can skip them before detail scraping.
 */
export async function findExistingUrls(urls: string[]): Promise<Set<string>> {
  const supabase = getServiceRoleClient();
  const candidates = [...new Set(urls)];
  const existing = new Set<string>();

  for (let i = 0; i < candidates.length; i += URL_EXISTENCE_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + URL_EXISTENCE_CHUNK_SIZE);

    const rows = unwrap(
      "findExistingUrls",
      await supabase
        .from("articles")
        .select("url, canonical_url")
        .or(
          `url.in.(${chunk.map(quoteForIn).join(",")}),` +
            `canonical_url.in.(${chunk.map(quoteForIn).join(",")})`
        )
    );

    const stored = new Set<string>();
    for (const row of rows) {
      stored.add(row.url);
      if (row.canonical_url) stored.add(row.canonical_url);
    }

    for (const url of chunk) {
      if (stored.has(url)) existing.add(url);
    }
  }

  return existing;
}

/** PostgREST `in.()` values need quoting once they contain commas or colons. */
function quoteForIn(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** Postgres 23505: unique violation. Here it means "already stored". */
const UNIQUE_VIOLATION_CODE = "23505";

/**
 * Append-only insert of one article (AGENTS.md section 10). Returns the stored
 * row, or null when the article already exists.
 *
 * Deliberately one row at a time rather than a batch: `articles` is unique on
 * `url` *and* on `canonical_url`, so a single `onConflict: "url"` upsert cannot
 * express both. Two candidates that resolve to the same canonical page would
 * raise 23505 and, inside a batch, take every other row in the statement down
 * with them. Per-row, a conflict costs exactly the one duplicate.
 *
 * Nothing here deletes, replaces or resets an existing article.
 */
export async function insertArticle(
  row: ArticleInsert
): Promise<ArticleRow | null> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("articles")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // A conflict on either unique column means the article is already stored.
    if (error.code === UNIQUE_VIOLATION_CODE) return null;

    throw new Error(`insertArticle: ${error.message}`);
  }

  return data;
}
