/**
 * Every tunable number the AI analysis stage uses, plus the model it calls.
 *
 * AGENTS.md section 21 asks for centralized limits: no magic number belongs in
 * the AI, pipeline, or route layers. This module is plain data with no secrets
 * and no I/O, so - like `lib/scraping/limits.ts` - it is deliberately not
 * `server-only`; the route handler imports the request bounds from here too.
 */

/**
 * The model every analysis runs on, and the exact string saved to
 * `article_analyses.model` (AGENTS.md section 19).
 *
 * Verified against the model-id union in
 * `node_modules/@ai-sdk/openai/dist/index.d.ts` rather than from memory, as the
 * ai-sdk skill requires. The mini tier is the right size for this job:
 * classification plus a short neutral summary over at most a few thousand
 * words. Changing models is a one-line edit here.
 */
export const ANALYSIS_MODEL = "gpt-5.4-mini";

/**
 * The one call setting deviating from a provider default, passed as the AI
 * SDK's provider-agnostic `reasoning` option.
 *
 * A full run is ~100 articles, and framing estimation over an article that is
 * already in front of the model does not need deep deliberation - `low` keeps
 * latency and token spend down without changing the shape of the answer.
 */
export const ANALYSIS_REASONING_EFFORT = "low" as const;

/** AGENTS.md section 21's `ANALYSIS_BATCH_SIZE` default. */
export const DEFAULT_ANALYSIS_BATCH_SIZE = 5;

/** Upper bound for a requested `batchSize`, and for `ANALYSIS_BATCH_SIZE`. */
export const MAX_ANALYSIS_BATCH_SIZE = 20;

/**
 * Articles per batch, from `ANALYSIS_BATCH_SIZE`.
 *
 * Batching exists only to bound wall time and concurrent model calls - it is
 * never a cap on how much one run analyzes (AGENTS.md section 19, "Batching is
 * allowed only to avoid timeouts"). A missing, unparsable or out-of-range
 * value falls back to the default rather than failing a run.
 */
export function analysisBatchSize(): number {
  const raw = Number.parseInt(process.env.ANALYSIS_BATCH_SIZE ?? "", 10);

  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_ANALYSIS_BATCH_SIZE) {
    return DEFAULT_ANALYSIS_BATCH_SIZE;
  }

  return raw;
}

/**
 * Absolute stop for one run, on top of the loop's own no-progress guard. Not a
 * default limit: a run ends when nothing is pending, well before this.
 */
export const MAX_ANALYSIS_ARTICLES = 500;

/**
 * Article characters sent to the model. The longest stored `raw_text` is around
 * 13k characters, so this normally never fires; it exists so one pathological
 * article cannot blow up a request.
 */
export const MAX_ARTICLE_CHARS = 16_000;

/**
 * Below this there is nothing to analyze, and a model call would spend money to
 * find that out. Such an article is skipped, not failed, and stays pending.
 */
export const MIN_ARTICLE_CHARS = 200;

/**
 * How far the three framing percentages may total from 100 and still be treated
 * as rounding drift (33/34/34) rather than bad output. Within this, the split
 * is repaired to exactly 100; beyond it, the output is invalid.
 */
export const PERCENTAGE_TOTAL_TOLERANCE = 2;

/**
 * The embedding model (AGENTS.md section 20), and the exact dimension count
 * `article_analyses.embedding vector(1536)` expects.
 *
 * Verified against the installed packages rather than from memory, as the
 * ai-sdk skill requires: `openai.embedding(id)` is the current factory in
 * `node_modules/@ai-sdk/openai/dist/index.d.ts` (`textEmbeddingModel` is
 * deprecated there), and `node_modules/@ai-sdk/openai/docs/03-openai.mdx` lists
 * `text-embedding-3-small` at 1536 dimensions - so no `dimensions` provider
 * option is needed to match the column.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";

/** Must equal the `vector(N)` width in `supabase/schema.sql`. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Article characters sent to the embedding model. Well inside the model's
 * 8191-token input limit, and enough of a story for two reports of the same
 * event to land near each other.
 */
export const MAX_EMBEDDING_CHARS = 8_000;
