import * as cheerio from "cheerio";

import { MAX_CANDIDATES_PER_SOURCE } from "@/lib/scraping/limits";
import { absolutise, normaliseUrl } from "@/lib/parsing/urls";

/**
 * Homepage article link extraction (AGENTS.md section 11).
 *
 * "When scraping a source homepage, do not collect every link. Extract only
 * visible story/article card links from the homepage content."
 *
 * Navigation, menus and footers are removed from the DOM first, so they are
 * excluded structurally rather than by guessing at their URLs. Article-likeness
 * is *not* decided here - that is `candidates.ts` - so the run log can report
 * "candidates found" and "candidates rejected" as separate numbers.
 */

/** Page chrome: never a story card. */
const CHROME_SELECTOR =
  'script, style, noscript, nav, header, footer, aside, form, ' +
  '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
  '[aria-label*="navigation" i], [aria-label*="menu" i], ' +
  '[class*="nav" i], [class*="menu" i], [class*="footer" i], ' +
  '[class*="masthead" i], [class*="subnav" i]';

/** Containers that hold story cards on a news homepage. */
const STORY_CONTAINER_SELECTOR =
  'main, [role="main"], article, ' +
  '[class*="story" i], [class*="card" i], [class*="teaser" i], ' +
  '[class*="promo" i], [class*="headline" i], [data-testid*="card" i], ' +
  '[data-component*="card" i], [data-component*="text-block" i]';

/**
 * Candidate links from one homepage, absolute, normalised and deduped.
 *
 * `baseUrl` is the source's stored `listing_url`; relative hrefs resolve
 * against it. Sublinks are never followed to find more listing pages
 * (AGENTS.md section 9).
 */
export function extractCandidateLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);

  $(CHROME_SELECTOR).remove();

  // Prefer anchors inside story containers; fall back to the whole remaining
  // body for homepages whose markup carries no recognisable card classes.
  let anchors = $(STORY_CONTAINER_SELECTOR).find("a[href]");
  if (anchors.length === 0) anchors = $("a[href]");

  const seen = new Set<string>();
  const candidates: string[] = [];

  anchors.each((_, element) => {
    if (candidates.length >= MAX_CANDIDATES_PER_SOURCE) return false;

    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;

    // An anchor with no text is an icon or an image-only chrome link, unless it
    // wraps a heading - which is exactly how many story cards are built.
    const hasText = anchor.text().trim().length > 0;
    const hasHeading = anchor.find("h1, h2, h3, h4").length > 0;
    if (!hasText && !hasHeading) return;

    const absolute = absolutise(href, baseUrl);
    if (!absolute) return;

    const normalised = normaliseUrl(absolute);
    if (seen.has(normalised)) return;

    seen.add(normalised);
    candidates.push(normalised);
  });

  return candidates;
}
