import type {
  ArticleDetail,
  FeedArticle,
  FramingLabel,
  RelatedArticle,
  SentimentLabel,
} from "@/lib/articles/view-models";
import { normalizeBiasPercentages } from "@/lib/bias";
import { deriveBiasScore } from "@/lib/supabase/queries/analyses";
import type { ArticleWithAnalysis } from "@/lib/supabase/queries/articles";
import {
  longDateLabel,
  readTimeLabel,
  shortDateLabel,
  toBullets,
  toParagraphs,
} from "@/lib/text";

/**
 * Supabase rows to the view models the UI renders.
 *
 * Labels are narrowed rather than cast: a value the database somehow holds
 * outside the allowed set degrades to a neutral default instead of crashing
 * the page.
 */

const SENTIMENT_LABELS: readonly SentimentLabel[] = [
  "positive",
  "neutral",
  "negative",
];

const FRAMING_LABELS: readonly FramingLabel[] = [
  "left",
  "center",
  "right",
  "mixed",
  "unclear",
];

function toSentimentLabel(value: string): SentimentLabel {
  return SENTIMENT_LABELS.find((label) => label === value) ?? "neutral";
}

function toFramingLabel(value: string): FramingLabel {
  return FRAMING_LABELS.find((label) => label === value) ?? "unclear";
}

/** Rows reaching a mapper always carry an analysis; the queries drop the rest. */
function requireAnalysis(row: ArticleWithAnalysis) {
  const analysis = row.article_analyses;

  if (!analysis) {
    throw new Error(`Article ${row.id} has no analysis to map`);
  }

  return analysis;
}

export function toFeedArticle(row: ArticleWithAnalysis): FeedArticle {
  const analysis = requireAnalysis(row);

  return {
    id: row.id,
    title: row.title,
    sourceName: row.sources?.name ?? "Unknown source",
    publishedLabel: shortDateLabel(row.published_at),
    publishedIso: row.published_at,
    imageUrl: row.image_url,
    // No alt text is stored, and the headline describes the photograph's
    // subject better than an invented description would.
    imageAlt: row.title,
    bias: normalizeBiasPercentages({
      left: analysis.left_percentage,
      center: analysis.center_percentage,
      right: analysis.right_percentage,
    }),
    sentimentLabel: toSentimentLabel(analysis.sentiment_label),
    framingLabel: toFramingLabel(analysis.bias_label),
    confidence: analysis.confidence,
    category: null,
    country: null,
    sourceCount: null,
  };
}

export function toArticleDetail(row: ArticleWithAnalysis): ArticleDetail {
  const analysis = requireAnalysis(row);
  const feed = toFeedArticle(row);

  return {
    ...feed,
    publishedLabel: longDateLabel(row.published_at),
    readTimeLabel: readTimeLabel(row.raw_text),
    paragraphs: toParagraphs(row.raw_text),
    // Stored value wins; the formula is the fallback for a row written before
    // the column was populated.
    biasScore: Number.isFinite(analysis.bias_score)
      ? analysis.bias_score
      : deriveBiasScore(analysis.left_percentage, analysis.right_percentage),
    sentimentScore: analysis.sentiment_score,
    summaryBullets: toBullets(analysis.summary),
    summaryGeneratedLabel: longDateLabel(analysis.created_at),
    summaryReadTimeLabel: readTimeLabel(analysis.summary),
    framingNotes: analysis.framing_notes,
    loadedTerms: analysis.loaded_terms,
    disclaimer: analysis.disclaimer,
    model: analysis.model,
    authorName: null,
    heroCaption: null,
    heroCredit: null,
  };
}

export function toRelatedArticle(row: ArticleWithAnalysis): RelatedArticle {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    imageAlt: row.title,
    publishedLabel: shortDateLabel(row.published_at),
    readTimeLabel: readTimeLabel(row.raw_text),
    category: null,
    country: null,
  };
}
