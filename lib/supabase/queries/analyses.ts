import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/queries/unwrap";
import type {
  ArticleAnalysisInsert,
  ArticleRow,
} from "@/lib/supabase/types";

/** Analysis reads and writes (AGENTS.md section 19). */

/** An article row with its analysis ids embedded, used for pending detection. */
type ArticleWithAnalysisIds = ArticleRow & {
  article_analyses: { id: string }[] | { id: string } | null;
};

/**
 * The pending-analysis check (AGENTS.md section 19 rule 1).
 *
 * An article is pending when no `article_analyses` row exists for it. This
 * deliberately does not test `analyzed_at IS NULL`: `analyzed_at` can be set
 * while the analysis row is absent, for instance after a manual delete, and
 * such an article must be picked up again.
 *
 * The emptiness test runs in JavaScript rather than as a filter on the
 * embedded table, per the joined-filter gotcha in AGENTS.md section 21.
 */
export async function getArticlesPendingAnalysis(
  limit = 50
): Promise<ArticleRow[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getArticlesPendingAnalysis",
    await supabase
      .from("articles")
      .select("*, article_analyses ( id )")
      .order("published_at", { ascending: false })
      .returns<ArticleWithAnalysisIds[]>()
  );

  const pending = rows.filter((row) => {
    const analyses = row.article_analyses;
    if (analyses === null) return true;
    return Array.isArray(analyses) ? analyses.length === 0 : false;
  });

  // Drop the embed, hand back plain article rows.
  return pending.slice(0, limit).map((row) => ({
    id: row.id,
    source_id: row.source_id,
    url: row.url,
    canonical_url: row.canonical_url,
    title: row.title,
    image_url: row.image_url,
    published_at: row.published_at,
    raw_text: row.raw_text,
    scraped_at: row.scraped_at,
    analyzed_at: row.analyzed_at,
    created_at: row.created_at,
  }));
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
 * Saves one analysis and only then marks the article analysed (AGENTS.md
 * section 19 rule 6). If the insert fails, `analyzed_at` stays null and the
 * article is picked up by the next run.
 */
export async function saveAnalysis(
  analysis: ArticleAnalysisInsert
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error: analysisError } = await supabase
    .from("article_analyses")
    .upsert(analysis, { onConflict: "article_id" });

  if (analysisError) {
    throw new Error(`saveAnalysis: ${analysisError.message}`);
  }

  const { error: articleError } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", analysis.article_id);

  if (articleError) {
    throw new Error(`saveAnalysis (mark analyzed): ${articleError.message}`);
  }
}
