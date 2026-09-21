import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminSecret } from "@/lib/api/admin";
import { runScrape } from "@/lib/pipeline/scrape";
import {
  DEFAULT_ARTICLES_PER_SOURCE,
  MAX_ARTICLES_PER_SOURCE,
} from "@/lib/scraping/limits";

/**
 * POST /api/scrape - manual scraping (AGENTS.md sections 14 and 16).
 *
 * A thin handler (section 5): guard, parse, delegate, respond. All scraping,
 * parsing and database logic lives in `lib/pipeline/scrape.ts`.
 *
 * There is no GET export on purpose - Next.js answers a GET with 405, and
 * section 14 forbids switching scraping between GET and POST.
 */

/**
 * A full 5-source run is up to 5 homepage plus ~75 detail requests. Local
 * `next dev` is unbounded; Vercel's Hobby plan caps function duration well
 * below this, so a deployed full run should use a smaller `perSource`.
 */
export const maxDuration = 300;

const ScrapeRequest = z.object({
  /** Active source names, as stored in Supabase. Never URLs (section 8). */
  sources: z.array(z.string().min(1)).min(1).optional(),
  perSource: z
    .number()
    .int()
    .min(1)
    .max(MAX_ARTICLES_PER_SOURCE)
    .optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  // An empty body is valid and means "every active source, default depth".
  let raw: unknown = {};

  try {
    const text = await request.text();
    if (text.trim().length > 0) raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ScrapeRequest.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const summary = await runScrape({
      sourceNames: parsed.data.sources,
      perSource: parsed.data.perSource ?? DEFAULT_ARTICLES_PER_SOURCE,
    });

    return NextResponse.json(summary, {
      status: summary.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    // Details go to the server console; the caller gets a generic message so
    // no credential or stack trace leaves the server (section 21).
    console.error("POST /api/scrape failed:", error);

    return NextResponse.json({ error: "Scrape failed." }, { status: 500 });
  }
}
