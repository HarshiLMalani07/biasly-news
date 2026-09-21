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
