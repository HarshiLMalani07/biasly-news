import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  MAX_ANALYSIS_ARTICLES,
  MAX_ANALYSIS_BATCH_SIZE,
} from "@/lib/ai/limits";
import { requireAdminSecret } from "@/lib/api/admin";
import { runAnalysis } from "@/lib/pipeline/analyze";

/**
 * POST /api/analyze - AI article analysis (AGENTS.md sections 14 and 19).
 *
 * A thin handler (section 5): guard, parse, delegate, respond. All model calls,
 * validation and database work live in `lib/ai/*` and `lib/pipeline/analyze.ts`.
 *
 * There is no GET export on purpose - Next.js answers a GET with 405, and
 * section 14 forbids switching AI analysis between GET and POST.
 */

/**
 * Batches keep one request bounded, but a full first run is ~100 articles and
 * will outlast this on Vercel's Hobby plan. Locally `next dev` is unbounded;
 * deployed, split a large backlog with `limit`.
 */
export const maxDuration = 300;

const AnalyzeRequest = z.object({
  /** Analyse only these articles. Absent means every pending article. */
  articleIds: z.array(z.uuid()).min(1).optional(),
  limit: z.number().int().min(1).max(MAX_ANALYSIS_ARTICLES).optional(),
  batchSize: z.number().int().min(1).max(MAX_ANALYSIS_BATCH_SIZE).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  // An empty body is valid and means "every pending article" (section 19).
  let raw: unknown = {};

  try {
    const text = await request.text();
    if (text.trim().length > 0) raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = AnalyzeRequest.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const summary = await runAnalysis(parsed.data);

    return NextResponse.json(summary, {
      status: summary.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    // Details go to the server console; the caller gets a generic message so
    // no credential or stack trace leaves the server (section 21).
    console.error("POST /api/analyze failed:", error);

    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
