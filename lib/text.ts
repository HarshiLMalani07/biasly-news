/**
 * Text and date helpers shared by the Supabase mappers. Pure functions, no
 * dependencies: everything here is derived from stored text.
 */

const WORDS_PER_MINUTE = 200;

/**
 * Splits stored article text into paragraphs. Prefers blank-line breaks and
 * falls back to single newlines, so text that survived cleanup as one block
 * still renders as more than a wall.
 */
export function toParagraphs(text: string): string[] {
  const byBlankLine = splitAndTrim(text, /\n\s*\n/);
  if (byBlankLine.length > 1) return byBlankLine;

  const byNewline = splitAndTrim(text, /\n/);
  if (byNewline.length > 1) return byNewline;

  return byBlankLine;
}

/**
 * Splits a stored summary into the bullets the AI Summary card renders:
 * blank-line breaks first, then newlines, then sentence boundaries.
 */
export function toBullets(summary: string): string[] {
  const byBlankLine = splitAndTrim(summary, /\n\s*\n/);
  if (byBlankLine.length > 1) return byBlankLine;

  const byNewline = splitAndTrim(summary, /\n/);
  if (byNewline.length > 1) return byNewline;

  const bySentence = splitAndTrim(summary, /(?<=[.!?])\s+(?=[A-Z“"'])/);
  if (bySentence.length > 1) return bySentence;

  return byBlankLine;
}

/** "4 min read", at 200 words per minute and never less than one minute. */
export function readTimeLabel(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));

  return `${minutes} min read`;
}

/**
 * Dates are formatted in UTC on purpose: the server and the browser must agree
 * on the string or React reports a hydration mismatch.
 */
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Jun 1". Returns an empty string for an unparseable timestamp. */
export function shortDateLabel(iso: string): string {
  return formatDate(iso, SHORT_DATE);
}

/** "June 1, 2026". Returns an empty string for an unparseable timestamp. */
export function longDateLabel(iso: string): string {
  return formatDate(iso, LONG_DATE);
}

function formatDate(iso: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return formatter.format(date);
}

function splitAndTrim(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
