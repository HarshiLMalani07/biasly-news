import "server-only";

import { fetchPageHtml } from "@/lib/oxylabs/client";
import { extractArticle } from "@/lib/parsing/article";
import { checkCandidateUrl } from "@/lib/parsing/candidates";
import { extractCandidateLinks } from "@/lib/parsing/homepage";
import { validateArticle } from "@/lib/parsing/validate";
import type { RunLogger } from "@/lib/pipeline/run-logger";
import type { RejectionReason, SourceOutcome } from "@/lib/pipeline/types";
import {
  DETAIL_ATTEMPT_MULTIPLIER,
  DETAIL_CONCURRENCY,
  toParserStrategy,
} from "@/lib/scraping/limits";
import {
  findExistingUrls,
  insertArticle,
} from "@/lib/supabase/queries/articles";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * Steps 3-8 of the scrape-to-insert pipeline (AGENTS.md section 9), written
 * down once.
 *
 * Section 9 defines a single canonical flow and section 18 says the Scheduler
 * "must not duplicate pipeline logic". Manual scraping and scheduled-result
 * processing differ only in *where the homepage HTML comes from* - live through
 * Oxylabs for the first, a completed Oxylabs job result for the second - so
 * everything downstream of that HTML lives here and both callers share it.
 *
 * Neither caller may fork these steps. Candidate extraction, the reject list,
 * dedupe, the URL existence check, validation, cleanup, the append-only insert
 * and the run logging are all defined here and nowhere else.
 */

/** Running totals for one run. */
export type Totals = {
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
};

export function emptyTotals(): Totals {
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

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight, stopping as
 * soon as `shouldStop` returns true. Keeps a 5x5 run inside `maxDuration`
 * without hammering one publisher.
 */
export async function forEachConcurrently<T>(
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
 * Turns one source's homepage HTML into stored articles: candidates -> filter
 * -> dedupe -> detail pages -> validate -> insert. Mutates `totals` and the
 * rejection tally.
 *
 * `html` is the only thing that differs between the two callers. Nothing in
 * here fetches a homepage, so a scheduled run cannot accidentally scrape one
 * live, and the raw homepage HTML is never stored as an article - it only ever
 * reaches `extractCandidateLinks`.
 *
 * `onEmptyCandidates` is the one hook the two callers use differently. Manual
 * scraping passes a render retry, because it can go back to Oxylabs for the
 * same homepage; a scheduled run has only the HTML its job produced and passes
 * nothing, so an empty homepage is reported rather than refetched. The hook
 * lives here so the retry fires exactly when the candidate count is known and
 * the homepage is not parsed twice to find that out.
 */
export async function processSourceHtml(
  source: SourceRow,
  html: string,
  perSource: number,
  totals: Totals,
  rejections: Map<RejectionReason, number>,
  log: RunLogger,
  options: { onEmptyCandidates?: () => Promise<string> } = {}
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
  let candidates = extractCandidateLinks(html, source.listing_url);

  if (candidates.length === 0) {
    if (options.onEmptyCandidates) {
      log.warn(
        `No candidates without rendering, retrying with render: ${source.name}`
      );
      candidates = extractCandidateLinks(
        await options.onEmptyCandidates(),
        source.listing_url
      );
    } else {
      log.warn(`Homepage HTML yielded no candidate links: ${source.name}`);
    }
  }

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
