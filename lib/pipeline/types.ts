/**
 * Typed pipeline results (AGENTS.md sections 9 and 21).
 *
 * `ScrapeSummary` is both the object logged at the end of a run and the body
 * returned by `POST /api/scrape` (section 16).
 */

/**
 * Why an article was not stored. A closed union rather than free text, so
 * section 9's "rejection reasons grouped by count" is countable and typo-proof.
 */
export type RejectionReason =
  // Validation gate (AGENTS.md section 13).
  | "missing_title"
  | "generic_title"
  | "missing_image"
  | "missing_published_date"
  | "non_article_canonical"
  | "thin_body"
  | "unrelated_body"
  // Pipeline outcomes.
  | "detail_fetch_failed"
  | "insert_conflict"
  | "insert_failed";

export type ScrapeStatus = "completed" | "completed_with_errors" | "failed";

/** One source's contribution to the run, for the per-source log line. */
export type SourceOutcome = {
  source: string;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
};

/** The summary object of AGENTS.md section 9's run logging. */
export type ScrapeSummary = {
  status: ScrapeStatus;
  runId: string;
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  durationMs: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  sourceErrors: { source: string; message: string }[];
  /** Absent when the run failed before any source was selected. */
  sources: SourceOutcome[];
};

/** What `runScrape` accepts. Source *names*, never URLs (section 8). */
export type ScrapeOptions = {
  sourceNames?: string[];
  perSource: number;
};

/**
 * Why one article produced no analysis. A closed union, like
 * `RejectionReason`, so the summary's grouped counts stay countable.
 */
export type AnalysisFailureReason =
  // The model answered, but not with something savable, twice.
  | "invalid_output"
  // The provider call itself failed (rate limit, timeout, auth).
  | "model_error"
  // The analysis was valid but could not be written.
  | "save_failed"
  // Nothing to analyse: the article has too little text. Skipped, not failed.
  | "insufficient_text"
  // The article vanished between the pending scan and the batch load.
  | "article_missing";

export type AnalyzeStatus = "completed" | "completed_with_errors" | "failed";

/** One batch's contribution, for the per-batch log line (section 19 rule 7). */
export type AnalyzeBatchOutcome = {
  batch: number;
  size: number;
  analyzed: number;
  skipped: number;
  failed: number;
};

/** The summary object of AGENTS.md section 19 rules 7-9. */
export type AnalyzeSummary = {
  status: AnalyzeStatus;
  runId: string;
  model: string;
  /** Pending articles found when the run started - what it set out to do. */
  pendingAtStart: number;
  analyzed: number;
  skipped: number;
  failed: number;
  batches: number;
  batchSize: number;
  /** Still pending when the run stopped; 0 after a clean full run. */
  pendingAtEnd: number;
  durationMs: number;
  failureReasons: Partial<Record<AnalysisFailureReason, number>>;
  batchOutcomes: AnalyzeBatchOutcome[];
};

/**
 * What `runAnalysis` accepts. Every field is optional, and an empty object
 * means "every pending article" - section 19's default behaviour.
 */
export type AnalyzeOptions = {
  /** Analyse only these articles, skipping any that already have an analysis. */
  articleIds?: string[];
  /** Stop after this many articles. Absent means no limit. */
  limit?: number;
  /** Articles per batch. Absent means `ANALYSIS_BATCH_SIZE`, default 5. */
  batchSize?: number;
};
