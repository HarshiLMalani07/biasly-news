import "server-only";

import { analyzeArticle } from "@/lib/ai/analyze-article";
import {
  ANALYSIS_MODEL,
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
  getArticlesByIds,
  getArticlesPendingAnalysis,
  saveAnalysis,
  type ArticleForAnalysis,
} from "@/lib/supabase/queries/analyses";

/**
 * The AI analysis pipeline (AGENTS.md section 19).
 *
 * Pending articles are found by the LEFT JOIN check, never by `analyzed_at`
 * alone, and a run keeps going until none are left. Batching bounds wall time
 * and concurrent model calls; it is not a cap on how much a run analyses.
 */

/** Running totals for one run. */
type Totals = {
  analyzed: number;
  skipped: number;
  failed: number;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One article's outcome, as the batch loop reports it. */
type ArticleOutcome = "analyzed" | "skipped" | "failed";

/**
 * Analyses one article and saves it. Every failure path is caught here: a
 * batch must never be taken down by one article.
 *
 * `analyzed_at` is stamped inside `saveAnalysis`, after the analysis row is
 * written (section 19 rule 6), so an article that fails here stays pending.
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

  const result = await analyzeArticle({
    articleId: article.id,
    title: article.title,
    sourceName: article.source_name ?? "Unknown publication",
    publishedAt: article.published_at,
    text,
  });

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

  try {
    await saveAnalysis(result.analysis);
  } catch (error) {
    countFailure("save_failed");
    log.error(`Save failed: ${article.title}`, {
      articleId: article.id,
      reason: messageOf(error),
    });

    return "failed";
  }

  log.info(`Article analysed: ${article.title}`, {
    articleId: article.id,
    framing: result.analysis.bias_label,
    sentiment: result.analysis.sentiment_label,
    confidence: result.analysis.confidence,
  });

  return "analyzed";
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
  const totals: Totals = { analyzed: 0, skipped: 0, failed: 0 };
  const failureReasons = new Map<AnalysisFailureReason, number>();
  const batchOutcomes: AnalyzeBatchOutcome[] = [];

  const batchSize = resolveBatchSize(options.batchSize);
  const cap = Math.min(options.limit ?? MAX_ANALYSIS_ARTICLES, MAX_ANALYSIS_ARTICLES);
  const selected = options.articleIds;

  let pendingAtStart = 0;
  let pendingAtEnd = 0;

  function countFailure(reason: AnalysisFailureReason): void {
    failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
  }

  function summarise(status: AnalyzeStatus): AnalyzeSummary {
    return {
      status,
      runId: log.runId,
      model: ANALYSIS_MODEL,
      pendingAtStart,
      ...totals,
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

  if (pendingAtStart === 0) {
    log.info("Analysis completed: nothing pending");
    const summary = summarise("completed");
    log.summary(summary);
    return summary;
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

      if (result.value === "analyzed") outcome.analyzed += 1;
      else if (result.value === "skipped") outcome.skipped += 1;
      else outcome.failed += 1;
    }

    totals.analyzed += outcome.analyzed;
    totals.skipped += outcome.skipped;
    totals.failed += outcome.failed - missing;
    batchOutcomes.push(outcome);

    log.info(`Batch ${index} finished`, {
      analyzed: outcome.analyzed,
      skipped: outcome.skipped,
      failed: outcome.failed,
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

  const everythingFailed = totals.analyzed === 0 && totals.failed > 0;
  const status: AnalyzeStatus = everythingFailed
    ? "failed"
    : totals.failed > 0
      ? "completed_with_errors"
      : "completed";

  log.info(
    status === "failed"
      ? "Analysis failed"
      : status === "completed_with_errors"
        ? "Analysis completed with errors"
        : "Analysis completed",
    { analyzed: totals.analyzed, skipped: totals.skipped, failed: totals.failed }
  );

  const summary = summarise(status);
  log.summary(summary);

  return summary;
}
