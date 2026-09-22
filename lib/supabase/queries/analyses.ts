import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/queries/unwrap";
import type {
  ArticleAnalysisInsert,
  ArticleRow,
} from "@/lib/supabase/types";

/** Analysis reads and writes (AGENTS.md sections 19 and 20). */

/** Matches the URL existence check's cap on `.in()` values (section 9). */
const ID_CHUNK_SIZE = 15;

/** Only what pending detection needs: the id, and whether an analysis exists. */
type PendingScanRow = {
  id: string;
  article_analyses: { id: string }[] | { id: string } | null;
};

/**
 * PostgREST returns a to-one embed as an object, but as an array when it cannot
 * prove the relationship is unique. Both shapes mean "no analysis" when empty.
 */
function hasNoAnalysis(row: PendingScanRow): boolean {
  const analyses = row.article_analyses;

  if (analyses === null) return true;

  return Array.isArray(analyses) ? analyses.length === 0 : false;
}

/**
 * The pending-analysis check (AGENTS.md section 19 rule 1).
 *
 * An article is pending when no `article_analyses` row exists for it. This
 * deliberately does not test `analyzed_at IS NULL`: `analyzed_at` can be set
 * while the analysis row is absent, for instance after a manual delete, and
 * such an article must be picked up again.
 *
 * The emptiness test runs in JavaScript rather than as a filter on the
 * embedded table, per the joined-filter gotcha in AGENTS.md section 21. Only
 * ids are selected, so scanning every article does not drag their `raw_text`
 * across the wire; `getArticlesByIds` loads the full rows one batch at a time.
 */
export async function getArticlesPendingAnalysis(
  limit?: number
): Promise<string[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getArticlesPendingAnalysis",
    await supabase
      .from("articles")
      .select("id, article_analyses ( id )")
      .order("published_at", { ascending: false })
      .returns<PendingScanRow[]>()
  );

  const pending = rows.filter(hasNoAnalysis).map((row) => row.id);

  return limit === undefined ? pending : pending.slice(0, limit);
}

/**
 * Which of these article ids still have no analysis. Used when the caller named
 * the articles to analyse, so an already-analysed id is skipped rather than
 * analysed twice.
 */
export async function filterPendingArticleIds(
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return [];

  const pending = new Set(await getArticlesPendingAnalysis());

  return ids.filter((id) => pending.has(id));
}

/** An article plus its publication name, which the analysis prompt names. */
export type ArticleForAnalysis = ArticleRow & { source_name: string | null };

/** The same row as PostgREST returns it, before the embed is flattened. */
type RawArticleForAnalysis = ArticleRow & {
  sources: { name: string } | { name: string }[] | null;
};

function withSourceName(row: RawArticleForAnalysis): ArticleForAnalysis {
  const { sources, ...article } = row;
  const source = Array.isArray(sources) ? (sources[0] ?? null) : sources;

  return { ...article, source_name: source?.name ?? null };
}

/**
 * Full article rows for one batch, in the order the ids were given.
 *
 * Chunked like the URL existence check of AGENTS.md section 9: never more than
 * 15 values in a single `.in()` filter.
 */
export async function getArticlesByIds(
  ids: string[]
): Promise<ArticleForAnalysis[]> {
  if (ids.length === 0) return [];

  const supabase = getServiceRoleClient();
  const byId = new Map<string, ArticleForAnalysis>();

  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE);

    const rows = unwrap(
      "getArticlesByIds",
      await supabase
        .from("articles")
        .select("*, sources ( name )")
        .in("id", chunk)
        .returns<RawArticleForAnalysis[]>()
    );

    for (const row of rows) byId.set(row.id, withSourceName(row));
  }

  return ids
    .map((id) => byId.get(id))
    .filter((row): row is ArticleForAnalysis => row !== undefined);
}

/**
 * The bias score AGENTS.md section 7 defines: `(right - left) / 100`.
 * Exported so no caller re-derives it differently.
 */
export function deriveBiasScore(
  leftPercentage: number,
  rightPercentage: number
): number {
  return Math.round(((rightPercentage - leftPercentage) / 100) * 10_000) / 10_000;
}

/**
 * A vector in the text form pgvector accepts, `"[0.1,0.2,...]"`. Exported so
 * nothing else re-derives it (AGENTS.md section 20).
 */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

/**
 * Saves one analysis and its embedding, and only then marks the article
 * analysed (AGENTS.md section 19 rule 6 and section 20).
 *
 * `analyzed_at` is stamped only when the embedding is present: section 20
 * requires both to be saved first. A null embedding still stores the analysis -
 * the model call has already been paid for - and leaves the row for the next
 * run's embedding backfill.
 */
export async function saveAnalysis(
  analysis: ArticleAnalysisInsert,
  embedding: number[] | null
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error: analysisError } = await supabase
    .from("article_analyses")
    .upsert(
      {
        ...analysis,
        embedding: embedding ? toVectorLiteral(embedding) : null,
      },
      { onConflict: "article_id" }
    );

  if (analysisError) {
    throw new Error(`saveAnalysis: ${analysisError.message}`);
  }

  if (!embedding) return;

  const { error: articleError } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", analysis.article_id);

  if (articleError) {
    throw new Error(`saveAnalysis (mark analyzed): ${articleError.message}`);
  }
}

/**
 * Backfills one embedding onto an existing analysis and stamps the article
 * analysed if it is not already (AGENTS.md section 20).
 *
 * This is the path for a row whose analysis exists but whose embedding is null -
 * an analysis written before pgvector, or one whose embedding call failed. The
 * analysis itself is never regenerated.
 */
export async function saveEmbedding(
  articleId: string,
  embedding: number[]
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error: embeddingError } = await supabase
    .from("article_analyses")
    .update({ embedding: toVectorLiteral(embedding) })
    .eq("article_id", articleId);

  if (embeddingError) {
    throw new Error(`saveEmbedding: ${embeddingError.message}`);
  }

  const { error: articleError } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", articleId)
    .is("analyzed_at", null);

  if (articleError) {
    throw new Error(`saveEmbedding (mark analyzed): ${articleError.message}`);
  }
}

/**
 * Article ids whose analysis exists but whose embedding is null - the backfill
 * queue of AGENTS.md section 20.
 *
 * Only `article_id` is selected: the vector column itself is ~20 KB of text per
 * row, so it never travels just to be tested for null.
 */
export async function getArticleIdsMissingEmbedding(): Promise<string[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getArticleIdsMissingEmbedding",
    await supabase
      .from("article_analyses")
      .select("article_id")
      .is("embedding", null)
      .order("created_at", { ascending: false })
  );

  return rows.map((row) => row.article_id);
}
