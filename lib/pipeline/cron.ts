import "server-only";

import { runAnalysis } from "@/lib/pipeline/analyze";
import { createRunLogger } from "@/lib/pipeline/run-logger";
import { runScheduledProcessing } from "@/lib/pipeline/scheduler";
import { messageOf } from "@/lib/pipeline/source-run";
import type {
  AnalyzeSummary,
  CronPipelineSummary,
  ScheduledProcessingSummary,
} from "@/lib/pipeline/types";
import { DEFAULT_ARTICLES_PER_SOURCE } from "@/lib/scraping/limits";

/**
 * The automatic hourly pipeline (AGENTS.md section 18).
 *
 * Oxylabs Scheduler runs its jobs at the top of the hour; Vercel Cron calls
 * `/api/cron/pipeline` fifteen minutes later, and this function runs both steps
 * in sequence so nothing needs a human after the schedules exist:
 *
 * 1. Process scheduled results - completed job HTML through the shared
 *    scrape-to-insert pipeline.
 * 2. Run AI analysis over everything still pending.
 *
 * Step two runs even when step one fails (section 18 rule 6). The two are
 * independent: a failure to reach Oxylabs says nothing about the articles
 * already sitting in the database unanalysed, and an article only reaches a
 * reader once its analysis exists.
 */
export async function runCronPipeline(): Promise<CronPipelineSummary> {
  const log = createRunLogger("cron");
  const startedAt = Date.now();

  let processing: ScheduledProcessingSummary | null = null;
  let processingError: string | null = null;
  let analysis: AnalyzeSummary | null = null;
  let analysisError: string | null = null;

  log.info("Cron pipeline started");

  // Step one. Its own summary carries its own run id, so the two stages stay
  // separately traceable in `public.logs`.
  try {
    log.info("Step 1/2: processing scheduled results");
    processing = await runScheduledProcessing({
      perSource: DEFAULT_ARTICLES_PER_SOURCE,
    });
    log.info("Step 1/2 finished", {
      status: processing.status,
      articlesInserted: processing.articlesInserted,
      jobsProcessed: processing.jobsProcessed,
    });
  } catch (error) {
    processingError = messageOf(error);
    log.error("Step 1/2 failed", { reason: processingError });
  }

  // Step two, unconditionally: there may be pre-existing unanalyzed articles
  // regardless of what step one did.
  try {
    log.info("Step 2/2: analysing pending articles");
    analysis = await runAnalysis({});
    log.info("Step 2/2 finished", {
      status: analysis.status,
      analyzed: analysis.analyzed,
      failed: analysis.failed,
    });
  } catch (error) {
    analysisError = messageOf(error);
    log.error("Step 2/2 failed", { reason: analysisError });
  }

  const bothThrew = processingError !== null && analysisError !== null;
  const anyProblem =
    processingError !== null ||
    analysisError !== null ||
    processing?.status !== "completed" ||
    analysis?.status !== "completed";

  const status: CronPipelineSummary["status"] = bothThrew
    ? "failed"
    : anyProblem
      ? "completed_with_errors"
      : "completed";

  const summary: CronPipelineSummary = {
    status,
    runId: log.runId,
    processing,
    processingError,
    analysis,
    analysisError,
    durationMs: Date.now() - startedAt,
  };

  log.info(
    status === "completed"
      ? "Cron pipeline completed"
      : status === "failed"
        ? "Cron pipeline failed"
        : "Cron pipeline completed with errors"
  );
  log.summary(summary);

  return summary;
}
