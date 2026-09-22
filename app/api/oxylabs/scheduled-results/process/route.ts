import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminSecret } from "@/lib/api/admin";
import { runScheduledProcessing } from "@/lib/pipeline/scheduler";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  DEFAULT_ARTICLES_PER_SOURCE,
  MAX_ARTICLES_PER_SOURCE,
} from "@/lib/scraping/limits";

/**
 * POST /api/oxylabs/scheduled-results/process - on-demand processing of
 * completed Oxylabs jobs (AGENTS.md sections 14 and 18).
 *
 * The manual counterpart to the hourly `GET /api/cron/pipeline`. It starts
 * work, so section 15's admin secret applies.
 *
 * A thin handler (section 5): guard, parse, delegate, respond. The Oxylabs
 * calls and the scrape-to-insert pipeline live in `lib/pipeline/scheduler.ts`
 * and `lib/pipeline/source-run.ts`.
 */

/**
 * A pass over five schedules is up to 5 result fetches plus ~75 detail
 * requests. Local `next dev` is unbounded; Vercel's Hobby plan caps function
 * duration well below this.
 */
export const maxDuration = 300;

const ProcessRequest = z.object({
  perSource: z.number().int().min(1).max(MAX_ARTICLES_PER_SOURCE).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  const posthog = getPostHogClient();
  const distinctId =
    request.headers.get("x-posthog-distinct-id") ?? "admin_api";
  const sessionId = request.headers.get("x-posthog-session-id");

  // An empty body is valid and means "every active schedule, default depth".
  let raw: unknown = {};

  try {
    const text = await request.text();
    if (text.trim().length > 0) raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProcessRequest.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const summary = await runScheduledProcessing({
      perSource: parsed.data.perSource ?? DEFAULT_ARTICLES_PER_SOURCE,
    });

    posthog?.capture({
      distinctId,
      event: "scheduled_processing_completed",
      properties: {
        status: summary.status,
        schedules_checked: summary.schedulesChecked,
        jobs_processed: summary.jobsProcessed,
        articles_inserted: summary.articlesInserted,
        articles_rejected: summary.articlesRejected,
        duplicates_skipped: summary.duplicatesSkipped,
        duration_ms: summary.durationMs,
        ...(sessionId ? { $session_id: sessionId } : {}),
      },
    });
    await posthog?.flush();

    return NextResponse.json(summary, {
      status: summary.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    posthog?.captureException(error, distinctId, {
      endpoint: "oxylabs/scheduled-results/process",
      ...(sessionId ? { $session_id: sessionId } : {}),
    });
    await posthog?.flush();

    // Details go to the server console; the caller gets a generic message so
    // no credential or stack trace leaves the server (section 21).
    console.error("POST /api/oxylabs/scheduled-results/process failed:", error);

    return NextResponse.json(
      { error: "Scheduled processing failed." },
      { status: 500 }
    );
  }
}
