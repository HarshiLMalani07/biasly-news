import { segmentsOf } from "@/lib/parsing/urls";

/**
 * The non-article reject list (AGENTS.md section 9).
 *
 * This is the single home of that list. Other modules call `matchRejectRule`
 * instead of repeating it, and AGENTS.md section 9 says: "When this list
 * changes, update it here only."
 *
 * Matching is on whole path *segments*, never substrings, so a story slug that
 * happens to contain "support" or "live" is not thrown away.
 */

/** The reject rules, named so a rejection can be logged and counted. */
export type RejectRule =
  | "category_or_section"
  | "topic_or_tag"
  | "author_page"
  | "search_page"
  | "show_or_podcast"
  | "live_page"
  | "game_page"
  | "product_or_shopping"
  | "corporate_or_support"
  | "newsletter_or_subscription"
  | "video_or_gallery_only"
  | "not_a_page";

const RULES: readonly { rule: RejectRule; segments: readonly string[] }[] = [
  {
    rule: "category_or_section",
    segments: ["category", "categories", "section", "sections", "channel"],
  },
  {
    rule: "topic_or_tag",
    segments: ["topic", "topics", "tag", "tags", "subject", "series"],
  },
  {
    rule: "author_page",
    segments: ["author", "authors", "people", "person", "profile", "staff", "contributor"],
  },
  { rule: "search_page", segments: ["search", "find"] },
  {
    rule: "show_or_podcast",
    segments: ["show", "shows", "program", "programs", "programme", "programmes", "podcast", "podcasts", "episodes"],
  },
  { rule: "live_page", segments: ["live", "liveblog", "live-news", "live-blog"] },
  {
    rule: "game_page",
    segments: ["game", "games", "puzzles", "crossword", "crosswords", "quiz", "quizzes"],
  },
  {
    rule: "product_or_shopping",
    segments: ["shop", "shopping", "store", "product", "products", "deals", "reviews", "buying-guides", "coupons"],
  },
  {
    rule: "corporate_or_support",
    segments: [
      "about", "about-us", "careers", "jobs", "contact", "contact-us", "support",
      "help", "legal", "privacy", "privacy-policy", "terms", "terms-of-use",
      "corporate", "advertise", "press", "accessibility", "sitemap", "feedback",
      "ethics", "standards", "usingthebbc", "info",
    ],
  },
  {
    rule: "newsletter_or_subscription",
    segments: [
      "newsletter", "newsletters", "subscribe", "subscription", "subscriptions",
      "account", "accounts", "signin", "sign-in", "login", "log-in", "register",
      "membership", "donate", "give", "pledge",
    ],
  },
  {
    rule: "video_or_gallery_only",
    segments: ["video", "videos", "watch", "gallery", "galleries", "pictures", "photos", "audio", "listen", "radio"],
  },
];

/** Extensions that are assets or feeds, not article pages. */
const NON_PAGE_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp3", ".mp4",
  ".xml", ".rss", ".json", ".zip", ".ico", ".css", ".js",
] as const;

/**
 * The rule a path violates, or null when it survives the reject list.
 *
 * A path with no segments at all is a homepage, which AGENTS.md section 9 also
 * forbids storing as an article.
 */
export function matchRejectRule(pathname: string): RejectRule | null {
  const lower = pathname.toLowerCase();

  if (NON_PAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return "not_a_page";
  }

  const segments = segmentsOf(lower);

  if (segments.length === 0) return "category_or_section";

  for (const { rule, segments: rejected } of RULES) {
    if (segments.some((segment) => rejected.includes(segment))) return rule;
  }

  return null;
}
