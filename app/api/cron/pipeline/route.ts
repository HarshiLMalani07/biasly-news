import { NextResponse, type NextRequest } from "next/server";

import { requireCronSecret } from "@/lib/api/cron";
import { runCronPipeline } from "@/lib/pipeline/cron";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * GET /api/cron/pipeline - the automatic hourly pipeline (AGENTS.md section 18).
 *
 * Internal only. This route is not callable by browsers or users: it is
 * protected by `CRON_SECRET`, which Vercel injects and sends as
 * `Authorization: Bearer <value>` on every cron invocation. It is deliberately
 * *not* protected by `BIASLY_ADMIN_SECRET`, and `CRON_SECRET` is never added to
 * `.env.local` - in local development the check is skipped so the route can be
 * tested by hand.
 *
 * `GET` is section 14's one documented exception to "actions use POST", because
 * Vercel Cron always issues GET requests.
 *
 * A thin handler (section 5): guard, delegate, respond. Both pipeline steps
 * live in `lib/pipeline/cron.ts`.
 */

/**
 * Both steps run in this one invocation. Locally `next dev` is unbounded;
 * deployed, this is the ceiling the plan allows.
 */
export const maxDuration = 300;

/**
 * Never serve this from a cache. A cached cron response would look like a
 * successful run that never happened, and Vercel does not log cached
 * invocations.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const posthog = getPostHogClient();

  try {
    const summary = await runCronPipeline();

    posthog?.capture({
      distinctId: "vercel_cron",
      event: "cron_pipeline_completed",
      properties: {
        status: summary.status,
        articles_inserted: summary.processing?.articlesInserted ?? 0,
        jobs_processed: summary.processing?.jobsProcessed ?? 0,
        analyzed: summary.analysis?.analyzed ?? 0,
        processing_failed: summary.processingError !== null,
        analysis_failed: summary.analysisError !== null,
        duration_ms: summary.durationMs,
      },
    });
    await posthog?.flush();

    return NextResponse.json(summary, {
      status: summary.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    posthog?.captureException(error, "vercel_cron", {
      endpoint: "cron/pipeline",
    });
    await posthog?.flush();

    // Details go to the server console; the caller gets a generic message so
    // no credential or stack trace leaves the server (section 21).
    console.error("GET /api/cron/pipeline failed:", error);

    return NextResponse.json(
      { error: "Cron pipeline failed." },
      { status: 500 }
    );
  }
}
