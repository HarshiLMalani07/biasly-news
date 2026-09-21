import type { BiasPercentages } from "@/lib/bias";

export type SentimentLabel = "positive" | "neutral" | "negative";

/** Mirrors the `bias_label` values required by AGENTS.md section 19. */
export type FramingLabel = "left" | "center" | "right" | "mixed" | "unclear";

/**
 * The shape the home feed reads. Field for field this is the `articles` row
 * joined to its `article_analyses` row (AGENTS.md section 7), so replacing the
 * fixture below with a Supabase query is a one-line change at the call site.
 */
export type HomeArticle = {
  /** Stable slug; the React key today, the `/news/[id]` segment later. */
  id: string;
  title: string;
  category: string;
  country: string;
  sourceName: string;
  publishedLabel: string;
  imageUrl: string;
  imageAlt: string;
  /** How many outlets covered the story, as shown under the bias meter. */
  sourceCount: number;
  /** left + center + right always totals 100. */
  bias: BiasPercentages;
  sentimentLabel: SentimentLabel;
  framingLabel: FramingLabel;
  /** 0 to 1. */
  confidence: number;
};

const photo = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

/**
 * Demo data only. No article here is real reporting, and the framing splits are
 * illustrative rather than AI-estimated. The Supabase read layer replaces this
 * module wholesale.
 */
export const topNewsArticles: readonly HomeArticle[] = [
  {
    id: "trump-iran-revised-peace-proposal",
    title:
      "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
    category: "Politics",
    country: "United States",
    sourceName: "Reuters",
    publishedLabel: "Jun 1",
    imageUrl: photo("photo-1541872703-74c5e44368f9"),
    imageAlt:
      "A politician raises a hand while speaking at a desk, with aides seated behind him",
    sourceCount: 12,
    bias: { left: 20, center: 31, right: 49 },
    sentimentLabel: "negative",
    framingLabel: "right",
    confidence: 0.78,
  },
  {
    id: "grapes-superfood-health-evidence-review",
    title:
      "Researchers Make Case for Grapes as a ‘Superfood’ After Review of Health Evidence",
    category: "Health",
    country: "United States",
    sourceName: "NPR",
    publishedLabel: "Jun 1",
    imageUrl: photo("photo-1591189863430-ab87e120f312"),
    imageAlt:
      "Fresh vegetables, herbs and preserves laid out across a wooden kitchen table",
    sourceCount: 7,
    bias: { left: 18, center: 42, right: 40 },
    sentimentLabel: "positive",
    framingLabel: "mixed",
    confidence: 0.52,
  },
  {
    id: "cern-hint-physics-beyond-standard-model",
    title: "CERN Finds High-Significance Hint of Physics Beyond Standard Model",
    category: "Science",
    country: "Switzerland",
    sourceName: "BBC",
    publishedLabel: "Jun 1",
    imageUrl: photo("photo-1532187863486-abf9dbad1b69"),
    imageAlt:
      "A pink liquid being pipetted into a tray of laboratory sample vials",
    sourceCount: 8,
    bias: { left: 16, center: 62, right: 22 },
    sentimentLabel: "positive",
    framingLabel: "center",
    confidence: 0.85,
  },
  {
    id: "brooklyn-rivera-dies-nicaragua-detention",
    title:
      "Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention",
    category: "World",
    country: "Nicaragua",
    sourceName: "The Guardian",
    publishedLabel: "May 31",
    imageUrl: photo("photo-1495020689067-958852a7765e"),
    imageAlt: "A person sitting on a bench reading a broadsheet newspaper",
    sourceCount: 63,
    bias: { left: 54, center: 28, right: 18 },
    sentimentLabel: "negative",
    framingLabel: "left",
    confidence: 0.71,
  },
  {
    id: "un-security-council-emergency-meeting-lebanon",
    title:
      "UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon",
    category: "World",
    country: "Middle East",
    sourceName: "Reuters",
    publishedLabel: "May 31",
    imageUrl: photo("photo-1555848962-6e79363ec58f"),
    imageAlt: "An empty parliamentary debating chamber seen from the gallery",
    sourceCount: 15,
    bias: { left: 22, center: 35, right: 43 },
    sentimentLabel: "negative",
    framingLabel: "right",
    confidence: 0.64,
  },
  {
    id: "oil-prices-dip-opec-output-increase",
    title: "Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand",
    category: "Business",
    country: "Global",
    sourceName: "Bloomberg",
    publishedLabel: "May 31",
    imageUrl: photo("photo-1473341304170-971dccb5ac1e"),
    imageAlt:
      "Rows of electricity transmission pylons silhouetted against an orange sunset",
    sourceCount: 11,
    bias: { left: 25, center: 50, right: 25 },
    sentimentLabel: "neutral",
    framingLabel: "center",
    confidence: 0.81,
  },
  {
    id: "spacex-starship-test-flight-mars-milestone",
    title: "SpaceX Launches Starship Test Flight in Milestone for Mars Program",
    category: "Technology",
    country: "United States",
    sourceName: "The Verge",
    publishedLabel: "May 30",
    imageUrl: photo("photo-1517976487492-5750f3195933"),
    imageAlt:
      "A heavy-lift rocket lifting off from a coastal launch pad in a cloud of exhaust",
    sourceCount: 9,
    bias: { left: 12, center: 45, right: 43 },
    sentimentLabel: "positive",
    framingLabel: "mixed",
    confidence: 0.49,
  },
  {
    id: "apple-ai-features-iphone-ipad-mac",
    title: "Apple Unveils AI-Powered Features Across iPhone, iPad and Mac",
    category: "Business",
    country: "United States",
    sourceName: "CNBC",
    publishedLabel: "May 30",
    imageUrl: photo("photo-1580584126903-c17d41830450"),
    imageAlt: "Close-up of a red printed circuit board and its solder pads",
    sourceCount: 10,
    bias: { left: 15, center: 40, right: 45 },
    sentimentLabel: "positive",
    framingLabel: "mixed",
    confidence: 0.46,
  },
  {
    id: "2025-among-top-three-hottest-years",
    title:
      "2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says",
    category: "Climate",
    country: "Global",
    sourceName: "AP News",
    publishedLabel: "May 30",
    imageUrl: photo("photo-1506905925346-21bda4d32df4"),
    imageAlt:
      "Snow-capped mountain peaks rising above a valley filled with cloud at sunset",
    sourceCount: 14,
    bias: { left: 33, center: 34, right: 33 },
    sentimentLabel: "negative",
    framingLabel: "mixed",
    confidence: 0.38,
  },
  {
    id: "fed-holds-rates-steady-inflation-caution",
    title:
      "Fed Holds Rates Steady, Signals Caution on Inflation and Growth Outlook",
    category: "Economy",
    country: "United States",
    sourceName: "Reuters",
    publishedLabel: "May 29",
    imageUrl: photo("photo-1554224155-6726b3ff858f"),
    imageAlt:
      "Tax forms, a calculator and a pen spread across a white desk with a hand taking notes",
    sourceCount: 13,
    bias: { left: 30, center: 45, right: 25 },
    sentimentLabel: "neutral",
    framingLabel: "center",
    confidence: 0.76,
  },
  {
    id: "real-madrid-win-champions-league-comeback",
    title: "Real Madrid Win Champions League After Comeback Victory in Final",
    category: "Soccer",
    country: "Europe",
    sourceName: "BBC Sport",
    publishedLabel: "May 29",
    imageUrl: photo("photo-1431324155629-1a6deb1dec8d"),
    imageAlt:
      "A football match in progress on a floodlit pitch at night, seen from the stands",
    sourceCount: 26,
    bias: { left: 10, center: 20, right: 70 },
    sentimentLabel: "positive",
    framingLabel: "right",
    confidence: 0.42,
  },
  {
    id: "wildfires-evacuations-western-canada",
    title: "Wildfires Force Thousands to Evacuate Across Western Canada",
    category: "Environment",
    country: "Canada",
    sourceName: "CBC",
    publishedLabel: "May 29",
    imageUrl: photo("photo-1441974231531-c6227db76b6e"),
    imageAlt:
      "Sunlight filtering through the trunks of a dense conifer forest beside a path",
    sourceCount: 17,
    bias: { left: 27, center: 33, right: 40 },
    sentimentLabel: "negative",
    framingLabel: "right",
    confidence: 0.58,
  },
];
