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
  | "article_missing"
  // The embedding call failed (AGENTS.md section 20). The analysis is still
  // saved; the article stays unstamped and is backfilled on the next run.
  | "embedding_failed"
  // The embedding was generated but could not be written.
  | "embedding_save_failed";

export type AnalyzeStatus = "completed" | "completed_with_errors" | "failed";

/** One batch's contribution, for the per-batch log line (section 19 rule 7). */
export type AnalyzeBatchOutcome = {
  batch: number;
  size: number;
  analyzed: number;
  skipped: number;
  failed: number;
  /** Articles that also got an embedding saved (AGENTS.md section 20). */
  embedded: number;
};

/** The summary object of AGENTS.md section 19 rules 7-9. */
export type AnalyzeSummary = {
  status: AnalyzeStatus;
  runId: string;
  model: string;
  /** The embedding model of AGENTS.md section 20. */
  embeddingModel: string;
  /** Pending articles found when the run started - what it set out to do. */
  pendingAtStart: number;
  analyzed: number;
  skipped: number;
  failed: number;
  /** Newly analysed articles that also got an embedding. */
  embedded: number;
  /** Existing analyses whose missing embedding this run filled in. */
  embeddingsBackfilled: number;
  /** Analyses still without an embedding when the run stopped. */
  embeddingsMissingAtEnd: number;
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

/* -------------------------------------------------------------------------
 * Oxylabs Scheduler and the automatic hourly pipeline (AGENTS.md section 18)
 * ------------------------------------------------------------------------- */

/** One source's schedule, as the sync route reports it. */
export type SyncedSchedule = {
  source: string;
  /** The exact 64-bit id as a digit string - never a number (section 18). */
  scheduleId: string;
  cron: string;
  /** True when this run created it, false when it already existed. */
  created: boolean;
};

/** The summary object `syncSchedules` logs and returns. */
export type SyncSchedulesSummary = {
  status: ScrapeStatus;
  runId: string;
  activeSources: number;
  schedulesCreated: number;
  schedulesExisting: number;
  /** Schedules switched off because their source is no longer active. */
  schedulesDeactivated: number;
  /** Oxylabs schedules with no DB row, switched off by the orphan sweep. */
  orphansDeactivated: number;
  durationMs: number;
  errors: { scope: string; message: string }[];
  schedules: SyncedSchedule[];
};

/** What `runScheduledProcessing` accepts. */
export type ScheduledProcessingOptions = {
  perSource: number;
};

/**
 * The summary object `runScheduledProcessing` logs and returns.
 *
 * Every `ScrapeSummary` field is present and means exactly what it means for a
 * manual run - the two share the same pipeline code - plus the job accounting
 * that is specific to pulling HTML out of the Scheduler.
 */
export type ScheduledProcessingSummary = ScrapeSummary & {
  schedulesChecked: number;
  /** Completed jobs seen, whether or not this pass consumed them. */
  jobsDone: number;
  jobsProcessed: number;
  /** Older completed jobs closed without a fetch, newest-wins (section 18). */
  jobsSuperseded: number;
  /** Still running at Oxylabs; left alone for the next pass. */
  jobsPending: number;
  /** Failed at Oxylabs; closed so they are not retried forever. */
  jobsFaulted: number;
};

/** The summary object `runCronPipeline` logs and returns. */
export type CronPipelineSummary = {
  status: ScrapeStatus;
  runId: string;
  /** Step one. Null when it threw before producing a summary. */
  processing: ScheduledProcessingSummary | null;
  processingError: string | null;
  /** Step two. Runs even when step one failed (section 18 rule 6). */
  analysis: AnalyzeSummary | null;
  analysisError: string | null;
  durationMs: number;
};
