import "server-only";

import {
  apiErrorMessage,
  authorizationHeader,
  OxylabsError,
} from "@/lib/oxylabs/client";
import { parseOxylabsJson, quoteLongIntegers } from "@/lib/oxylabs/json";
import {
  OXYLABS_RESULT_TIMEOUT_MS,
  OXYLABS_SCHEDULER_TIMEOUT_MS,
} from "@/lib/scraping/limits";

/**
 * The Oxylabs Scheduler and Push-Pull client (AGENTS.md section 18).
 *
 * Scheduler jobs run against `data.oxylabs.io`, not the `realtime.oxylabs.io`
 * host `lib/oxylabs/client.ts` uses: a scheduled job is submitted by Oxylabs on
 * its own cron and its result is pulled afterwards, so there is no request to
 * hold open.
 *
 * Credentials are not read here. `authorizationHeader` comes from
 * `lib/oxylabs/client.ts`, which stays the one place `OXY_WSA_USERNAME` and
 * `OXY_WSA_PASSWORD` are touched (AGENTS.md section 21).
 *
 * `GET /schedules/{id}/jobs` is deliberately *not* implemented. It returns a
 * flat array of job ids with no status, so there is no way to tell a `done` job
 * from a `pending` or `faulted` one, and section 18 requires `/runs` - which
 * carries a per-job `result_status` - for exactly that reason.
 *
 * Every response here is parsed with `parseOxylabsJson`, never `JSON.parse`:
 * `schedule_id` and job `id` are 64-bit integers that a plain parse corrupts
 * silently.
 */

const BASE_URL = "https://data.oxylabs.io";

/** One item in a schedule's payload - a source homepage, per section 9. */
export type ScheduleItem = {
  source: "universal";
  url: string;
  user_agent_type: string;
  geo_location: string;
};

/** One job inside a scheduled run, with the status section 18 filters on. */
export type ScheduleRunJob = {
  /** The exact 64-bit id, as a digit string. Never a number. */
  id: string;
  resultStatus: string | null;
  createdAt: string | null;
};

export type ScheduleRun = {
  runId: string;
  jobs: ScheduleRunJob[];
};

/**
 * One Scheduler call, returning the **raw response text**.
 *
 * Raw text is the contract: section 18 requires ids to be read from it before
 * any parse, so this never hands back a parsed object. Failures carry the same
 * messages the realtime client produces, and never a credential or a body.
 */
async function request(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  timeoutMs: number = OXYLABS_SCHEDULER_TIMEOUT_MS
): Promise<string> {
  let response: Response;
  let text: string;

  // The body read sits inside the try too: an abort can land mid-stream, and
  // that must surface as an OxylabsError naming the call.
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    text = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new OxylabsError(`Oxylabs request failed for ${method} ${path}: ${reason}`);
  }

  if (!response.ok) {
    throw new OxylabsError(
      apiErrorMessage(response.status, text),
      response.status
    );
  }

  return text;
}

/**
 * Creates one hourly schedule and returns its id as an exact digit string.
 *
 * The id is pulled straight out of the raw text with a regex, before any
 * parse - AGENTS.md section 18's "use string extraction or regex on the raw
 * text to capture the exact digit sequence". `quoteLongIntegers` normalises the
 * literal first so the same expression works whether Oxylabs quotes the id or
 * not.
 */
export async function createSchedule(options: {
  cron: string;
  items: ScheduleItem[];
  endTime: string;
}): Promise<string> {
  const text = await request("POST", "/v1/schedules", {
    cron: options.cron,
    items: options.items,
    end_time: options.endTime,
  });

  const match = /"schedule_id"\s*:\s*"?(-?\d+)"?/.exec(quoteLongIntegers(text));

  if (!match) {
    throw new OxylabsError(
      "Oxylabs did not return a schedule_id when creating a schedule."
    );
  }

  return match[1];
}

/** Every schedule id Oxylabs currently holds, for the orphan sweep. */
export async function listScheduleIds(): Promise<string[]> {
  const text = await request("GET", "/v1/schedules");
  const parsed = parseOxylabsJson<{ schedules?: unknown }>(
    text,
    "GET /v1/schedules"
  );

  if (!Array.isArray(parsed.schedules)) return [];

  // Oxylabs already quotes these, and `quoteLongIntegers` would have quoted
  // them otherwise, so anything non-string here is unexpected and dropped
  // rather than coerced - coercing is how a corrupted id would slip through.
  return parsed.schedules.filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
}

/**
 * Reads a job id losslessly, or returns null when it cannot be trusted.
 *
 * `quoteLongIntegers` only quotes literals of 16 digits or more, so a shorter
 * job id arrives here as an ordinary number. That is not a corrupted value -
 * anything at or below `Number.MAX_SAFE_INTEGER` survived the parse intact -
 * so it is safe to render as a string. Rejecting every number outright would
 * silently drop such a job, and a dropped job means a homepage that never gets
 * processed. A non-integer or unsafe number is a real loss of precision and is
 * refused.
 */
function jobIdOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }

  return null;
}

/**
 * The schedule's runs, each with its per-job `result_status`.
 *
 * Section 18: always use `/runs`, never `/jobs`, and filter to
 * `result_status === 'done'` before fetching any result.
 */
export async function getScheduleRuns(
  scheduleId: string
): Promise<ScheduleRun[]> {
  const path = `/v1/schedules/${scheduleId}/runs`;
  const text = await request("GET", path);

  const parsed = parseOxylabsJson<{
    runs?: {
      run_id?: unknown;
      jobs?: {
        id?: unknown;
        result_status?: unknown;
        created_at?: unknown;
      }[];
    }[];
  }>(text, `GET ${path}`);

  if (!Array.isArray(parsed.runs)) return [];

  return parsed.runs.map((run) => ({
    runId: String(run.run_id ?? ""),
    jobs: (run.jobs ?? [])
      .map((job) => ({
        id: jobIdOf(job.id),
        resultStatus:
          typeof job.result_status === "string" ? job.result_status : null,
        createdAt: typeof job.created_at === "string" ? job.created_at : null,
      }))
      // A job whose id could not be read losslessly is unusable: fetching a
      // result for a rounded id would 404 at best and return another job at
      // worst, so it is dropped rather than guessed at.
      .filter((job): job is ScheduleRunJob => job.id !== null),
  }));
}

/**
 * Activates or deactivates a schedule.
 *
 * There is no delete endpoint in the Oxylabs API, which is why section 18's
 * orphan cleanup deactivates rather than removes. Answers `202` with an empty
 * body, so nothing is parsed.
 */
export async function setScheduleState(
  scheduleId: string,
  active: boolean
): Promise<void> {
  await request("PUT", `/v1/schedules/${scheduleId}/state`, { active });
}

/**
 * The homepage HTML one completed job produced.
 *
 * Only ever called for a job whose `result_status` is `done`. The timeout is
 * the page-sized one, not the control-plane one: this response carries a whole
 * homepage rather than a few fields.
 */
export async function fetchJobResultHtml(jobId: string): Promise<string> {
  const path = `/v1/queries/${jobId}/results`;
  const text = await request("GET", path, undefined, OXYLABS_RESULT_TIMEOUT_MS);

  const parsed = parseOxylabsJson<{
    results?: { content?: unknown; status_code?: number }[];
  }>(text, `GET ${path}`);

  const result = parsed.results?.[0];

  if (!result) {
    throw new OxylabsError(`Oxylabs returned no results for job ${jobId}`);
  }

  // The *target site's* status code, not the API's: a 403 means the publisher
  // blocked the scheduled scrape, a 404 that the homepage moved.
  const targetStatus = result.status_code;

  if (
    typeof targetStatus === "number" &&
    (targetStatus < 200 || targetStatus >= 300)
  ) {
    throw new OxylabsError(
      `Target site returned ${targetStatus} for job ${jobId} ` +
        `(${targetStatus === 403 ? "blocked" : "not delivered"})`,
      targetStatus
    );
  }

  if (typeof result.content !== "string" || result.content.length === 0) {
    throw new OxylabsError(`Oxylabs returned empty content for job ${jobId}`);
  }

  return result.content;
}
