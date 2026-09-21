"use server";

import { getHomeFeed, type FeedPage } from "@/lib/articles/read";

/**
 * The "View more" data source.
 *
 * A Server Action rather than an API route: AGENTS.md section 14 fixes the API
 * surface, and this is a page read, not pipeline work. It only reads stored
 * articles - it never scrapes, analyses, or mutates anything (section 5).
 *
 * A Server Action is a public endpoint, so `page` is validated here rather
 * than trusted; `getHomeFeed` clamps it again.
 */
export async function loadFeedPage(page: number): Promise<FeedPage> {
  if (!Number.isInteger(page) || page < 1) {
    return { articles: [], page: 0, hasMore: false };
  }

  return getHomeFeed(page);
}
