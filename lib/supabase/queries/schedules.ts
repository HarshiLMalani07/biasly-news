import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/queries/unwrap";
import type {
  OxylabsScheduleRow,
  OxylabsScheduleRunRow,
  SourceRow,
} from "@/lib/supabase/types";

/**
 * Oxylabs Scheduler reads and writes (AGENTS.md section 18).
 *
 * `schedule_id` and `job_id` are text columns holding 64-bit ids, and they stay
 * strings end to end - nothing here parses one into a number.
 *
 * Joined tables are never filtered with `.eq('foreignTable.column', value)`:
 * that generates broken PostgREST SQL. The source's `is_active` condition is
 * applied in JavaScript after the query returns (AGENTS.md section 21).
 */

/** A schedule row with its source, as the processing pipeline reads it. */
export type ScheduleWithSource = OxylabsScheduleRow & {
  sources: SourceRow | null;
};

/** The same row as PostgREST returns it, before the embed is flattened. */
type RawScheduleRow = OxylabsScheduleRow & {
  sources: SourceRow | SourceRow[] | null;
};

/**
 * PostgREST returns a to-one embed as an object, but as an array when it
 * cannot prove the relationship is unique. Normalise both shapes.
 */
function firstOrNull<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Every stored schedule row, newest first. Backs `GET /api/oxylabs/schedules`. */
export async function getSchedules(): Promise<OxylabsScheduleRow[]> {
  const supabase = getServiceRoleClient();

  return unwrap(
    "getSchedules",
    await supabase
      .from("oxylabs_schedules")
      .select("*")
      .order("created_at", { ascending: false })
  );
}

/**
 * Active schedules whose source is also still active - the set the processing
 * pipeline works through.
 *
 * `is_active` on `oxylabs_schedules` is a filter on the queried table itself,
 * which is fine; the source's `is_active` is on an *embedded* table, so it is
 * applied in JavaScript (AGENTS.md section 21).
 */
export async function getSchedulesWithSources(): Promise<ScheduleWithSource[]> {
  const supabase = getServiceRoleClient();

  const rows = unwrap(
    "getSchedulesWithSources",
    await supabase
      .from("oxylabs_schedules")
      .select("*, sources ( * )")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .returns<RawScheduleRow[]>()
  );

  return rows
    .map((row) => ({ ...row, sources: firstOrNull(row.sources) }))
    .filter((row) => row.sources !== null && row.sources.is_active);
}

/** Stores a newly created Oxylabs schedule. `scheduleId` stays a digit string. */
export async function insertSchedule(options: {
  sourceId: string;
  scheduleId: string;
  cronExpression: string;
}): Promise<OxylabsScheduleRow> {
  const supabase = getServiceRoleClient();

  return unwrap(
    "insertSchedule",
    await supabase
      .from("oxylabs_schedules")
      .insert({
        source_id: options.sourceId,
        schedule_id: options.scheduleId,
        cron_expression: options.cronExpression,
        is_active: true,
        last_synced_at: new Date().toISOString(),
      })
      .select("*")
      .single()
  );
}

/** Records that the sync route saw this schedule and left it in place. */
export async function touchSchedule(scheduleId: string): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedules")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("schedule_id", scheduleId);

  if (error) throw new Error(`touchSchedule: ${error.message}`);
}

/**
 * Flips a stored schedule's active flag.
 *
 * The row is kept rather than deleted: the orphan sweep deactivates every
 * Oxylabs schedule with no DB row, so removing the row would make a
 * deliberately-deactivated schedule indistinguishable from an orphan, and a
 * reactivated source would be charged for a second schedule.
 */
export async function setScheduleRowActive(
  scheduleId: string,
  isActive: boolean
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedules")
    .update({ is_active: isActive, last_synced_at: new Date().toISOString() })
    .eq("schedule_id", scheduleId);

  if (error) throw new Error(`setScheduleRowActive: ${error.message}`);
}

/**
 * Removes a stored schedule row.
 *
 * Used when a schedule's cron has drifted from `SCHEDULE_CRON_EXPRESSION`.
 * Oxylabs has no endpoint for changing a schedule's cron - only `/state` -
 * so the only way to rewrite one is to retire it and create a replacement.
 *
 * `oxylabs_schedule_runs.schedule_id` cascades on delete, so the retired
 * schedule's job history goes with it. That history describes a schedule that
 * no longer exists, and `source_id` is unique on this table, so the row cannot
 * simply be kept alongside its replacement.
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedules")
    .delete()
    .eq("schedule_id", scheduleId);

  if (error) throw new Error(`deleteSchedule: ${error.message}`);
}

/**
 * Records one job of a scheduled run, or refreshes its status.
 *
 * Upserts on the existing `(schedule_id, job_id)` unique constraint. Only the
 * status columns are written, so a job already marked `processed_at` is never
 * reopened by a later status refresh.
 */
export async function recordScheduleRun(options: {
  scheduleId: string;
  jobId: string;
  resultStatus: string | null;
  runAt: string | null;
}): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedule_runs")
    .upsert(
      {
        schedule_id: options.scheduleId,
        job_id: options.jobId,
        result_status: options.resultStatus,
        run_at: options.runAt,
      },
      { onConflict: "schedule_id,job_id" }
    );

  if (error) throw new Error(`recordScheduleRun: ${error.message}`);
}

/** Marks one job consumed, so no later pass fetches its result again. */
export async function markRunProcessed(
  scheduleId: string,
  jobId: string,
  articlesInserted: number
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedule_runs")
    .update({
      processed_at: new Date().toISOString(),
      articles_inserted: articlesInserted,
    })
    .eq("schedule_id", scheduleId)
    .eq("job_id", jobId);

  if (error) throw new Error(`markRunProcessed: ${error.message}`);
}

/** Jobs of this schedule whose HTML has not been through the pipeline yet. */
export async function getUnprocessedRuns(
  scheduleId: string
): Promise<OxylabsScheduleRunRow[]> {
  const supabase = getServiceRoleClient();

  return unwrap(
    "getUnprocessedRuns",
    await supabase
      .from("oxylabs_schedule_runs")
      .select("*")
      .eq("schedule_id", scheduleId)
      .is("processed_at", null)
  );
}

/** The newest run rows. Backs `GET /api/oxylabs/runs`. */
export async function getRecentRuns(
  limit = 50
): Promise<OxylabsScheduleRunRow[]> {
  const supabase = getServiceRoleClient();

  return unwrap(
    "getRecentRuns",
    await supabase
      .from("oxylabs_schedule_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
  );
}
