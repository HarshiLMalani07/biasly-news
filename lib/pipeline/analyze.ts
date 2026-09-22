import "server-only";

import { analyzeArticle } from "@/lib/ai/analyze-article";
import { embedArticle } from "@/lib/ai/embed-article";
import {
  ANALYSIS_MODEL,
  EMBEDDING_MODEL,
  MAX_ANALYSIS_ARTICLES,
  MAX_ANALYSIS_BATCH_SIZE,
  MIN_ARTICLE_CHARS,
  analysisBatchSize,
} from "@/lib/ai/limits";
import { createRunLogger, type RunLogger } from "@/lib/pipeline/run-logger";
import type {
  AnalysisFailureReason,
  AnalyzeBatchOutcome,
  AnalyzeOptions,
  AnalyzeStatus,
  AnalyzeSummary,
} from "@/lib/pipeline/types";
import {
  filterPendingArticleIds,
  getArticleIdsMissingEmbedding,
  getArticlesByIds,
  getArticlesPendingAnalysis,
  saveAnalysis,
  saveEmbedding,
  type ArticleForAnalysis,
} from "@/lib/supabase/queries/analyses";

/**
 * The AI analysis pipeline (AGENTS.md sections 19 and 20).
 *
 * Pending articles are found by the LEFT JOIN check, never by `analyzed_at`
 * alone, and a run keeps going until none are left. Batching bounds wall time
 * and concurrent model calls; it is not a cap on how much a run analyses.
 *
 * Every analysed article is also embedded (section 20), and a second phase
 * backfills analyses that exist without a vector - one written before pgvector,
 * or one whose embedding call failed - without regenerating the analysis.
 */

/** Running totals for one run. */
type Totals = {
  analyzed: number;
  skipped: number;
  failed: number;
  /**
   * Analyses saved together with their embedding. An embedding failure counts
   * as `failed`, so in a healthy run this equals `analyzed`; a gap means an
   * analysis was stored without a vector.
   */
  embedded: number;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One article's outcome, as the batch loop reports it.
 *
 * `saved_without_embedding` counts as a failure - the article is not finished
 * and stays unstamped - but it is kept distinct because it is not a lost
 * analysis: the row is stored and only its vector is missing, so a run that
 * hits nothing worse than this is `completed_with_errors`, never `failed`.
 */
type ArticleOutcome =
  | "analyzed"
  | "skipped"
  | "failed"
  | "saved_without_embedding";

/**
 * Analyses one article, embeds it, and saves both. Every failure path is caught
 * here: a batch must never be taken down by one article.
 *
 * `analyzed_at` is stamped inside `saveAnalysis`, after the analysis row is
 * written and only when the embedding is present (section 19 rule 6 and
 * section 20), so an article that fails here stays pending or, when only the
 * embedding failed, becomes a backfill candidate.
 */
async function analyzeOne(
  article: ArticleForAnalysis,
  countFailure: (reason: AnalysisFailureReason) => void,
  log: RunLogger
): Promise<ArticleOutcome> {
  const text = article.raw_text.trim();

  if (text.length < MIN_ARTICLE_CHARS) {
    countFailure("insufficient_text");
    log.warn(`Skipped, too little text: ${article.title}`, {
      articleId: article.id,
      characters: text.length,
    });

    return "skipped";
  }

  // Both model calls at once: section 20 puts the embedding alongside the
  // analysis call. `embedArticle` resolves a result object rather than
  // rejecting, so one failure never discards the other call's answer.
  const [result, embedded] = await Promise.all([
    analyzeArticle({
      articleId: article.id,
      title: article.title,
      sourceName: article.source_name ?? "Unknown publication",
      publishedAt: article.published_at,
      text,
    }),
    embedArticle({ title: article.title, text }),
  ]);

  if (!result.ok) {
    countFailure(result.reason);
    log.error(`Analysis failed: ${article.title}`, {
      articleId: article.id,
      reason: result.reason,
      message: result.message,
    });

    return "failed";
  }

  if (result.repairedPercentages) {
    log.warn(`Framing percentages repaired to total 100: ${article.title}`, {
      articleId: article.id,
    });
  }

  const embedding = embedded.ok ? embedded.embedding : null;
  const embeddingError = embedded.ok ? null : embedded.message;

  try {
    await saveAnalysis(result.analysis, embedding);
  } catch (error) {
    countFailure("save_failed");
    log.error(`Save failed: ${article.title}`, {
      articleId: article.id,
      reason: messageOf(error),
    });

    return "failed";
  }

  // The analysis is stored either way - it has already been paid for - but
  // without a vector the article stays unstamped and the next run's backfill
  // phase picks it up (section 20).
  if (embedding === null) {
    countFailure("embedding_failed");
    log.error(`Embedding failed, analysis saved unstamped: ${article.title}`, {
      articleId: article.id,
      reason: embeddingError,
    });

    return "saved_without_embedding";
  }

  log.info(`Article analysed and embedded: ${article.title}`, {
    articleId: article.id,
    framing: result.analysis.bias_label,
    sentiment: result.analysis.sentiment_label,
    confidence: result.analysis.confidence,
  });

  return "analyzed";
}

/**
 * Embeds one already-analysed article and saves the vector (AGENTS.md
 * section 20's backfill). Like `analyzeOne`, it catches everything and reports
 * with a boolean.
 */
async function embedOne(
  article: ArticleForAnalysis,
  countFailure: (reason: AnalysisFailureReason) => void,
  log: RunLogger
): Promise<boolean> {
  const text = article.raw_text.trim();
  const embedded = await embedArticle({ title: article.title, text });

  if (!embedded.ok) {
    countFailure("embedding_failed");
    log.error(`Embedding failed: ${article.title}`, {
      articleId: article.id,
      reason: embedded.message,
    });

    return false;
  }

  try {
    await saveEmbedding(article.id, embedded.embedding);
  } catch (error) {
    countFailure("embedding_save_failed");
    log.error(`Embedding save failed: ${article.title}`, {
      articleId: article.id,
      reason: messageOf(error),
    });

    return false;
  }

  log.info(`Embedding backfilled: ${article.title}`, { articleId: article.id });

  return true;
}

/** What one backfill phase did. */
type BackfillTotals = { backfilled: number; failed: number };

/**
 * Fills in missing embeddings for analyses that already exist, in the same
 * batch size the analysis loop uses.
 *
 * The analysis itself is never regenerated: this is exactly the case section 20
 * describes, where `article_analyses` holds a row whose `embedding` is null.
 */
async function backfillEmbeddings(
  ids: string[],
  batchSize: number,
  countFailure: (reason: AnalysisFailureReason) => void,
  log: RunLogger
): Promise<BackfillTotals> {
  const totals: BackfillTotals = { backfilled: 0, failed: 0 };

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    let articles: ArticleForAnalysis[];

    try {
      articles = await getArticlesByIds(chunk);
    } catch (error) {
      // The batch could not be loaded at all: stop rather than spin on a
      // database that is not answering.
      for (const id of chunk) {
        countFailure("embedding_failed");
        log.error("Could not load article for embedding", {
          articleId: id,
          reason: messageOf(error),
        });
      }

      totals.failed += chunk.length;
      break;
    }

    const missing = chunk.length - articles.length;

    if (missing > 0) {
      for (let j = 0; j < missing; j += 1) countFailure("article_missing");
      totals.failed += missing;
      log.warn("Articles disappeared before their embedding was backfilled", {
        count: missing,
      });
    }

    const results = await Promise.allSettled(
      articles.map((article) => embedOne(article, countFailure, log))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        // embedOne catches its own failures, so this is a bug net.
        countFailure("embedding_failed");
        totals.failed += 1;
        log.error("Unexpected embedding error", {
          reason: messageOf(result.reason),
        });
        continue;
      }

      if (result.value) totals.backfilled += 1;
      else totals.failed += 1;
    }
  }

  return totals;
}

/** Clamps a requested batch size into the allowed range. */
function resolveBatchSize(requested: number | undefined): number {
  if (requested === undefined) return analysisBatchSize();

  return Math.min(Math.max(requested, 1), MAX_ANALYSIS_BATCH_SIZE);
}

/**
 * Runs analysis over every pending article and returns the section 19 summary.
 *
 * An empty `options` means all pending articles - the documented default. A
 * `limit` or `articleIds` narrows the run only because the caller asked.
 */
export async function runAnalysis(
  options: AnalyzeOptions
): Promise<AnalyzeSummary> {
  const log = createRunLogger("analyze");
  const startedAt = Date.now();
  const totals: Totals = { analyzed: 0, skipped: 0, failed: 0, embedded: 0 };
  const failureReasons = new Map<AnalysisFailureReason, number>();
  const batchOutcomes: AnalyzeBatchOutcome[] = [];

  const batchSize = resolveBatchSize(options.batchSize);
  const cap = Math.min(options.limit ?? MAX_ANALYSIS_ARTICLES, MAX_ANALYSIS_ARTICLES);
  const selected = options.articleIds;

  let pendingAtStart = 0;
  let pendingAtEnd = 0;
  let embeddingsBackfilled = 0;
  let embeddingsMissingAtEnd = 0;
  /** Backfill failures, kept apart: they never fail a run's analysis result. */
  let backfillFailed = 0;
  /** Failures that stored an analysis and lost only its embedding. */
  let analysesWithoutEmbedding = 0;

  function countFailure(reason: AnalysisFailureReason): void {
    failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
  }

  function summarise(status: AnalyzeStatus): AnalyzeSummary {
    return {
      status,
      runId: log.runId,
      model: ANALYSIS_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      pendingAtStart,
      ...totals,
      embeddingsBackfilled,
      embeddingsMissingAtEnd,
      batches: batchOutcomes.length,
      batchSize,
      pendingAtEnd,
      durationMs: Date.now() - startedAt,
      failureReasons: Object.fromEntries(failureReasons) as Partial<
        Record<AnalysisFailureReason, number>
      >,
      batchOutcomes,
    };
  }

  log.info("Analysis started", {
    model: ANALYSIS_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    batchSize,
    limit: options.limit ?? "none",
    articleIds: selected ? selected.length : "all pending",
  });

  // 1. The pending-analysis check (rule 1), never `analyzed_at IS NULL` alone.
  let pending: string[];

  try {
    pending = selected
      ? await filterPendingArticleIds(selected)
      : await getArticlesPendingAnalysis();
  } catch (error) {
    log.error("Analysis failed: could not load pending articles", {
      reason: messageOf(error),
    });
    const summary = summarise("failed");
    log.summary(summary);
    return summary;
  }

  pendingAtStart = pending.length;
  pendingAtEnd = pending.length;
  log.info("Pending articles found", { count: pendingAtStart });

  // Not an early return: an idle analysis queue says nothing about the
  // embedding backfill queue, which is checked below (section 20). With no
  // pending ids the batch loop simply does not run.
  if (pendingAtStart === 0) {
    log.info("Nothing pending to analyse");
  }

  // Ids already handled in this run. The pending list is re-read between
  // batches so a concurrent scrape's articles are picked up too (rule 3), and
  // this set keeps a skipped article from being offered again forever.
  const attempted = new Set<string>();
  let queue = pending;

  while (queue.length > 0) {
    const processed = totals.analyzed + totals.skipped + totals.failed;
    if (processed >= cap) break;

    const batchIds = queue.slice(0, Math.min(batchSize, cap - processed));
    for (const id of batchIds) attempted.add(id);

    const index = batchOutcomes.length + 1;
    log.info(`Batch ${index} started`, { size: batchIds.length });

    let articles: ArticleForAnalysis[];

    try {
      articles = await getArticlesByIds(batchIds);
    } catch (error) {
      // The batch could not be loaded at all: count it and stop rather than
      // spin on a database that is not answering.
      for (const id of batchIds) {
        countFailure("article_missing");
        log.error("Could not load article for analysis", {
          articleId: id,
          reason: messageOf(error),
        });
      }

      totals.failed += batchIds.length;
      batchOutcomes.push({
        batch: index,
        size: batchIds.length,
        analyzed: 0,
        skipped: 0,
        failed: batchIds.length,
        embedded: 0,
      });
      break;
    }

    // An id the scan saw but the loader did not return: deleted in between.
    const missing = batchIds.length - articles.length;

    if (missing > 0) {
      for (let i = 0; i < missing; i += 1) countFailure("article_missing");
      totals.failed += missing;
      log.warn("Articles disappeared between scan and load", { count: missing });
    }

    // Concurrent within the batch, sequential across batches. allSettled, not
    // all: one rejection must not discard its batch mates' results.
    const results = await Promise.allSettled(
      articles.map((article) => analyzeOne(article, countFailure, log))
    );

    const outcome: AnalyzeBatchOutcome = {
      batch: index,
      size: batchIds.length,
      analyzed: 0,
      skipped: 0,
      failed: missing,
      embedded: 0,
    };

    for (const result of results) {
      if (result.status === "rejected") {
        // analyzeOne catches its own failures, so this is a bug net.
        countFailure("model_error");
        outcome.failed += 1;
        log.error("Unexpected analysis error", {
          reason: messageOf(result.reason),
        });
        continue;
      }

      // An "analyzed" article always carries its embedding: `analyzeOne`
      // reports a saved-but-unembedded analysis separately (section 20).
      if (result.value === "analyzed") {
        outcome.analyzed += 1;
        outcome.embedded += 1;
      } else if (result.value === "skipped") outcome.skipped += 1;
      else {
        outcome.failed += 1;
        if (result.value === "saved_without_embedding") {
          analysesWithoutEmbedding += 1;
        }
      }
    }

    totals.analyzed += outcome.analyzed;
    totals.skipped += outcome.skipped;
    totals.failed += outcome.failed - missing;
    totals.embedded += outcome.embedded;
    batchOutcomes.push(outcome);

    log.info(`Batch ${index} finished`, {
      analyzed: outcome.analyzed,
      skipped: outcome.skipped,
      failed: outcome.failed,
      embedded: outcome.embedded,
    });

    // A whole batch that failed means something systemic - a rejected key, a
    // provider outage - so stop instead of failing every remaining article.
    if (outcome.analyzed === 0 && outcome.failed === batchIds.length) {
      log.error("Stopping: an entire batch failed", { batch: index });
      break;
    }

    // 3. Continue until no pending article remains (rule 3). Re-read rather
    // than walking a list that was already stale when the run started.
    try {
      const refreshed = selected
        ? await filterPendingArticleIds(selected)
        : await getArticlesPendingAnalysis();

      pendingAtEnd = refreshed.length;
      queue = refreshed.filter((id) => !attempted.has(id));
    } catch (error) {
      log.warn("Could not refresh the pending list, continuing with the last one", {
        reason: messageOf(error),
      });
      queue = queue.filter((id) => !attempted.has(id));
    }
  }

  // Embedding backfill (AGENTS.md section 20): analyses that exist without a
  // vector - written before pgvector, or left behind by a failed embedding
  // call. The analysis is never regenerated, only the embedding is added.
  //
  // Backfill work counts against the same cap, so one request cannot run
  // unbounded, and ids already attempted in this run are left for the next one
  // rather than retried immediately.
  const processed = totals.analyzed + totals.skipped + totals.failed;
  const backfillBudget = Math.max(cap - processed, 0);

  // A caller that named article ids asked about those articles only, so the
  // backfill queue is narrowed to them as well (section 19).
  const selectedIds = selected ? new Set(selected) : null;

  try {
    // Everything still missing a vector, including the articles this run just
    // failed to embed: `embeddingsMissingAtEnd` has to be the true figure.
    const missingEmbeddings = await getArticleIdsMissingEmbedding();

    embeddingsMissingAtEnd = missingEmbeddings.length;

    const queueable = missingEmbeddings.filter(
      (id) =>
        !attempted.has(id) && (selectedIds === null || selectedIds.has(id))
    );

    if (queueable.length > 0 && backfillBudget > 0) {
      const queued = queueable.slice(0, backfillBudget);

      log.info("Embedding backfill started", {
        missing: missingEmbeddings.length,
        queued: queued.length,
      });

      const backfill = await backfillEmbeddings(
        queued,
        batchSize,
        countFailure,
        log
      );

      embeddingsBackfilled = backfill.backfilled;
      backfillFailed = backfill.failed;
      embeddingsMissingAtEnd = missingEmbeddings.length - backfill.backfilled;

      log.info("Embedding backfill finished", {
        backfilled: backfill.backfilled,
        failed: backfill.failed,
        stillMissing: embeddingsMissingAtEnd,
      });
    } else if (missingEmbeddings.length > 0) {
      log.warn("Embedding backfill skipped: the run's limit was reached", {
        missing: missingEmbeddings.length,
      });
    }
  } catch (error) {
    log.warn("Could not read the embedding backfill queue", {
      reason: messageOf(error),
    });
  }

  // A run whose only failures stored their analysis and lost the embedding has
  // not failed: those rows are backfill candidates, not lost work.
  const analysisFailures = totals.failed - analysesWithoutEmbedding;
  const everythingFailed = totals.analyzed === 0 && analysisFailures > 0;
  const status: AnalyzeStatus = everythingFailed
    ? "failed"
    : totals.failed > 0 || backfillFailed > 0
      ? "completed_with_errors"
      : "completed";

  log.info(
    status === "failed"
      ? "Analysis failed"
      : status === "completed_with_errors"
        ? "Analysis completed with errors"
        : "Analysis completed",
    {
      analyzed: totals.analyzed,
      skipped: totals.skipped,
      failed: totals.failed,
      embedded: totals.embedded,
      embeddingsBackfilled,
    }
  );

  const summary = summarise(status);
  log.summary(summary);

  return summary;
}
