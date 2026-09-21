import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import {
  MIN_PARAGRAPH_CHARACTERS,
  SENTENCES_PER_SPLIT_PARAGRAPH,
} from "@/lib/scraping/limits";

/**
 * `raw_text` cleanup (AGENTS.md section 13).
 *
 * "Saved article text should read like one article, not a copied webpage dump."
 * Two stages: strip non-article elements from the DOM before text extraction,
 * then filter what survives as text.
 */

/** Elements that never contain article prose. */
const STRUCTURAL_NOISE =
  "script, style, noscript, iframe, svg, form, figcaption, aside, nav, button, " +
  "template, video, audio";

/**
 * Class/id fragments that mark a block as page furniture. Matched
 * case-insensitively against `class` and `id`.
 */
const NOISE_PATTERNS = [
  "newsletter", "subscribe", "subscription", "signup", "sign-up", "paywall",
  "related", "more-on", "morefrom", "more-from", "most-read", "most-viewed",
  "read-more", "load-more", "recirculation", "recommend",
  "social", "share", "follow", "promo", "advert", "ad-slot", "ad-container",
  "ad-wrapper", "adsense", "sponsor",
  "author-bio", "byline-block", "tags", "topic-list", "comments", "disqus",
  "breadcrumb", "pagination", "caption", "copyright", "footer", "header",
] as const;

/** Phrases that mark a whole paragraph as boilerplate. */
const BOILERPLATE_PHRASES = [
  "sign up for", "sign up to", "subscribe to", "subscribe now", "newsletter",
  "advertisement", "follow us on", "follow us at", "read more", "load more",
  "most viewed", "most read", "all rights reserved", "copyright",
  "this article was originally published", "share this", "share on",
  "click here", "cookie", "privacy policy", "terms of service",
  "we use cookies", "enable javascript", "your browser",
  "support our journalism", "become a member", "donate to",
  "our standards:", "thomson reuters trust principles", "opens new tab",
] as const;

/**
 * Paragraphs that are a staff credit rather than prose. Matched as a prefix,
 * so a sentence that merely mentions reporting is kept.
 */
const CREDIT_PREFIXES = [
  "reporting by", "editing by", "additional reporting by", "writing by",
  "compiled by", "photographs by", "photography by", "produced by",
  "translated by", "with reporting from",
] as const;

/** Debris from inline styles and scripts that survived text extraction. */
const CODE_DEBRIS = [/\{[^}]*\}/, /function\s*\(/, /@media\b/, /var\s+\w+\s*=/];

const SENTENCE_END = /[.!?]["'”’]?$/;

/**
 * Removes non-article elements from a body container, in place.
 *
 * Called before text extraction so captions, newsletter blocks, related-content
 * rails, share bars and ad placeholders never become paragraphs.
 */
export function cleanBodyElement(
  $: CheerioAPI,
  container: Cheerio<Element>
): void {
  container.find(STRUCTURAL_NOISE).remove();

  container.find("[class], [id]").each((_, element) => {
    const node = $(element);
    const marker = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`
      .toLowerCase();

    if (NOISE_PATTERNS.some((pattern) => marker.includes(pattern))) {
      node.remove();
    }
  });
}

/** Collapses whitespace, non-breaking spaces and stray control characters. */
export function normaliseWhitespace(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filters extracted paragraphs down to article prose.
 *
 * Drops short fragments without sentence punctuation, boilerplate phrasings,
 * CSS/JS debris, and lines repeated verbatim (navigation labels that survived).
 * Source order is preserved.
 */
export function cleanParagraphs(rawParagraphs: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of rawParagraphs) {
    const text = normaliseWhitespace(raw);

    if (text.length === 0) continue;

    // Short lines are only prose when they end a sentence.
    if (text.length < MIN_PARAGRAPH_CHARACTERS && !SENTENCE_END.test(text)) {
      continue;
    }

    const lower = text.toLowerCase();

    if (BOILERPLATE_PHRASES.some((phrase) => lower.includes(phrase))) continue;
    if (CREDIT_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue;
    if (CODE_DEBRIS.some((pattern) => pattern.test(text))) continue;

    // A dense run of semicolons is a style attribute dump, not a sentence.
    const words = text.split(/\s+/).length;
    if ((text.match(/;/g)?.length ?? 0) > words / 4) continue;

    const key = lower;
    if (seen.has(key)) continue;
    seen.add(key);

    kept.push(text);
  }

  return kept;
}

/**
 * Splits one block of text into sentence-grouped paragraphs.
 *
 * AGENTS.md section 13: a page must not be rejected only because paragraph
 * extraction returned one paragraph. When a body arrives as a single block, it
 * is split here before validation rather than thrown away.
 */
export function splitLongParagraph(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=["'“‘]?[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length <= 1) return [text.trim()].filter(Boolean);

  const chunks: string[] = [];

  for (let i = 0; i < sentences.length; i += SENTENCES_PER_SPLIT_PARAGRAPH) {
    chunks.push(sentences.slice(i, i + SENTENCES_PER_SPLIT_PARAGRAPH).join(" "));
  }

  return chunks;
}
