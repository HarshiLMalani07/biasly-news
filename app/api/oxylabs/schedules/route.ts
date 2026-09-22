import { NextResponse, type NextRequest } from "next/server";

import { requireAdminSecret } from "@/lib/api/admin";
import { syncSchedules } from "@/lib/pipeline/scheduler";
import { getPostHogClient } from "@/lib/posthog-server";
import { getSchedules } from "@/lib/supabase/queries/schedules";

/**
 * The Oxylabs schedule routes (AGENTS.md sections 14 and 18).
 *
 * `POST` syncs schedules - it creates work on Oxylabs and writes to Supabase,
 * so section 15's admin secret applies. `GET` only reads stored rows, like
 * `GET /api/sources`, so it does not.
 *
 * Thin handlers (section 5): guard, delegate, respond. Every Oxylabs call and
 * every database write lives in `lib/pipeline/scheduler.ts`.
 */

/** Creating one schedule per source is a handful of small API calls. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  const posthog = getPostHogClient();
  const distinctId =
    request.headers.get("x-posthog-distinct-id") ?? "admin_api";
  const sessionId = request.headers.get("x-posthog-session-id");

  try {
    const summary = await syncSchedules();

    posthog?.capture({
      distinctId,
      event: "oxylabs_schedule_sync_completed",
      properties: {
        status: summary.status,
        active_sources: summary.activeSources,
        schedules_created: summary.schedulesCreated,
        schedules_existing: summary.schedulesExisting,
        orphans_deactivated: summary.orphansDeactivated,
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
      endpoint: "oxylabs/schedules",
      ...(sessionId ? { $session_id: sessionId } : {}),
    });
    await posthog?.flush();

    // Details go to the server console; the caller gets a generic message so
    // no credential or stack trace leaves the server (section 21).
    console.error("POST /api/oxylabs/schedules failed:", error);

    return NextResponse.json(
      { error: "Schedule sync failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const schedules = await getSchedules();

    return NextResponse.json({
      schedules: schedules.map((schedule) => ({
        // A digit string end to end - never parsed into a number (section 18).
        schedule_id: schedule.schedule_id,
        source_id: schedule.source_id,
        cron_expression: schedule.cron_expression,
        is_active: schedule.is_active,
        last_synced_at: schedule.last_synced_at,
        created_at: schedule.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/oxylabs/schedules failed:", error);

    return NextResponse.json(
      { error: "Could not load schedules." },
      { status: 500 }
    );
  }
}
