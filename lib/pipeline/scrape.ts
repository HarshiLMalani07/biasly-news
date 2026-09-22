import "server-only";

import { fetchPageHtml } from "@/lib/oxylabs/client";
import { createRunLogger, type RunLogger } from "@/lib/pipeline/run-logger";
import {
  emptyTotals,
  forEachConcurrently,
  messageOf,
  processSourceHtml,
  type Totals,
} from "@/lib/pipeline/source-run";
import type {
  RejectionReason,
  ScrapeOptions,
  ScrapeSummary,
  SourceOutcome,
} from "@/lib/pipeline/types";
import { SOURCE_CONCURRENCY } from "@/lib/scraping/limits";
import {
  getActiveSources,
  getActiveSourcesByNames,
} from "@/lib/supabase/queries/sources";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * Manual scraping (AGENTS.md sections 9 and 16).
 *
 * This module owns only what is specific to a manual run: selecting sources
 * (section 8) and fetching each homepage live through Oxylabs. Steps 3-8 - the
 * canonical scrape-to-insert pipeline - live in `lib/pipeline/source-run.ts`,
 * which the Oxylabs Scheduler (section 18) shares rather than duplicating.
 */

/**
 * Scrapes one source: homepage -> `processSourceHtml`. Mutates `totals` and the
 * rejection tally.
 */
async function scrapeSource(
  source: SourceRow,
  perSource: number,
  totals: Totals,
  rejections: Map<RejectionReason, number>,
  log: RunLogger
): Promise<SourceOutcome> {
  log.info(`Source started: ${source.name} (${source.listing_url})`);

  // 2. Homepage HTML, fetched live through Oxylabs.
  const html = await fetchPageHtml(source.listing_url);

  log.info(`Homepage fetched: ${source.name}`);

  // Decision 5: a homepage that yields no candidates at all is retried once
  // with rendering before being reported as empty.
  return processSourceHtml(source, html, perSource, totals, rejections, log, {
    onEmptyCandidates: () =>
      fetchPageHtml(source.listing_url, { render: true }),
  });
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
