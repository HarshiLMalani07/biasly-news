import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

import {
  cleanBodyElement,
  cleanParagraphs,
  normaliseWhitespace,
  splitLongParagraph,
} from "@/lib/parsing/clean";
import { absolutise, normaliseUrl } from "@/lib/parsing/urls";

/**
 * Article detail page extraction.
 *
 * Extraction only: every field may come back null and nothing is accepted or
 * rejected here. The accept/reject decision is `validate.ts` (AGENTS.md
 * section 13), so the reason a page failed is decided in one place.
 */

export type ExtractedArticle = {
  title: string | null;
  imageUrl: string | null;
  /** ISO 8601, or null when no parseable date was found. */
  publishedAt: string | null;
  canonicalUrl: string | null;
  paragraphs: string[];
};

/** Body containers, most specific first. */
const BODY_SELECTORS = [
  '[itemprop="articleBody"]',
  '[data-component="text-block"]',
  '[class*="article-body" i]',
  '[class*="story-body" i]',
  '[class*="article__body" i]',
  '[class*="entry-content" i]',
  "article",
  "main",
] as const;

/**
 * What counts as a paragraph inside a body container.
 *
 * Not every publisher uses `<p>`: Reuters renders each paragraph as a
 * `<div data-testid="paragraph-N">`, so matching only `p` would find nothing
 * and reject every Reuters story as a thin body.
 */
const PARAGRAPH_SELECTOR = 'p, [data-testid^="paragraph"]';

/** Reads a `<meta>` value by property or name. */
function metaContent($: CheerioAPI, keys: string[]): string | null {
  for (const key of keys) {
    const value =
      $(`meta[property="${key}"]`).attr("content") ??
      $(`meta[name="${key}"]`).attr("content") ??
      $(`meta[itemprop="${key}"]`).attr("content");

    if (value && value.trim().length > 0) return value.trim();
  }

  return null;
}

/**
 * Every JSON-LD object on the page, flattened.
 *
 * Tolerates an array at the top level, a `@graph` wrapper, and invalid JSON -
 * scraped markup is untrusted and malformed LD is common.
 */
function jsonLdObjects($: CheerioAPI): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text();
    if (!raw || raw.trim().length === 0) return;

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const queue: unknown[] = [parsed];

    while (queue.length > 0) {
      const item = queue.shift();

      if (Array.isArray(item)) {
        queue.push(...item);
        continue;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        objects.push(record);

        if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
      }
    }
  });

  return objects;
}

/** The first non-empty string value for `key` across all JSON-LD objects. */
function jsonLdString(
  objects: Record<string, unknown>[],
  key: string
): string | null {
  for (const object of objects) {
    const value = object[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

/** JSON-LD `image` is a string, an array, or an ImageObject. */
function jsonLdImage(objects: Record<string, unknown>[]): string | null {
  for (const object of objects) {
    const value = object.image;

    if (typeof value === "string" && value.trim()) return value.trim();

    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object") {
        const url = (first as Record<string, unknown>).url;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }

    if (value && typeof value === "object") {
      const url = (value as Record<string, unknown>).url;
      if (typeof url === "string" && url.trim()) return url.trim();
    }
  }

  return null;
}

/** Strips a trailing " | Source" or " - Source" suffix from a `<title>`. */
function trimTitleSuffix(title: string): string {
  const separator = title.lastIndexOf(" | ");
  const dash = title.lastIndexOf(" - ");
  const cut = Math.max(separator, dash);

  // Only trim when what follows looks like a site name, not a subtitle.
  if (cut > 20 && title.length - cut < 40) return title.slice(0, cut).trim();

  return title;
}

function extractTitle($: CheerioAPI, lds: Record<string, unknown>[]): string | null {
  const fromMeta = metaContent($, ["og:title", "twitter:title"]);
  if (fromMeta) return normaliseWhitespace(fromMeta);

  const fromHeading = $("h1").first().text();
  if (fromHeading.trim().length > 0) return normaliseWhitespace(fromHeading);

  const fromLd = jsonLdString(lds, "headline");
  if (fromLd) return normaliseWhitespace(fromLd);

  const fromTitle = $("title").first().text();
  if (fromTitle.trim().length > 0) {
    return trimTitleSuffix(normaliseWhitespace(fromTitle));
  }

  return null;
}

function extractImage(
  $: CheerioAPI,
  lds: Record<string, unknown>[],
  pageUrl: string
): string | null {
  const candidate =
    metaContent($, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) ??
    jsonLdImage(lds) ??
    $("article img[src], figure img[src]").first().attr("src") ??
    null;

  if (!candidate) return null;

  return absolutise(candidate, pageUrl);
}

function extractPublishedAt(
  $: CheerioAPI,
  lds: Record<string, unknown>[]
): string | null {
  const candidate =
    metaContent($, [
      "article:published_time",
      "article:published",
      "datePublished",
      "date",
      "pubdate",
      "publish-date",
      "og:published_time",
      "DC.date.issued",
    ]) ??
    jsonLdString(lds, "datePublished") ??
    $("time[datetime]").first().attr("datetime") ??
    null;

  if (!candidate) return null;

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function extractCanonical($: CheerioAPI, pageUrl: string): string | null {
  const candidate =
    $('link[rel="canonical"]').attr("href") ??
    metaContent($, ["og:url"]) ??
    null;

  if (!candidate) return null;

  const absolute = absolutise(candidate, pageUrl);

  return absolute ? normaliseUrl(absolute) : null;
}

/**
 * The article body, cleaned.
 *
 * JSON-LD `articleBody` is preferred when a publisher provides it - it is the
 * prose without any page furniture. Otherwise the first body container that
 * yields paragraphs wins.
 */
function extractParagraphs(
  $: CheerioAPI,
  lds: Record<string, unknown>[]
): string[] {
  const articleBody = jsonLdString(lds, "articleBody");

  if (articleBody) {
    const blocks = articleBody
      .split(/\n{2,}|\r\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    const cleaned = cleanParagraphs(
      blocks.length > 1 ? blocks : splitLongParagraph(articleBody)
    );

    if (cleaned.length > 0) return cleaned;
  }

  let best: string[] = [];
  let bestLength = 0;

  for (const selector of BODY_SELECTORS) {
    const containers = $(selector);
    if (containers.length === 0) continue;

    // Every match, not just the first: BBC splits an article into ~25 separate
    // `[data-component="text-block"]` elements of one paragraph each, so
    // taking only the first would see a single line and reject the story.
    const raw: string[] = [];

    containers.each((_, element) => {
      const container = $(element);
      cleanBodyElement($, container);

      container.find(PARAGRAPH_SELECTOR).each((_, node) => {
        raw.push($(node).text());
      });
    });

    let cleaned = cleanParagraphs(raw);

    // One large block is a DOM quirk, not grounds for rejection (section 13).
    if (cleaned.length === 1) {
      cleaned = cleanParagraphs(splitLongParagraph(cleaned[0]));
    }

    // Keep the richest body rather than the first non-empty one: a narrow
    // wrapper can match before the element that actually holds the prose.
    const length = cleaned.reduce((total, part) => total + part.length, 0);

    if (length > bestLength) {
      best = cleaned;
      bestLength = length;
    }
  }

  return best;
}

/** Extracts every stored field from one article detail page. */
export function extractArticle(html: string, pageUrl: string): ExtractedArticle {
  const $ = cheerio.load(html);
  const lds = jsonLdObjects($);

  return {
    title: extractTitle($, lds),
    imageUrl: extractImage($, lds, pageUrl),
    publishedAt: extractPublishedAt($, lds),
    canonicalUrl: extractCanonical($, pageUrl),
    paragraphs: extractParagraphs($, lds),
  };
}
