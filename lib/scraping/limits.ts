/**
 * Every tunable number and per-source setting the scraping pipeline uses.
 *
 * AGENTS.md section 21 asks for centralized limits: no magic number belongs in
 * the parsing, pipeline, or route layers. This module is plain data with no
 * secrets and no I/O, so it is deliberately *not* `server-only` - parsing code
 * and route handlers both import it.
 */

/** AGENTS.md section 16: up to 5 valid articles per source by default. */
export const DEFAULT_ARTICLES_PER_SOURCE = 5;

/** Upper bound the `perSource` request field is validated against. */
export const MAX_ARTICLES_PER_SOURCE = 20;

/**
 * How many candidates one source may be given to reach `perSource` valid
 * articles. Validation rejects a meaningful share of pages, so the detail loop
 * over-fetches rather than giving up at exactly `perSource` attempts.
 */
export const DETAIL_ATTEMPT_MULTIPLIER = 3;

/** Detail pages scraped in parallel within one source. */
export const DETAIL_CONCURRENCY = 4;

/**
 * Sources scraped in parallel.
 *
 * A run's wall time has a floor of whatever its slowest source takes, so
 * processing sources one after another just adds the rest on top. Peak load on
 * Oxylabs is roughly SOURCE_CONCURRENCY * DETAIL_CONCURRENCY requests; raise
 * this only if the account's rate limit has the headroom, since a 429 fails
 * the source that hits it.
 */
export const SOURCE_CONCURRENCY = 3;

/** Cap on links kept from one homepage before article-likeness filtering. */
export const MAX_CANDIDATES_PER_SOURCE = 60;

/**
 * Client timeout for a *rendered* Oxylabs Realtime call. The web-scraper-api
 * skill asks for "client timeouts near 180 seconds" for those.
 */
export const OXYLABS_RENDER_TIMEOUT_MS = 180_000;

/**
 * Client timeout for a plain (unrendered) call.
 *
 * Deliberately far below the rendered budget: an unrendered fetch that has not
 * answered in a minute is a publisher stalling us, and a 5x5 run cannot afford
 * to wait three minutes per page to find that out.
 */
export const OXYLABS_TIMEOUT_MS = 60_000;

/** AGENTS.md section 13: 3 or more meaningful paragraphs ... */
export const MIN_BODY_PARAGRAPHS = 3;

/** ... or 900 or more meaningful characters after cleanup. */
export const MIN_BODY_CHARACTERS = 900;

/** Below this, a line needs sentence punctuation to count as a paragraph. */
export const MIN_PARAGRAPH_CHARACTERS = 40;

/** Shorter than this is a nav label or a section name, not a headline. */
export const MIN_TITLE_CHARACTERS = 15;

/** Clock-skew guard on `published_at`, not a freshness filter. */
export const MAX_PUBLISHED_FUTURE_DAYS = 2;

/**
 * When extraction returns one block of text, it is split into chunks of about
 * this many sentences (AGENTS.md section 13: a page must not be rejected only
 * because paragraph extraction returned one paragraph).
 */
export const SENTENCES_PER_SPLIT_PARAGRAPH = 3;

/**
 * Per-source parser settings, keyed by `sources.parser_strategy` as seeded in
 * `supabase/seed.sql`. `hosts` is the SSRF guard: a candidate link must live on
 * one of these hosts (or a subdomain) before it is ever fetched.
 *
 * Source homepage URLs are never listed here - they are loaded from Supabase
 * (AGENTS.md section 8, "Do not invent source URLs").
 */
export type ParserStrategy = "reuters" | "npr" | "bbc" | "fox" | "guardian";

export type ParserSettings = {
  /** Hosts a candidate URL for this source may point at. */
  hosts: readonly string[];
  /** Path prefixes rejected on top of the shared non-article reject list. */
  extraRejectPrefixes: readonly string[];
};

export const PARSER_STRATEGIES: Readonly<
  Record<ParserStrategy, ParserSettings>
> = {
  reuters: {
    hosts: ["reuters.com"],
    extraRejectPrefixes: ["/graphics", "/investigates", "/sports"],
  },
  npr: {
    hosts: ["npr.org"],
    extraRejectPrefixes: ["/sections", "/programs", "/series", "/podcasts"],
  },
  bbc: {
    hosts: ["bbc.com", "bbc.co.uk"],
    extraRejectPrefixes: [
      "/sport",
      "/news/live",
      "/news/topics",
      "/news/videos",
      "/weather",
      "/iplayer",
      "/sounds",
    ],
  },
  fox: {
    hosts: ["foxnews.com"],
    extraRejectPrefixes: [
      "/shows",
      "/games",
      "/live-news",
      "/person",
      "/official-polls",
    ],
  },
  guardian: {
    hosts: ["theguardian.com"],
    extraRejectPrefixes: ["/crosswords", "/football/live", "/info"],
  },
};

/** Narrows a stored `parser_strategy` to a key of `PARSER_STRATEGIES`. */
export function toParserStrategy(value: string | null): ParserStrategy | null {
  if (value !== null && value in PARSER_STRATEGIES) {
    return value as ParserStrategy;
  }

  return null;
}
