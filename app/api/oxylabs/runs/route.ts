import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getRecentRuns } from "@/lib/supabase/queries/schedules";

/**
 * GET /api/oxylabs/runs - the recorded scheduled-run rows (AGENTS.md section 14).
 *
 * A read/status route: it mutates nothing, so section 15's admin secret does
 * not apply. It returns job ids, statuses and counts, never a credential and
 * never scraped HTML.
 */

const RunsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = RunsQuery.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const runs = await getRecentRuns(parsed.data.limit ?? 50);

    return NextResponse.json({
      runs: runs.map((run) => ({
        // Digit strings end to end - never parsed into numbers (section 18).
        schedule_id: run.schedule_id,
        job_id: run.job_id,
        result_status: run.result_status,
        run_at: run.run_at,
        processed_at: run.processed_at,
        articles_inserted: run.articles_inserted,
        created_at: run.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/oxylabs/runs failed:", error);

    return NextResponse.json({ error: "Could not load runs." }, { status: 500 });
  }
}
