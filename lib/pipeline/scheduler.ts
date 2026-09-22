import "server-only";

import {
  createSchedule,
  fetchJobResultHtml,
  getScheduleRuns,
  listScheduleIds,
  setScheduleState,
  type ScheduleItem,
  type ScheduleRunJob,
} from "@/lib/oxylabs/scheduler";
import { createRunLogger } from "@/lib/pipeline/run-logger";
import {
  emptyTotals,
  forEachConcurrently,
  messageOf,
  processSourceHtml,
} from "@/lib/pipeline/source-run";
import type {
  RejectionReason,
  ScheduledProcessingOptions,
  ScheduledProcessingSummary,
  SourceOutcome,
  SyncedSchedule,
  SyncSchedulesSummary,
} from "@/lib/pipeline/types";
import {
  MAX_JOBS_PER_SCHEDULE_PER_RUN,
  MAX_RUNS_LOOKBACK,
  SCHEDULE_CRON_EXPRESSION,
  SCHEDULE_END_TIME_YEARS,
  SOURCE_CONCURRENCY,
} from "@/lib/scraping/limits";
import {
  deleteSchedule,
  getSchedules,
  getSchedulesWithSources,
  getUnprocessedRuns,
  insertSchedule,
  markRunProcessed,
  recordScheduleRun,
  setScheduleRowActive,
  touchSchedule,
} from "@/lib/supabase/queries/schedules";
import { getActiveSources } from "@/lib/supabase/queries/sources";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * The Oxylabs Scheduler stage (AGENTS.md section 18).
 *
 * Two entry points:
 *
 * - `syncSchedules` creates one hourly Oxylabs schedule per active source
 *   homepage and deactivates anything Oxylabs still runs that the database no
 *   longer knows about.
 * - `runScheduledProcessing` pulls the HTML completed jobs produced and feeds
 *   it to the shared pipeline in `lib/pipeline/source-run.ts`.
 *
 * Processing deliberately contains no parsing, validation, cleanup or dedupe of
 * its own. Section 18: "Do not duplicate pipeline logic inside Scheduler."
 * Everything below the HTML is `processSourceHtml`, the same function manual
 * scraping calls.
 */

/** The Oxylabs `end_time` format: `YYYY-MM-DD HH:MM:SS`, UTC. */
function formatEndTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** The create payload for one source homepage (section 9: homepages only). */
function scheduleItemFor(source: SourceRow): ScheduleItem {
  return {
    source: "universal",
    url: source.listing_url,
    // The same request shape `fetchPageHtml` sends, so scheduled HTML and
    // manually scraped HTML are the same markup for the parser.
    user_agent_type: "desktop_chrome",
    geo_location: "United States",
  };
}

/**
 * Creates the hourly Oxylabs schedules and reconciles them with the database.
 *
 * One of section 18's two independent one-time setups. It tells Oxylabs what to
 * scrape; it does not configure Vercel Cron, and neither step triggers the
 * other.
 */
export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  const log = createRunLogger("scheduler");
  const startedAt = Date.now();
  const errors: { scope: string; message: string }[] = [];
  const schedules: SyncedSchedule[] = [];

  let activeSources = 0;
  let schedulesCreated = 0;
  let schedulesExisting = 0;
  let schedulesRecreated = 0;
  let schedulesDeactivated = 0;
  let orphansDeactivated = 0;

  function summarise(
    status: SyncSchedulesSummary["status"]
  ): SyncSchedulesSummary {
    return {
      status,
      runId: log.runId,
      activeSources,
      schedulesCreated,
      schedulesExisting,
      schedulesRecreated,
      schedulesDeactivated,
      orphansDeactivated,
      durationMs: Date.now() - startedAt,
      errors,
      schedules,
    };
  }

  log.info("Schedule sync started", { cron: SCHEDULE_CRON_EXPRESSION });

  let sources: SourceRow[];
  let stored: Awaited<ReturnType<typeof getSchedules>>;

  try {
    [sources, stored] = await Promise.all([getActiveSources(), getSchedules()]);
  } catch (error) {
    log.error("Schedule sync failed: could not load sources or schedules", {
      reason: messageOf(error),
    });
    const summary = summarise("failed");
    log.summary(summary);
    return summary;
  }

  activeSources = sources.length;
  log.info("Active sources", { sources: sources.map((s) => s.name) });

  const bySourceId = new Map(stored.map((row) => [row.source_id, row]));
  const activeSourceIds = new Set(sources.map((source) => source.id));

  const endTime = new Date();
  endTime.setUTCFullYear(endTime.getUTCFullYear() + SCHEDULE_END_TIME_YEARS);

  // 1-2. One schedule per active source. Sequential on purpose: creating
  // schedules is a billing action, and a burst of parallel creates is exactly
  // the shape that produces duplicates if one call is retried.
  /** Creates the Oxylabs schedule for one source and stores its row. */
  async function createFor(source: SourceRow): Promise<string> {
    const scheduleId = await createSchedule({
      cron: SCHEDULE_CRON_EXPRESSION,
      items: [scheduleItemFor(source)],
      endTime: formatEndTime(endTime),
    });

    await insertSchedule({
      sourceId: source.id,
      scheduleId,
      cronExpression: SCHEDULE_CRON_EXPRESSION,
    });

    return scheduleId;
  }

  for (const source of sources) {
    const existing = bySourceId.get(source.id);

    if (existing) {
      // A stored schedule whose cron no longer matches the configured one has
      // to be replaced: Oxylabs exposes no way to change a schedule's cron,
      // only to switch it on or off. Without this, changing
      // SCHEDULE_CRON_EXPRESSION would leave every existing schedule running
      // on the old cadence for ever - and still billing for it.
      if (existing.cron_expression !== SCHEDULE_CRON_EXPRESSION) {
        try {
          await setScheduleState(existing.schedule_id, false);
          await deleteSchedule(existing.schedule_id);

          const scheduleId = await createFor(source);

          schedulesRecreated += 1;
          schedules.push({
            source: source.name,
            scheduleId,
            cron: SCHEDULE_CRON_EXPRESSION,
            created: true,
          });
          log.info(`Schedule recreated on a new cron: ${source.name}`, {
            previousScheduleId: existing.schedule_id,
            previousCron: existing.cron_expression,
            scheduleId,
            cron: SCHEDULE_CRON_EXPRESSION,
          });
        } catch (error) {
          const message = messageOf(error);
          errors.push({ scope: source.name, message });
          log.error(`Schedule recreation failed: ${source.name}`, {
            reason: message,
          });
        }

        continue;
      }

      try {
        await touchSchedule(existing.schedule_id);
        schedulesExisting += 1;
        schedules.push({
          source: source.name,
          scheduleId: existing.schedule_id,
          cron: existing.cron_expression,
          created: false,
        });
        log.info(`Schedule exists: ${source.name}`, {
          scheduleId: existing.schedule_id,
        });
      } catch (error) {
        const message = messageOf(error);
        errors.push({ scope: source.name, message });
        log.error(`Could not touch schedule: ${source.name}`, {
          reason: message,
        });
      }

      continue;
    }

    try {
      const scheduleId = await createFor(source);

      schedulesCreated += 1;
      schedules.push({
        source: source.name,
        scheduleId,
        cron: SCHEDULE_CRON_EXPRESSION,
        created: true,
      });
      log.info(`Schedule created: ${source.name} (${scheduleId})`);
    } catch (error) {
      const message = messageOf(error);
      errors.push({ scope: source.name, message });
      log.error(`Schedule creation failed: ${source.name}`, {
        reason: message,
      });
    }
  }

  // 3. A schedule whose source is no longer active must stop running. The row
  // stays so the orphan sweep below does not mistake it for an unknown
  // schedule and so a reactivated source is not charged for a second one.
  for (const row of stored) {
    if (activeSourceIds.has(row.source_id) || !row.is_active) continue;

    try {
      await setScheduleState(row.schedule_id, false);
      await setScheduleRowActive(row.schedule_id, false);
      schedulesDeactivated += 1;
      log.info(`Schedule deactivated (source inactive): ${row.schedule_id}`);
    } catch (error) {
      const message = messageOf(error);
      errors.push({ scope: `schedule ${row.schedule_id}`, message });
      log.error(`Could not deactivate schedule: ${row.schedule_id}`, {
        reason: message,
      });
    }
  }

  // 4. Orphan sweep (section 18). Every schedule Oxylabs still runs that has no
  // row here was left behind by a deleted-and-recreated row. It would keep
  // scraping hourly and keep billing, so it is switched off.
  try {
    const remote = await listScheduleIds();
    const known = new Set(
      (await getSchedules()).map((row) => row.schedule_id)
    );

    for (const scheduleId of remote) {
      if (known.has(scheduleId)) continue;

      try {
        await setScheduleState(scheduleId, false);
        orphansDeactivated += 1;
        log.info(`Orphan schedule deactivated: ${scheduleId}`);
      } catch (error) {
        const message = messageOf(error);
        errors.push({ scope: `orphan ${scheduleId}`, message });
        log.error(`Could not deactivate orphan schedule: ${scheduleId}`, {
          reason: message,
        });
      }
    }
  } catch (error) {
    const message = messageOf(error);
    errors.push({ scope: "orphan sweep", message });
    log.error("Orphan sweep failed", { reason: message });
  }

  schedules.sort((a, b) => a.source.localeCompare(b.source));

  const summary = summarise(errors.length > 0 ? "completed_with_errors" : "completed");

  log.info(
    errors.length > 0
      ? "Schedule sync completed with errors"
      : "Schedule sync completed"
  );
  log.summary(summary);

  return summary;
}

/** Newest first, by the job's `created_at`; jobs without one sort last. */
function newestFirst(a: ScheduleRunJob, b: ScheduleRunJob): number {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

/**
 * Processes the results of completed Oxylabs jobs through the shared pipeline.
 *
 * Runs the scrape-to-insert pipeline of section 9 with one difference: the
 * homepage HTML comes from a finished Oxylabs job instead of a live fetch.
 * Everything else - candidate extraction, the reject list, dedupe, the URL
 * existence check, validation, cleanup, the append-only insert and the run
 * logging - is the code manual scraping runs.
 */
export async function runScheduledProcessing(
  options: ScheduledProcessingOptions
): Promise<ScheduledProcessingSummary> {
  const log = createRunLogger("scheduler");
  const startedAt = Date.now();
  const totals = emptyTotals();
  const rejections = new Map<RejectionReason, number>();
  const sourceErrors: { source: string; message: string }[] = [];
  const outcomes: SourceOutcome[] = [];

  let schedulesChecked = 0;
  let jobsDone = 0;
  let jobsProcessed = 0;
  let jobsSuperseded = 0;
  let jobsPending = 0;
  let jobsFaulted = 0;

  function summarise(
    status: ScheduledProcessingSummary["status"]
  ): ScheduledProcessingSummary {
    return {
      status,
      runId: log.runId,
      sourcesChecked: schedulesChecked,
      ...totals,
      durationMs: Date.now() - startedAt,
      rejectionReasons: Object.fromEntries(rejections) as Partial<
        Record<RejectionReason, number>
      >,
      sourceErrors,
      sources: outcomes,
      schedulesChecked,
      jobsDone,
      jobsProcessed,
      jobsSuperseded,
      jobsPending,
      jobsFaulted,
    };
  }

  log.info("Scheduled processing started", { perSource: options.perSource });

  let schedules: Awaited<ReturnType<typeof getSchedulesWithSources>>;

  try {
    schedules = await getSchedulesWithSources();
  } catch (error) {
    log.error("Scheduled processing failed: could not load schedules", {
      reason: messageOf(error),
    });
    const summary = summarise("failed");
    log.summary(summary);
    return summary;
  }

  if (schedules.length === 0) {
    log.warn(
      "No active schedules found. Create them with POST /api/oxylabs/schedules."
    );
    const summary = summarise("completed");
    log.summary(summary);
    return summary;
  }

  log.info("Selected schedules", {
    schedules: schedules.map((row) => row.sources?.name ?? row.schedule_id),
  });

  await forEachConcurrently(
    schedules,
    SOURCE_CONCURRENCY,
    () => false,
    async (schedule) => {
      // `getSchedulesWithSources` only returns rows with an active source, so
      // this is a type narrowing rather than a real branch.
      const source = schedule.sources;
      if (source === null) return;

      schedulesChecked += 1;

      try {
        log.info(`Schedule started: ${source.name}`, {
          scheduleId: schedule.schedule_id,
        });

        const runs = await getScheduleRuns(schedule.schedule_id);

        // Flattened and sorted newest-first before the window is applied, so
        // the cap never depends on the order Oxylabs happens to return runs
        // in - taking a slice off either end would quietly look at the oldest
        // jobs if that order were ever reversed.
        const jobs: ScheduleRunJob[] = runs
          .flatMap((run) => run.jobs)
          .sort(newestFirst)
          .slice(0, MAX_RUNS_LOOKBACK);

        log.info(`Jobs reported by Oxylabs: ${source.name}`, {
          runs: runs.length,
          jobs: jobs.length,
        });

        // Record every job seen, whatever its status, so the run table is a
        // complete history and not just a list of the ones we consumed.
        for (const job of jobs) {
          await recordScheduleRun({
            scheduleId: schedule.schedule_id,
            jobId: job.id,
            resultStatus: job.resultStatus,
            runAt: job.createdAt,
          });
        }

        const unprocessed = new Set(
          (await getUnprocessedRuns(schedule.schedule_id)).map(
            (row) => row.job_id
          )
        );

        const pendingJobs = jobs.filter((job) => unprocessed.has(job.id));

        // Section 18: only `done` jobs may have their results fetched.
        const done = pendingJobs
          .filter((job) => job.resultStatus === "done")
          .sort(newestFirst);

        const stillRunning = pendingJobs.filter(
          (job) => job.resultStatus === "pending" || job.resultStatus === null
        );

        const faulted = pendingJobs.filter(
          (job) =>
            job.resultStatus !== "done" &&
            job.resultStatus !== "pending" &&
            job.resultStatus !== null
        );

        jobsDone += done.length;
        jobsPending += stillRunning.length;

        // A faulted job has no result to fetch and never will, so it is closed
        // rather than retried on every pass for ever.
        for (const job of faulted) {
          await markRunProcessed(schedule.schedule_id, job.id, 0);
          jobsFaulted += 1;
          log.warn(`Job faulted, skipped: ${source.name}`, {
            jobId: job.id,
            resultStatus: job.resultStatus,
          });
        }

        const selected = done.slice(0, MAX_JOBS_PER_SCHEDULE_PER_RUN);
        const superseded = done.slice(MAX_JOBS_PER_SCHEDULE_PER_RUN);

        // Older snapshots of the same homepage only carry staler links, and
        // fetching each one costs an Oxylabs result call for links dedupe
        // would drop anyway.
        for (const job of superseded) {
          await markRunProcessed(schedule.schedule_id, job.id, 0);
          jobsSuperseded += 1;
          log.info(`Job superseded by a newer result: ${source.name}`, {
            jobId: job.id,
          });
        }

        if (selected.length === 0) {
          log.info(`No new completed jobs: ${source.name}`, {
            pending: stillRunning.length,
          });
          return;
        }

        for (const job of selected) {
          const html = await fetchJobResultHtml(job.id);
          log.info(`Job result fetched: ${source.name}`, { jobId: job.id });

          // The scheduled homepage HTML is never stored as an article: it goes
          // straight into the shared pipeline as a source of candidate links.
          const outcome = await processSourceHtml(
            source,
            html,
            options.perSource,
            totals,
            rejections,
            log
          );

          outcomes.push(outcome);
          await markRunProcessed(
            schedule.schedule_id,
            job.id,
            outcome.articlesInserted
          );
          jobsProcessed += 1;
        }
      } catch (error) {
        const message = messageOf(error);
        sourceErrors.push({ source: source.name, message });
        log.error(`Schedule failed: ${source.name}`, { reason: message });
      }
    }
  );

  outcomes.sort((a, b) => a.source.localeCompare(b.source));
  sourceErrors.sort((a, b) => a.source.localeCompare(b.source));

  const summary = summarise(
    sourceErrors.length > 0 ? "completed_with_errors" : "completed"
  );

  log.info(
    sourceErrors.length > 0
      ? "Scheduled processing completed with errors"
      : "Scheduled processing completed"
  );
  log.summary(summary);

  return summary;
}
