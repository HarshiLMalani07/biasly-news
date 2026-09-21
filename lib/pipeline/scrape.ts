import "server-only";

import { fetchPageHtml } from "@/lib/oxylabs/client";
import { extractArticle } from "@/lib/parsing/article";
import { checkCandidateUrl } from "@/lib/parsing/candidates";
import { extractCandidateLinks } from "@/lib/parsing/homepage";
import { validateArticle } from "@/lib/parsing/validate";
import { createRunLogger, type RunLogger } from "@/lib/pipeline/run-logger";
import type {
  RejectionReason,
  ScrapeOptions,
  ScrapeSummary,
  SourceOutcome,
} from "@/lib/pipeline/types";
import {
  DETAIL_ATTEMPT_MULTIPLIER,
  DETAIL_CONCURRENCY,
  SOURCE_CONCURRENCY,
  toParserStrategy,
} from "@/lib/scraping/limits";
import {
  findExistingUrls,
  insertArticle,
} from "@/lib/supabase/queries/articles";
import {
  getActiveSources,
  getActiveSourcesByNames,
} from "@/lib/supabase/queries/sources";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * The scrape-to-insert pipeline (AGENTS.md section 9).
 *
 * This is the canonical order, written down once. The Oxylabs Scheduler task
 * (section 18) reuses these same steps and differs only in where the homepage
 * HTML comes from - it must not duplicate this logic.
 */

/** Running totals for one run. */
type Totals = {
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
};

function emptyTotals(): Totals {
  return {
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight, stopping as
 * soon as `shouldStop` returns true. Keeps a 5x5 run inside `maxDuration`
 * without hammering one publisher.
 */
async function forEachConcurrently<T>(
  items: T[],
  concurrency: number,
  shouldStop: () => boolean,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;

  async function runLane(): Promise<void> {
    while (true) {
      if (shouldStop()) return;

      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      await worker(items[index]);
    }
  }

  const lanes = Array.from(
    { length: Math.min(concurrency, items.length) },
    runLane
  );

  await Promise.all(lanes);
}

/**
 * Scrapes one source: homepage -> candidates -> filter -> dedupe -> detail
 * pages -> validate -> insert. Mutates `totals` and the rejection tally.
 */
async function scrapeSource(
  source: SourceRow,
  perSource: number,
  totals: Totals,
  rejections: Map<RejectionReason, number>,
  log: RunLogger
): Promise<SourceOutcome> {
  const outcome: SourceOutcome = {
    source: source.name,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
  };

  const strategy = toParserStrategy(source.parser_strategy);

  log.info(`Source started: ${source.name} (${source.listing_url})`);

  // 2. Homepage HTML, fetched live through Oxylabs.
  let html = await fetchPageHtml(source.listing_url);
  let candidates = extractCandidateLinks(html, source.listing_url);

  // Decision 5: a homepage that yields nothing is retried once with rendering
  // before being reported as empty.
  if (candidates.length === 0) {
    log.warn(`No candidates without rendering, retrying with render: ${source.name}`);
    html = await fetchPageHtml(source.listing_url, { render: true });
    candidates = extractCandidateLinks(html, source.listing_url);
  }

  log.info(`Homepage fetched: ${source.name}`, { candidates: candidates.length });

  outcome.candidatesFound = candidates.length;
  totals.candidatesFound += candidates.length;
  log.info(`Candidate links found: ${source.name}`, { count: candidates.length });

  // 3-4. Reject non-article URLs before any detail scrape (sections 11-12).
  const articleUrls: string[] = [];
  let rejectedBefore = 0;

  for (const candidate of candidates) {
    if (checkCandidateUrl(candidate, strategy) === null) articleUrls.push(candidate);
    else rejectedBefore += 1;
  }

  outcome.candidatesRejected = rejectedBefore;
  totals.candidatesRejected += rejectedBefore;
  log.info(`Candidates rejected before detail scrape: ${source.name}`, {
    count: rejectedBefore,
  });

  // 5. URL existence check - already chunked at 15 (section 9).
  const existing = await findExistingUrls(articleUrls);
  const fresh = articleUrls.filter((url) => !existing.has(url));
  const duplicates = articleUrls.length - fresh.length;

  outcome.duplicatesSkipped += duplicates;
  totals.duplicatesSkipped += duplicates;
  log.info(`Duplicates skipped: ${source.name}`, { count: duplicates });

  // 6-8. Over-fetch detail pages until `perSource` valid articles are stored.
  const attemptLimit = perSource * DETAIL_ATTEMPT_MULTIPLIER;
  const queue = fresh.slice(0, attemptLimit);
  let attempted = 0;

  // Slots claimed by a lane that is mid-insert. Lanes run concurrently, so
  // testing `articlesInserted` alone is check-then-act: several lanes pass the
  // test before any insert resolves and the source overshoots `perSource`.
  // Claiming a slot synchronously - no await between the test and the
  // increment - makes the limit hold.
  let reserved = 0;

  function countRejection(reason: RejectionReason): void {
    rejections.set(reason, (rejections.get(reason) ?? 0) + 1);
  }

  await forEachConcurrently(
    queue,
    DETAIL_CONCURRENCY,
    () => reserved >= perSource || attempted >= attemptLimit,
    async (url) => {
      attempted += 1;

      let detailHtml: string;

      try {
        detailHtml = await fetchPageHtml(url);
      } catch (error) {
        outcome.articlesFailed += 1;
        totals.articlesFailed += 1;
        countRejection("detail_fetch_failed");
        log.warn(`Detail fetch failed: ${url}`, { reason: messageOf(error) });
        return;
      }

      outcome.detailPagesScraped += 1;
      totals.detailPagesScraped += 1;

      // 7. Validate and clean (section 13).
      const result = validateArticle(extractArticle(detailHtml, url), url, strategy);

      if (!result.ok) {
        outcome.articlesRejected += 1;
        totals.articlesRejected += 1;
        countRejection(result.reason);
        log.warn(`Article rejected: ${url}`, { reason: result.reason });
        return;
      }

      // Another lane may have filled the last slot while this page was being
      // fetched. Claim one before awaiting the insert, and release it again if
      // the insert does not produce a row.
      if (reserved >= perSource) return;
      reserved += 1;

      // 8. Append-only insert (section 10).
      try {
        const inserted = await insertArticle({
          source_id: source.id,
          ...result.article,
        });

        if (inserted === null) {
          reserved -= 1;
          outcome.duplicatesSkipped += 1;
          totals.duplicatesSkipped += 1;
          countRejection("insert_conflict");
          log.info(`Duplicate on insert, skipped: ${url}`);
          return;
        }

        outcome.articlesInserted += 1;
        totals.articlesInserted += 1;
        log.info(`Article inserted: ${result.article.title}`, { url });
      } catch (error) {
        reserved -= 1;
        outcome.articlesFailed += 1;
        totals.articlesFailed += 1;
        countRejection("insert_failed");
        log.error(`Insert failed: ${url}`, { reason: messageOf(error) });
      }
    }
  );

  log.info(`Source finished: ${source.name}`, {
    detailPagesScraped: outcome.detailPagesScraped,
    articlesInserted: outcome.articlesInserted,
    articlesRejected: outcome.articlesRejected,
    articlesFailed: outcome.articlesFailed,
  });

  return outcome;
}

/**
 * Runs the pipeline over the selected active sources and returns the section 9
 * summary object.
 *
 * A source that throws is logged and skipped; the run continues and reports
 * `completed_with_errors`. Nothing is ever deleted, replaced or reset.
 */
export async function runScrape(
  options: ScrapeOptions
): Promise<ScrapeSummary> {
  const log = createRunLogger("scrape");
  const startedAt = Date.now();
  const totals = emptyTotals();
  const rejections = new Map<RejectionReason, number>();
  const sourceErrors: { source: string; message: string }[] = [];
  const outcomes: SourceOutcome[] = [];
  let sourcesChecked = 0;

  log.info("Scrape started", {
    perSource: options.perSource,
    requestedSources: options.sourceNames ?? "all active",
  });

  function summarise(status: ScrapeSummary["status"]): ScrapeSummary {
    return {
      status,
      runId: log.runId,
      sourcesChecked,
      ...totals,
      durationMs: Date.now() - startedAt,
      rejectionReasons: Object.fromEntries(rejections) as Partial<
        Record<RejectionReason, number>
      >,
      sourceErrors,
      sources: outcomes,
    };
  }

  // 1. Load the selected active sources from Supabase (section 8).
  let sources: SourceRow[];

  try {
    sources = options.sourceNames
      ? await getActiveSourcesByNames(options.sourceNames)
      : await getActiveSources();
  } catch (error) {
    log.error("Scrape failed: could not load sources", {
      reason: messageOf(error),
    });
    const summary = summarise("failed");
    log.summary(summary);
    return summary;
  }

  if (sources.length === 0) {
    log.error("Scrape failed: no active source matched the selection", {
      requestedSources: options.sourceNames ?? "all active",
    });
    const summary = summarise("failed");
    log.summary(summary);
    return summary;
  }

  log.info("Selected sources", { sources: sources.map((s) => s.name) });

  // Sources run concurrently: a run cannot finish faster than its slowest
  // source, so doing them one at a time only adds the others on top. Every log
  // line names its source, so section 9's run log stays readable interleaved.
  await forEachConcurrently(
    sources,
    SOURCE_CONCURRENCY,
    () => false,
    async (source) => {
      sourcesChecked += 1;

      try {
        outcomes.push(
          await scrapeSource(source, options.perSource, totals, rejections, log)
        );
      } catch (error) {
        const message = messageOf(error);
        sourceErrors.push({ source: source.name, message });
        log.error(`Source failed: ${source.name}`, { reason: message });
      }
    }
  );

  // Completion order is nondeterministic under concurrency; sort so the
  // summary reads the same way twice.
  outcomes.sort((a, b) => a.source.localeCompare(b.source));
  sourceErrors.sort((a, b) => a.source.localeCompare(b.source));

  const summary = summarise(
    sourceErrors.length > 0 ? "completed_with_errors" : "completed"
  );

  log.info(
    sourceErrors.length > 0 ? "Scrape completed with errors" : "Scrape completed"
  );
  log.summary(summary);

  return summary;
}
