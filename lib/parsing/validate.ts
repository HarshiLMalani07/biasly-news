import type { ExtractedArticle } from "@/lib/parsing/article";
import { splitLongParagraph } from "@/lib/parsing/clean";
import { isLikelyArticleUrl } from "@/lib/parsing/candidates";
import type { RejectionReason } from "@/lib/pipeline/types";
import {
  MAX_PUBLISHED_FUTURE_DAYS,
  MIN_BODY_CHARACTERS,
  MIN_BODY_PARAGRAPHS,
  MIN_TITLE_CHARACTERS,
  type ParserStrategy,
} from "@/lib/scraping/limits";

/**
 * The article content gate (AGENTS.md sections 9 and 13).
 *
 * Accept only a page with an article-specific URL and title, one clear subject,
 * a meaningful body, a published date and an image. Every rejection maps to one
 * `RejectionReason` so the run summary can group them by count.
 */

/** The fields an accepted article contributes to an `articles` insert. */
export type ValidArticle = {
  url: string;
  canonical_url: string | null;
  title: string;
  image_url: string;
  published_at: string;
  raw_text: string;
};

export type ValidationResult =
  | { ok: true; article: ValidArticle }
  | { ok: false; reason: RejectionReason };

/**
 * Titles that name a section, show, product or error page rather than a story.
 * Compared case-insensitively against the whole title.
 */
const GENERIC_TITLES = [
  "home", "homepage", "news", "latest news", "breaking news", "top stories",
  "video", "videos", "live", "live news", "watch", "watch live", "shows",
  "podcasts", "newsletters", "subscribe", "search", "search results",
  "privacy policy", "terms of use", "terms of service", "contact us",
  "about us", "page not found", "404", "not found", "access denied",
  "error", "forbidden", "are you a robot", "robot check", "just a moment",
  "sign in", "log in", "register", "please enable javascript",
] as const;

const SENTENCE_END = /[.!?]["'”’]?$/;

const MILLISECONDS_PER_DAY = 86_400_000;

function isGenericTitle(title: string): boolean {
  const lower = title.trim().toLowerCase().replace(/\s+/g, " ");

  return GENERIC_TITLES.some((generic) => lower === generic);
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A body that is mostly other headlines: short lines with no sentence-ending
 * punctuation (AGENTS.md section 13, "body is mostly unrelated headlines").
 */
function isMostlyHeadlines(paragraphs: string[]): boolean {
  if (paragraphs.length === 0) return true;

  const headlineLike = paragraphs.filter(
    (paragraph) => paragraph.length < 120 && !SENTENCE_END.test(paragraph)
  ).length;

  return headlineLike > paragraphs.length / 2;
}

/**
 * Validates one extracted page.
 *
 * `url` is the already-normalised URL the page was fetched from; it has passed
 * the candidate check, which is section 13's "article-specific URL" criterion.
 */
export function validateArticle(
  extracted: ExtractedArticle,
  url: string,
  strategy: ParserStrategy | null
): ValidationResult {
  const { title, imageUrl, publishedAt, canonicalUrl } = extracted;

  if (!title || title.trim().length < MIN_TITLE_CHARACTERS) {
    return { ok: false, reason: "missing_title" };
  }

  if (isGenericTitle(title)) {
    return { ok: false, reason: "generic_title" };
  }

  if (!imageUrl || !isAbsoluteHttpUrl(imageUrl)) {
    return { ok: false, reason: "missing_image" };
  }

  if (!publishedAt) {
    return { ok: false, reason: "missing_published_date" };
  }

  const published = new Date(publishedAt);

  if (Number.isNaN(published.getTime())) {
    return { ok: false, reason: "missing_published_date" };
  }

  const futureLimit =
    Date.now() + MAX_PUBLISHED_FUTURE_DAYS * MILLISECONDS_PER_DAY;

  if (published.getTime() > futureLimit) {
    return { ok: false, reason: "missing_published_date" };
  }

  // A canonical pointing at a listing, category, programme or product page
  // means the detail page was a redirect target, not a story (section 13).
  if (canonicalUrl && !isLikelyArticleUrl(canonicalUrl, strategy)) {
    return { ok: false, reason: "non_article_canonical" };
  }

  let paragraphs = extracted.paragraphs;

  if (paragraphs.length === 1) {
    paragraphs = splitLongParagraph(paragraphs[0]);
  }

  const characters = paragraphs.reduce(
    (total, paragraph) => total + paragraph.length,
    0
  );

  const passesBodyGate =
    paragraphs.length >= MIN_BODY_PARAGRAPHS ||
    characters >= MIN_BODY_CHARACTERS;

  if (!passesBodyGate) {
    return { ok: false, reason: "thin_body" };
  }

  if (isMostlyHeadlines(paragraphs)) {
    return { ok: false, reason: "unrelated_body" };
  }

  return {
    ok: true,
    article: {
      url,
      canonical_url: canonicalUrl,
      title: title.trim(),
      image_url: imageUrl,
      published_at: published.toISOString(),
      // Blank-line separated so `lib/text.ts` toParagraphs reads it back as
      // the same paragraphs the details page renders.
      raw_text: paragraphs.join("\n\n"),
    },
  };
}
