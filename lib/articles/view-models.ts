import type { BiasPercentages } from "@/lib/bias";

/**
 * The shapes the UI renders. Every field is either stored in Supabase or
 * derived from stored text - nothing here is invented.
 *
 * The optional fields have no column behind them yet (AGENTS.md section 7
 * stores one source per article and no category, country or byline). They are
 * typed optional rather than filled with placeholder values, and the components
 * render them only when present.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";

/** Mirrors `article_analyses.bias_label` (AGENTS.md section 19). */
export type FramingLabel = "left" | "center" | "right" | "mixed" | "unclear";

/** One card in the home feed. */
export type FeedArticle = {
  /** The article uuid, and the `/news/[id]` segment. */
  id: string;
  title: string;
  sourceName: string;
  /** Short form, e.g. "Jun 1". */
  publishedLabel: string;
  /** Machine readable, for `<time dateTime>`. */
  publishedIso: string;
  imageUrl: string;
  imageAlt: string;
  /** left + center + right always totals 100. */
  bias: BiasPercentages;
  sentimentLabel: SentimentLabel;
  framingLabel: FramingLabel;
  /** 0 to 1. */
  confidence: number;
  /** Not stored yet. */
  category?: string | null;
  /** Not stored yet. */
  country?: string | null;
  /** Not stored yet: biasly stores one source per article, not a roster. */
  sourceCount?: number | null;
};

/** The news details page. */
export type ArticleDetail = Omit<FeedArticle, "publishedLabel"> & {
  /** Long form, e.g. "May 31, 2026". */
  publishedLabel: string;
  /** Derived from the stored word count. */
  readTimeLabel: string;
  /** `articles.raw_text`, split into paragraphs. */
  paragraphs: readonly string[];
  /** `(right − left) / 100`, per AGENTS.md section 7. */
  biasScore: number;
  /** −1 to 1. */
  sentimentScore: number;
  /** `article_analyses.summary`, split into the bullets the sidebar renders. */
  summaryBullets: readonly string[];
  summaryGeneratedLabel: string;
  summaryReadTimeLabel: string;
  framingNotes: string | null;
  loadedTerms: readonly string[];
  disclaimer: string | null;
  model: string;
  /** Not stored yet. */
  authorName?: string | null;
  /** Not stored yet. */
  heroCaption?: string | null;
  /** Not stored yet. */
  heroCredit?: string | null;
};

/** The fields a related-story item needs. pgvector supplies these later. */
export type RelatedArticle = Pick<
  ArticleDetail,
  | "id"
  | "title"
  | "imageUrl"
  | "imageAlt"
  | "publishedLabel"
  | "readTimeLabel"
  | "category"
  | "country"
>;
