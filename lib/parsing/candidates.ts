import {
  PARSER_STRATEGIES,
  type ParserStrategy,
} from "@/lib/scraping/limits";
import { matchRejectRule, type RejectRule } from "@/lib/parsing/reject-list";
import { isSameSite, pathnameOf, segmentsOf } from "@/lib/parsing/urls";

/**
 * Candidate URL filtering (AGENTS.md section 12).
 *
 * Applied *before* any detail page is fetched, so a category or show page never
 * costs an Oxylabs request. Section 12's tie-break is binding: "If the
 * candidate URL check is uncertain, use the stricter choice and reject before
 * detail scraping."
 */

/** A dated slug ending a Reuters path: `...-2026-09-21`. */
const REUTERS_DATED_SLUG = /-\d{4}-\d{2}-\d{2}$/;

/** NPR: `/2026/09/21/nx-s1-5123456/headline-slug`. */
const NPR_DATED_PATH = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/[^/]+/;

/** BBC, current: `/news/articles/c8k9j2l3m4o`. */
const BBC_ARTICLE_ID = /^\/news\/articles\/[a-z0-9]+$/i;

/** BBC, legacy: `/news/world-us-canada-68123456`. */
const BBC_LEGACY_ID = /^\/news\/[a-z-]+-\d{6,}$/i;

/** Guardian: `/us-news/2026/sep/21/headline-slug`. */
const GUARDIAN_DATED_PATH = /\/\d{4}\/[a-z]{3}\/\d{1,2}\//i;

/** A slug of at least four hyphen-separated words. */
const LONG_SLUG = /^(?:[a-z0-9]+-){3,}[a-z0-9]+$/i;

/** A generic date path: `/2026/09/21/` or `/2026/sep/21/`. */
const GENERIC_DATED_PATH = /\/\d{4}\/(?:\d{2}|[a-z]{3})\/\d{1,2}\//i;

/** A trailing article id of six or more digits. */
const TRAILING_NUMERIC_ID = /-?\d{6,}$/;

/** Why a candidate was rejected: a shared rule, or the per-source check. */
export type CandidateRejection = RejectRule | "off_site" | "not_article_shaped";

/**
 * Reuters story URLs carry the publication date in the slug. A category page
 * such as `/world/africa` has no date and is rejected here.
 */
function isReutersArticle(pathname: string): boolean {
  return REUTERS_DATED_SLUG.test(pathname) && segmentsOf(pathname).length >= 2;
}

/**
 * NPR story URLs are date-first. Section pages such as `/sections/politics`
 * never match, and are rejected by the shared list before reaching here.
 */
function isNprArticle(pathname: string): boolean {
  return NPR_DATED_PATH.test(pathname);
}

/**
 * BBC stories are `/news/articles/<id>` today and `/news/<topic>-<digits>`
 * historically. Sport, live and topic pages are rejected by the shared list and
 * the strategy's extra prefixes.
 */
function isBbcArticle(pathname: string): boolean {
  return BBC_ARTICLE_ID.test(pathname) || BBC_LEGACY_ID.test(pathname);
}

/**
 * Fox stories are `/<category>/<long-slug>`. Show, game and live pages are
 * rejected by the shared list and the strategy's extra prefixes.
 */
function isFoxArticle(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  if (segments.length < 2) return false;

  return LONG_SLUG.test(segments[segments.length - 1]);
}

/**
 * Guardian stories carry a date path. Section pages such as `/us/environment`
 * and `/thefilter-us` have none and are rejected here.
 */
function isGuardianArticle(pathname: string): boolean {
  return GUARDIAN_DATED_PATH.test(pathname);
}

/**
 * The fallback for a source with no parser strategy: a date path, a long slug,
 * or a trailing numeric id.
 */
function isGenericArticle(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  if (segments.length < 2) return false;

  const last = segments[segments.length - 1];

  return (
    GENERIC_DATED_PATH.test(pathname) ||
    LONG_SLUG.test(last) ||
    TRAILING_NUMERIC_ID.test(last)
  );
}

const STRATEGY_CHECKS: Record<ParserStrategy, (pathname: string) => boolean> = {
  reuters: isReutersArticle,
  npr: isNprArticle,
  bbc: isBbcArticle,
  fox: isFoxArticle,
  guardian: isGuardianArticle,
};

/**
 * Whether a candidate looks like a real article detail URL for this source.
 *
 * Order matters: the shared reject list and the same-site guard run before the
 * per-source shape check, so an off-site or obviously-not-an-article link never
 * reaches a regex.
 */
export function checkCandidateUrl(
  url: string,
  strategy: ParserStrategy | null
): CandidateRejection | null {
  const settings = strategy ? PARSER_STRATEGIES[strategy] : null;

  if (settings && !isSameSite(url, settings.hosts)) return "off_site";

  const pathname = pathnameOf(url);
  const rule = matchRejectRule(pathname);
  if (rule) return rule;

  if (settings) {
    const lower = pathname.toLowerCase();
    const hitsExtraPrefix = settings.extraRejectPrefixes.some(
      (prefix) => lower === prefix || lower.startsWith(`${prefix}/`)
    );

    if (hitsExtraPrefix) return "category_or_section";
  }

  const check = strategy ? STRATEGY_CHECKS[strategy] : isGenericArticle;

  return check(pathname) ? null : "not_article_shaped";
}

/** Convenience boolean form of `checkCandidateUrl`. */
export function isLikelyArticleUrl(
  url: string,
  strategy: ParserStrategy | null
): boolean {
  return checkCandidateUrl(url, strategy) === null;
}
