import type { BiasPercentages } from "@/lib/bias";
import {
  topNewsArticles,
  type FramingLabel,
  type HomeArticle,
  type SentimentLabel,
} from "@/lib/demo/top-news";

/** How a single outlet in the Source Breakdown card leans. */
export type SourceBias = "left" | "center" | "right";

/**
 * The shape the news details page reads. Field for field this is the `articles`
 * row joined to its `article_analyses` row (AGENTS.md sections 7 and 19), so
 * replacing the fixtures below with a Supabase query is a change to
 * `getArticleDetail` alone.
 */
export type ArticleDetail = {
  /** Stable slug; the `/news/[id]` segment. */
  id: string;
  title: string;
  category: string;
  country: string;
  sourceName: string;
  authorName: string;
  /** Long form, e.g. "May 31, 2026". */
  publishedLabel: string;
  /** Machine readable, for `<time dateTime>`. */
  publishedIso: string;
  readTimeLabel: string;
  imageUrl: string;
  imageAlt: string;
  heroCaption: string;
  heroCredit: string;
  /** `articles.raw_text`, already split into paragraphs. */
  paragraphs: readonly string[];
  /** How many outlets covered the story. */
  sourceCount: number;
  /** left + center + right always totals 100. */
  bias: BiasPercentages;
  /** `(right − left) / 100`, per AGENTS.md section 7. */
  biasScore: number;
  framingLabel: FramingLabel;
  sentimentLabel: SentimentLabel;
  /** −1 to 1. */
  sentimentScore: number;
  /** 0 to 1. */
  confidence: number;
  /** `article_analyses.summary`, as the bullets the sidebar renders. */
  summaryBullets: readonly string[];
  summaryGeneratedLabel: string;
  summaryReadTimeLabel: string;
  framingNotes: string;
  loadedTerms: readonly string[];
  disclaimer: string;
  model: string;
  /**
   * Demo-only. AGENTS.md section 7 stores one source per article, not a
   * per-story outlet roster, so nothing here is backed by the schema yet.
   */
  demoSourceBreakdown: {
    counts: { left: number; center: number; right: number };
    topSources: readonly { name: string; bias: SourceBias }[];
  };
};

/** The fields a related-story item needs. pgvector returns this shape later. */
export type RelatedArticle = Pick<
  ArticleDetail,
  | "id"
  | "title"
  | "category"
  | "country"
  | "imageUrl"
  | "imageAlt"
  | "publishedLabel"
  | "readTimeLabel"
>;

const MONTHS: Record<string, { number: string; long: string }> = {
  Jan: { number: "01", long: "January" },
  Feb: { number: "02", long: "February" },
  Mar: { number: "03", long: "March" },
  Apr: { number: "04", long: "April" },
  May: { number: "05", long: "May" },
  Jun: { number: "06", long: "June" },
  Jul: { number: "07", long: "July" },
  Aug: { number: "08", long: "August" },
  Sep: { number: "09", long: "September" },
  Oct: { number: "10", long: "October" },
  Nov: { number: "11", long: "November" },
  Dec: { number: "12", long: "December" },
};

/** The home fixtures carry short labels ("May 31"); the details page wants both forms. */
function splitPublishedLabel(publishedLabel: string): {
  iso: string;
  long: string;
} {
  const [month, day] = publishedLabel.split(" ");
  const entry = MONTHS[month] ?? MONTHS.Jan;
  const dayNumber = day ?? "1";

  return {
    iso: `2026-${entry.number}-${dayNumber.padStart(2, "0")}`,
    long: `${entry.long} ${dayNumber}, 2026`,
  };
}

const AUTHORS = [
  "David Morgan",
  "Priya Raman",
  "Lena Ortiz",
  "Tom Whitfield",
  "Amara Singh",
  "Jonas Keller",
] as const;

/** Deterministic so a given article always shows the same byline. */
function pickAuthor(id: string): string {
  let sum = 0;
  for (const character of id) {
    sum += character.charCodeAt(0);
  }
  return AUTHORS[sum % AUTHORS.length];
}

const SENTIMENT_SCORES: Record<SentimentLabel, number> = {
  positive: 0.46,
  neutral: 0.05,
  negative: -0.42,
};

const LOADED_TERMS: Record<FramingLabel, readonly string[]> = {
  left: ["crackdown", "far-right", "so-called reform"],
  right: ["radical", "open borders", "out-of-touch elites"],
  center: ["sources say", "reportedly", "it remains unclear"],
  mixed: ["controversial", "slammed", "doubled down"],
  unclear: ["sources say", "widely criticised", "insiders claim"],
};

const FRAMING_NOTES =
  "Our analysis is based on the political leaning of the publication and how the story is framed. Sources are weighted by reliability and recency.";

const DISCLAIMER = "AI summaries can make mistakes.";

const MODEL = "gpt-5-mini";

const SOURCE_POOL: Record<SourceBias, readonly string[]> = {
  left: ["CNN", "MSNBC", "The Guardian", "Vox", "HuffPost"],
  center: [
    "Reuters",
    "The Wall Street Journal",
    "BBC",
    "The New York Times",
    "The Washington Post",
    "AP News",
    "Bloomberg",
    "NPR",
  ],
  right: [
    "Fox News",
    "Newsmax",
    "New York Post",
    "The Washington Times",
    "National Review",
  ],
};

/**
 * Splits `total` outlets across the three sides in proportion to the framing
 * percentages, using largest-remainder rounding so the counts add back up to
 * `total` exactly.
 */
function distributeSources(
  total: number,
  bias: BiasPercentages
): { left: number; center: number; right: number } {
  const exact = [
    { key: "left" as const, value: (bias.left / 100) * total },
    { key: "center" as const, value: (bias.center / 100) * total },
    { key: "right" as const, value: (bias.right / 100) * total },
  ];

  const counts = { left: 0, center: 0, right: 0 };
  for (const part of exact) {
    counts[part.key] = Math.floor(part.value);
  }

  let remainder = total - (counts.left + counts.center + counts.right);
  const byRemainder = [...exact].sort((a, b) => (b.value % 1) - (a.value % 1));

  let index = 0;
  while (remainder > 0) {
    counts[byRemainder[index % byRemainder.length].key] += 1;
    remainder -= 1;
    index += 1;
  }

  return counts;
}

/** Up to eight named outlets, drawn from whichever side still has outlets left. */
function pickTopSources(counts: {
  left: number;
  center: number;
  right: number;
}): readonly { name: string; bias: SourceBias }[] {
  const remaining = { ...counts };
  const cursors = { left: 0, center: 0, right: 0 };
  const picked: { name: string; bias: SourceBias }[] = [];

  while (picked.length < 8) {
    const next = (["right", "center", "left"] as const)
      .filter(
        (side) => remaining[side] > 0 && cursors[side] < SOURCE_POOL[side].length
      )
      .sort((a, b) => remaining[b] - remaining[a])[0];

    if (!next) break;

    picked.push({ name: SOURCE_POOL[next][cursors[next]], bias: next });
    cursors[next] += 1;
    remaining[next] -= 1;
  }

  return picked;
}

function buildParagraphs(article: HomeArticle): readonly string[] {
  const { bias } = article;

  return [
    `${article.sourceName} reported this story from ${article.country}, and ${article.sourceCount} outlets have published their own version of it since.`,
    "Coverage has centred on what the development means for the people closest to it. Reporters describe a situation that is still moving, with officials releasing details in stages and independent confirmation lagging behind the first headlines.",
    `Outlets on the left account for ${bias.left}% of the coverage biasly sampled, centre outlets ${bias.center}%, and outlets on the right ${bias.right}%. The gap shows up less in the facts each story reports than in which detail each one leads with.`,
    "Analysts quoted across the coverage agree on the broad shape of events and disagree on what follows. Several describe the reaction so far as measured; others argue it has been slower than the moment demands.",
    `The ${article.category.toLowerCase()} angle has drawn the most follow-up reporting, and the explainers published within a day of the first report framed the question as one of precedent rather than of this week's particulars.`,
    "What happens next is unsettled. Further statements are expected, and biasly will update this page's analysis as additional sources publish.",
  ];
}

function buildSummaryBullets(article: HomeArticle): readonly string[] {
  const { bias } = article;

  return [
    `${article.sourceName} is one of ${article.sourceCount} outlets covering this ${article.category.toLowerCase()} story from ${article.country}.`,
    `Coverage splits ${bias.left}% left, ${bias.center}% centre and ${bias.right}% right, which reads as ${article.framingLabel} framing overall.`,
    `The reporting sampled is broadly ${article.sentimentLabel} in tone.`,
    `Confidence in this estimate is ${Math.round(article.confidence * 100)}%, so treat the split as indicative rather than settled.`,
  ];
}

function estimateReadTime(paragraphs: readonly string[]): string {
  const words = paragraphs.join(" ").split(/\s+/).length;
  return `${Math.max(3, Math.round(words / 200))} min read`;
}

/**
 * Composes a details fixture from a home-feed article, then applies the
 * overrides a hand-written article supplies.
 */
function buildDetail(
  article: HomeArticle,
  overrides: Partial<ArticleDetail> = {}
): ArticleDetail {
  const published = splitPublishedLabel(article.publishedLabel);
  const paragraphs = buildParagraphs(article);
  const counts = distributeSources(article.sourceCount, article.bias);

  const base: ArticleDetail = {
    id: article.id,
    title: article.title,
    category: article.category,
    country: article.country,
    sourceName: article.sourceName,
    authorName: pickAuthor(article.id),
    publishedLabel: published.long,
    publishedIso: published.iso,
    readTimeLabel: estimateReadTime(paragraphs),
    imageUrl: article.imageUrl,
    imageAlt: article.imageAlt,
    heroCaption: `${article.imageAlt}.`,
    heroCredit: "Photo: Unsplash",
    paragraphs,
    sourceCount: article.sourceCount,
    bias: article.bias,
    biasScore: (article.bias.right - article.bias.left) / 100,
    framingLabel: article.framingLabel,
    sentimentLabel: article.sentimentLabel,
    sentimentScore: SENTIMENT_SCORES[article.sentimentLabel],
    confidence: article.confidence,
    summaryBullets: buildSummaryBullets(article),
    summaryGeneratedLabel: published.long,
    summaryReadTimeLabel: "2 min read",
    framingNotes: FRAMING_NOTES,
    loadedTerms: LOADED_TERMS[article.framingLabel],
    disclaimer: DISCLAIMER,
    model: MODEL,
    demoSourceBreakdown: { counts, topSources: pickTopSources(counts) },
  };

  return { ...base, ...overrides };
}

const FEATURED_ID = "trump-iran-revised-peace-proposal";

/** The one article whose copy is written out in full, matching the design mock. */
const featuredOverrides: Partial<ArticleDetail> = {
  authorName: "David Morgan",
  // The details mock dates this story a day earlier than the home feed card
  // does; the details mock wins on its own page.
  publishedLabel: "May 31, 2026",
  publishedIso: "2026-05-31",
  summaryGeneratedLabel: "May 31, 2026",
  readTimeLabel: "12 min read",
  heroCaption:
    "President Donald Trump in the Cabinet Room at the White House, Washington, D.C., May 30, 2026.",
  heroCredit: "Photo: Andrew Harnik/Getty Images",
  paragraphs: [
    "The Trump administration has sent Iran a revised nuclear deal proposal that includes tougher terms on uranium enrichment and stronger verification measures, according to a report published Saturday.",
    "The new proposal, delivered through intermediaries in Oman, requires Iran to halt all uranium enrichment on its soil and ship its stockpile of enriched uranium out of the country. It also demands unrestricted access for international inspectors to all Iranian nuclear facilities, including military sites.",
    "“This is a take-it-or-leave-it proposal,” a senior administration official told the Wall Street Journal. “The President wants a deal, but he will not accept a weak agreement that puts America or our allies at risk.”",
    "Iran has not yet officially responded to the proposal. However, Iranian Foreign Minister Hossein Amir-Abdollahian said last week that any deal must respect Iran’s right to peaceful nuclear energy and include the lifting of all U.S. sanctions.",
    "The revised proposal comes after several rounds of indirect talks between U.S. and Iranian officials failed to produce a breakthrough. The Trump administration has warned that if diplomacy fails, it is prepared to take other action to prevent Iran from obtaining a nuclear weapon.",
    "European allies have urged both sides to continue negotiations. “We believe diplomacy is still the best path forward,” said a spokesperson for the EU’s foreign policy chief.",
    "Israel, which has long opposed the 2015 nuclear deal with Iran, praised the Trump administration’s tougher stance. “This is the kind of leadership that was missing in the past,” said Israeli Prime Minister Benjamin Netanyahu in a statement.",
    "The fate of the proposal now rests with Iran, as global attention remains focused on whether a new nuclear agreement can be reached—or if tensions will escalate further.",
  ],
  summaryBullets: [
    "The Trump administration has sent Iran a revised nuclear deal proposal with tougher terms, including a complete halt to uranium enrichment and the removal of enriched uranium stockpiles.",
    "The proposal also demands unrestricted inspector access to all nuclear sites, including military facilities.",
    "Iran has not responded officially but says any deal must respect its right to peaceful nuclear energy and include sanctions relief.",
    "The U.S. warns it is prepared to take other action if diplomacy fails, while European allies urge continued negotiations.",
    "Israel supports the tougher stance, praising the administration’s determination to prevent Iran from acquiring nuclear weapons.",
  ],
  summaryReadTimeLabel: "3 min read",
  loadedTerms: [
    "take-it-or-leave-it",
    "tougher terms",
    "weak agreement",
    "unrestricted access",
  ],
  demoSourceBreakdown: {
    counts: { left: 2, center: 4, right: 6 },
    topSources: [
      { name: "Fox News", bias: "right" },
      { name: "The Wall Street Journal", bias: "center" },
      { name: "Reuters", bias: "center" },
      { name: "BBC", bias: "center" },
      { name: "CNN", bias: "left" },
      { name: "The New York Times", bias: "center" },
      { name: "The Washington Post", bias: "center" },
      { name: "Newsmax", bias: "right" },
    ],
  },
};

const overridesById: Record<string, Partial<ArticleDetail>> = {
  [FEATURED_ID]: featuredOverrides,
};

/**
 * Demo data only. No article here is real reporting, the framing splits are
 * illustrative rather than AI-estimated, and the outlet rosters are invented.
 * The Supabase read layer replaces this module wholesale.
 */
const articleDetails: Record<string, ArticleDetail> = Object.fromEntries(
  topNewsArticles.map((article) => [
    article.id,
    buildDetail(article, overridesById[article.id]),
  ])
);

export function getArticleDetailIds(): readonly string[] {
  return topNewsArticles.map((article) => article.id);
}

export function getArticleDetail(id: string): ArticleDetail | undefined {
  return articleDetails[id];
}

/**
 * Demo stand-in for AGENTS.md section 20: the real implementation orders
 * `article_analyses` by cosine distance (`<=>`) to this article's embedding.
 */
export function getRelatedArticles(
  id: string,
  limit = 6
): readonly RelatedArticle[] {
  return topNewsArticles
    .filter((article) => article.id !== id)
    .slice(0, limit)
    .map((article) => {
      const detail = articleDetails[article.id];
      return {
        id: detail.id,
        title: detail.title,
        category: detail.category,
        country: detail.country,
        imageUrl: detail.imageUrl,
        imageAlt: detail.imageAlt,
        publishedLabel: detail.publishedLabel,
        readTimeLabel: detail.readTimeLabel,
      };
    });
}
