# Oxylabs Scheduler and the Automatic Hourly Vercel Cron Pipeline

AGENTS.md section 18, delivered whole. Oxylabs Scheduler scrapes every active
source homepage hourly; a Vercel Cron Job fires 15 minutes later and calls
`/api/cron/pipeline`, which processes the completed Oxylabs job HTML through the
existing scrape-to-insert pipeline and then immediately runs AI analysis on
whatever is still pending.

Section 18 names five parts that must ship together, and all five are in scope:

1. Sync schedules route — one Oxylabs schedule per active source
2. List schedules route — reads the stored `oxylabs_schedules` rows
3. Manual process route — on-demand processing of completed job results
4. Vercel Cron config — `vercel.json`, the hourly `:15` trigger
5. Cron pipeline route — scheduled-result processing, then AI analysis

---

## 1. Goal

1. `POST /api/oxylabs/schedules` creates one hourly Oxylabs schedule per active
   source homepage, stores its `schedule_id` as an exact digit string, and
   deactivates every orphaned Oxylabs schedule that no longer has a DB row.
2. `GET /api/oxylabs/schedules` returns the stored schedule rows.
3. `POST /api/oxylabs/scheduled-results/process` pulls completed Oxylabs job
   HTML and runs it through the **same** scrape-to-insert pipeline manual
   scraping uses — same candidate extraction, reject list, dedupe, URL existence
   check, validation, cleanup, append-only insert and run logging.
4. `GET /api/oxylabs/runs` returns the stored per-job run rows.
5. `GET /api/cron/pipeline` chains step 3 then AI analysis, is protected by
   `CRON_SECRET`, and runs analysis **even when step 3 fails**.
6. `vercel.json` registers `/api/cron/pipeline` on `15 * * * *`.

Out of scope: no UI changes, no schema changes (the two Scheduler tables already
exist), no change to validation rules, the analysis prompt, or the framing
output contract. Nothing about `POST /api/scrape` or `POST /api/analyze` changes
behaviourally — `scrape.ts` is only refactored so the Scheduler can reuse it.

---

## 2. Skills read

- `.agents/skills/web-scraper-api/SKILL.md` — HTTP Basic auth from
  `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`; `https://data.oxylabs.io/v1/queries`
  is the Push-Pull endpoint (Scheduler jobs land there, not on
  `realtime.oxylabs.io`); `source: "universal"` with a `url` for any site with
  no dedicated source; `parse` is not used because biasly parses HTML itself
  with Cheerio; `user_agent_type` and `geo_location` presets; the
  `results[0].content` response shape; and the error table (401 auth, 429 rate
  limit).
- `.agents/skills/supabase/SKILL.md` — "Supabase changes frequently, verify
  against current docs"; the imperative-migration path (this project has no
  Supabase CLI and no `supabase/migrations/`, so `supabase/schema.sql` is the
  source of truth and SQL is run by hand in Dashboard → SQL Editor); RLS on
  every table in an exposed schema, with `service_role` the only role biasly
  uses; never expose the service-role key to a public client; and "verify your
  work — a fix without verification is incomplete."

Per AGENTS.md section 18, the Oxylabs Scheduler API was **fetched live** from
`https://developers.oxylabs.io/products/web-scraper-api/features/scheduler`
rather than recalled, and the Push-Pull result-retrieval endpoint from
`https://developers.oxylabs.io/products/web-scraper-api/integration-methods/push-pull`.
Vercel Cron behaviour was fetched from `https://vercel.com/docs/cron-jobs` and
`https://vercel.com/docs/cron-jobs/manage-cron-jobs`. Next.js route-handler
conventions were read from
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

### Verified Oxylabs Scheduler API surface

Base URL `https://data.oxylabs.io`. Basic auth on every call.

| Call | Method + path | Body / notes |
| --- | --- | --- |
| Create schedule | `POST /v1/schedules` | `{"cron": "...", "items": [...], "end_time": "YYYY-MM-DD HH:MM:SS"}`. All three fields required. |
| List schedules | `GET /v1/schedules` | → `{"schedules": ["168110763619310929", ...]}` (strings) |
| Schedule info | `GET /v1/schedules/{id}` | → `schedule_id`, `active`, `items_count`, `cron`, `end_time`, `next_run_at`, `links`, `stats` |
| Jobs | `GET /v1/schedules/{id}/jobs` | Flat array of job ids, **no status — do not use** |
| Runs | `GET /v1/schedules/{id}/runs` | → `{"runs": [{"run_id": …, "jobs": [{"id": …, "create_status_code": 202, "result_status": "done", "created_at": "…", "result_created_at": "…"}], "success_rate": 1.0}]}` |
| Set state | `PUT /v1/schedules/{id}/state` | `{"active": false}` → `202`, empty body |
| Job result | `GET /v1/queries/{job_id}/results` | → `{"results": [{"content": "<!doctype html>…", "status_code": 200, …}], "job": {…}}` |

There is no documented delete endpoint, which is exactly why section 18 requires
orphan **deactivation** via `PUT /state` rather than deletion.

The create response is verbatim:

```json
{ "schedule_id": 168110763619310929, "active": true, "items_count": 2, ... }
```

`schedule_id` is an **unquoted 18-digit integer**, and in `/runs` each job `id`
is an **unquoted 19-digit integer**. Both exceed `Number.MAX_SAFE_INTEGER`
(9007199254740991, 16 digits). `JSON.parse` silently rounds them. This is the
single most dangerous part of this task and section 18 calls it out explicitly.

---

## 3. Existing code inspected

- `lib/pipeline/scrape.ts` — the canonical scrape-to-insert pipeline. Its own
  header comment already says: *"The Oxylabs Scheduler task (section 18) reuses
  these same steps and differs only in where the homepage HTML comes from — it
  must not duplicate this logic."* `scrapeSource` today fetches the homepage
  live and then performs steps 3–8; `runScrape` owns source selection, the
  `Totals`/rejection tallies, `forEachConcurrently`, and the summary object.
- `lib/pipeline/types.ts` — `RejectionReason`, `ScrapeStatus`, `SourceOutcome`,
  `ScrapeSummary`, `ScrapeOptions`, plus the analysis equivalents.
- `lib/pipeline/run-logger.ts` — `createRunLogger(scope)`; `scope` is free text
  and `lib/supabase/types.ts` already types `LogScope` as
  `"scrape" | "analyze" | "scheduler" | "cron"`. Both new scopes already exist.
- `lib/pipeline/analyze.ts` — `runAnalysis(options: AnalyzeOptions)`, where `{}`
  means "every pending article" via the LEFT-JOIN pending check.
- `lib/oxylabs/client.ts` — `fetchPageHtml(url, { render })` against
  `realtime.oxylabs.io`, `OxylabsError`, `requireEnv`, `authorizationHeader()`,
  and `apiErrorMessage`. Credentials are read here and nowhere else.
- `lib/api/admin.ts` — `requireAdminSecret(request)` with a constant-time
  `secretsMatch` and fail-closed behaviour when `BIASLY_ADMIN_SECRET` is unset.
- `lib/supabase/types.ts` — `oxylabs_schedules` and `oxylabs_schedule_runs` are
  **already fully typed**, with `schedule_id` and `job_id` as `string`, and the
  comment "Text, not a number: 64-bit id, AGENTS.md section 18."
- `supabase/schema.sql` — both Scheduler tables already exist, with
  `oxylabs_schedules.source_id` unique, `schedule_id` unique text,
  `oxylabs_schedule_runs` unique on `(schedule_id, job_id)`, a `processed_at`
  index, RLS enabled, `anon`/`authenticated` revoked, `service_role` granted.
  **No schema change is needed for this task.**
- `lib/supabase/queries/articles.ts` — `findExistingUrls` (already chunked at
  `URL_EXISTENCE_CHUNK_SIZE = 15`) and the per-row append-only `insertArticle`
  returning `null` on a `23505` conflict.
- `lib/supabase/queries/sources.ts` — `getActiveSources`,
  `getActiveSourcesByNames`.
- `lib/scraping/limits.ts` — every tunable, `PARSER_STRATEGIES`,
  `toParserStrategy`, `DEFAULT_ARTICLES_PER_SOURCE = 5`,
  `SOURCE_CONCURRENCY = 3`, the two Oxylabs timeouts.
- `app/api/scrape/route.ts` and `app/api/analyze/route.ts` — the thin-handler
  shape to copy: `maxDuration = 300`, admin guard, tolerant empty-body parse,
  Zod `safeParse` with `z.flattenError`, PostHog capture + `captureException`,
  generic 500 body with details on the server console.
- `proxy.ts` — Clerk middleware protects `/news(.*)` only; `/api` is
  deliberately unprotected so machine callers are not blocked.
- `supabase/seed.sql` — the five seeded sources (Reuters, NPR, BBC News, Fox
  News, The Guardian), homepage entry pages only.
- `.env.example` — the canonical variable list; `CRON_SECRET` is not there yet.

---

## 4. Decisions and assumptions

**D1 — Reuse by extraction, not by copying.** `lib/pipeline/scrape.ts` steps 3–8
move verbatim into a new `lib/pipeline/source-run.ts` as
`processSourceHtml(source, html, perSource, totals, rejections, log)`, together
with `forEachConcurrently`, `Totals`, `emptyTotals` and `messageOf`. `scrape.ts`
keeps step 2 (live homepage fetch with the render retry) and calls
`processSourceHtml`; the Scheduler calls the same function with job HTML. This
is the only way to honour "do not duplicate pipeline logic inside Scheduler"
without the Scheduler importing from the manual-scrape module. Manual scraping's
observable behaviour is unchanged.

**D2 — Large-integer safety.** A single helper,
`parseOxylabsJson<T>(text): T` in `lib/oxylabs/json.ts`, runs a regex over the
**raw response text** that wraps every unquoted integer literal of 16 or more
digits in quotes, then calls `JSON.parse`. 16 is the first digit-length that can
exceed `Number.MAX_SAFE_INTEGER`, and every small field in these payloads
(`run_id` ≈ 9 digits, `create_status_code` = 202, `items_count`, `success_rate`)
is far below it, so nothing else is touched. The regex only matches a literal in
value position (preceded by `:` or `[` or `,` and followed by `,`/`}`/`]`), so
digits inside a string — a timestamp, a URL, HTML content — are never rewritten.
Every Scheduler response goes through this helper; `JSON.parse` is never called
directly on a Scheduler payload, and a parsed number is never stringified back.

**D3 — One schedule per active source.** Section 18 says the sync route "creates
one Oxylabs schedule per active source", and `oxylabs_schedules.source_id` is
unique, which only makes sense one-to-one. Each schedule carries a single item:
`{source: "universal", url: <listing_url>, user_agent_type: "desktop_chrome",
geo_location: "United States"}` — the same shape `fetchPageHtml` sends, so
scheduled HTML matches manual HTML. `render` is **not** set: scheduled runs
cannot be retried with rendering, and all five seeded sources server-render
their markup.

**D4 — Oxylabs cron `0 11 * * *`, Vercel cron `0 12 * * *` (revised).** Section
18 specifies hourly Oxylabs runs with the Vercel cron 15 minutes behind, and
that is what shipped first. It was revised after deployment failed: Vercel's
Hobby plan refuses any cron running more than once per day. Two Hobby limits
drove the new values, both from
`https://vercel.com/docs/cron-jobs/usage-and-pricing`:

- *Minimum interval: once per day.* `15 * * * *` fails deployment outright, so
  both sides move to daily. Oxylabs is moved too, not just Vercel: an hourly
  Oxylabs schedule with a daily collector would bill for 24 jobs per source per
  day and discard 23 of them.
- *Scheduling precision: per-hour (±59 min).* A Hobby cron set to `0 12 * * *`
  fires anywhere in 12:00-12:59, so section 18's 15-minute offset would
  guarantee nothing - Vercel could fire before Oxylabs started. The gap is a
  full hour instead: worst case still leaves Oxylabs an hour, best case two.

11:00 UTC is 07:00 US Eastern, so the single daily pass sees a fresh homepage.
Both values stay named constants in `lib/scraping/limits.ts`. On Pro, restore
`0 * * * *` / `15 * * * *` and re-run the sync route, which now recreates any
schedule whose cron has drifted (D16).

**D5 — `end_time` is required by the API, so it is computed, not configured.**
`SCHEDULE_END_TIME_YEARS = 5` from creation time, formatted as UTC
`YYYY-MM-DD HH:MM:SS`. Re-running sync does not extend an existing schedule; it
is a create-time value only.

**D6 — Backlog policy: process the newest done job per schedule, mark older
unprocessed done jobs superseded.** One Oxylabs run per schedule per hour and
one cron pass per hour means the steady state is exactly one new job. But the
first pass after a sync (or after any missed cron) can find several. Fetching
every one of them re-scrapes the same homepage repeatedly for strictly staler
link sets that dedupe would throw away, and burns Oxylabs result calls the
project is paying for. So: within one schedule, the newest unprocessed `done`
job is fetched and processed; older unprocessed `done` jobs get
`processed_at = now()` with `articles_inserted = 0` and a
`Job superseded` log line, without being fetched. Nothing is lost — a homepage
the older snapshot showed and the newer one does not is already in the DB from
the previous pass, or was never picked up because the pipeline had not run yet,
in which case it has also aged off the homepage and is no longer "news".
`MAX_JOBS_PER_SCHEDULE_PER_RUN = 1` is a named constant, so raising it is a
one-line change.

**D7 — `result_status` filtering is strict.** Only `result_status === "done"` is
ever fetched, per section 18. `pending` jobs are recorded and left unprocessed so
the next pass picks them up; `faulted` jobs are recorded, counted, and marked
`processed_at = now()` so they are never retried forever. `/jobs` is never
called anywhere in this implementation.

**D8 — Orphan sweep runs after creation and compares against the DB.** Exactly
section 18's three steps: create new schedules → `GET /v1/schedules` → for every
Oxylabs id absent from `oxylabs_schedules.schedule_id`, `PUT /state
{"active": false}`. Additionally, a schedule row whose source is no longer
active is deactivated on Oxylabs and its row set `is_active = false` — it stays
in the DB precisely so the orphan sweep does not treat it as unknown and so a
reactivated source is not charged for a second schedule. This is the only
behaviour beyond the literal three steps, and it directly serves section 7's
"only active sources should be used for scraping and scheduling".

**D9 — Cron secret check skipped outside production.** Section 18: "In local
development, skip the secret check so the route can be tested manually", and "Do
not add `CRON_SECRET` to `.env.local`." The guard returns early when
`process.env.NODE_ENV !== "production"`, logging that it did so. In production a
missing `CRON_SECRET` fails **closed** with a 500, mirroring
`requireAdminSecret`. The comparison is constant-time against the exact string
`Bearer ${CRON_SECRET}`, which is the format Vercel sends.

**D10 — The constant-time compare is shared, not duplicated.** `secretsMatch`
moves from `lib/api/admin.ts` into `lib/api/secrets.ts`; `admin.ts` and the new
`cron.ts` both import it. `requireAdminSecret`'s behaviour is unchanged.

**D11 — Step two always runs.** Section 18 rule 6. `runCronPipeline` wraps step
one in its own try/catch, records the error into the summary, and then runs
`runAnalysis({})` regardless. Only a failure of *both* steps makes the route
answer `500`.

**D12 — Vercel Hobby cannot run `15 * * * *`. (Confirmed in practice.)** The
live Vercel docs said Hobby crons "can only run once per day. Expressions that
run more frequently will fail deployment", and the deployment did fail with
exactly that error. Resolved by D4 rather than by upgrading the plan: the
project stays on the free tier and both crons run daily.

**D16 — Cron drift is reconciled by recreating the schedule.** Changing
`SCHEDULE_CRON_EXPRESSION` does nothing to schedules that already exist, and
Oxylabs exposes no endpoint for editing a schedule's cron - only
`PUT /state`. So when a stored row's `cron_expression` differs from the
configured one, the sync route deactivates the old Oxylabs schedule, deletes
its row and creates a replacement, reporting the count as
`schedulesRecreated`. The row is deleted rather than kept because
`oxylabs_schedules.source_id` is unique, so a source cannot hold two rows; the
retired schedule's `oxylabs_schedule_runs` history cascades away with it, which
is correct - it describes a schedule that no longer exists. Without this,
switching to a daily cadence would leave five schedules billing hourly for ever.

**D13 — Read routes carry no admin secret.** `GET /api/oxylabs/schedules` and
`GET /api/oxylabs/runs` follow `GET /api/sources`: read-only, no secret,
returning only ids, names, cron strings, statuses and counts — never a
credential. Section 15 governs routes that "start or mutate work", which these
do not.

**D14 — `perSource` for scheduled runs.** `DEFAULT_ARTICLES_PER_SOURCE` (5), the
same default manual scraping uses. The manual process route accepts an optional
`perSource` override; the cron route does not take input at all.

**D15 — No schema or type changes.** Both Scheduler tables and both row types
already exist and already match this design. `supabase/schema.sql` and
`lib/supabase/types.ts` are read, confirmed, and left alone. `.env.example` gains
a documentation-only `CRON_SECRET` block (commented out, explaining it is
Vercel-injected and must not be set locally) so it stays in sync with the
section 21 table.

---

## 5. Files likely to change

**New**

| File | Contents |
| --- | --- |
| `lib/oxylabs/json.ts` | `parseOxylabsJson<T>` — the big-integer-safe raw-text parser (D2) |
| `lib/oxylabs/scheduler.ts` | Scheduler + Push-Pull client: `createSchedule`, `listScheduleIds`, `getScheduleRuns`, `setScheduleState`, `fetchJobResultHtml` |
| `lib/supabase/queries/schedules.ts` | Schedule and run-row reads/writes |
| `lib/pipeline/source-run.ts` | The shared per-source pipeline steps 3–8 extracted from `scrape.ts` (D1) |
| `lib/pipeline/scheduler.ts` | `syncSchedules()` and `runScheduledProcessing()` |
| `lib/pipeline/cron.ts` | `runCronPipeline()` — step one then step two (D11) |
| `lib/api/secrets.ts` | The shared constant-time `secretsMatch` (D10) |
| `lib/api/cron.ts` | `requireCronSecret(request)` (D9) |
| `app/api/oxylabs/schedules/route.ts` | `POST` sync + `GET` list |
| `app/api/oxylabs/scheduled-results/process/route.ts` | `POST` manual process |
| `app/api/oxylabs/runs/route.ts` | `GET` stored run rows |
| `app/api/cron/pipeline/route.ts` | `GET`, `CRON_SECRET`-protected |
| `vercel.json` | The `15 * * * *` cron registration |

**Changed**

| File | Change |
| --- | --- |
| `lib/pipeline/scrape.ts` | Steps 3–8 move out to `source-run.ts`; keeps source selection, live homepage fetch + render retry, summary. No behaviour change. |
| `lib/pipeline/types.ts` | Adds `SyncSchedulesSummary`, `ScheduledProcessingSummary`, `CronPipelineSummary` and their options types |
| `lib/scraping/limits.ts` | Adds the Scheduler constants |
| `lib/api/admin.ts` | Imports `secretsMatch` from `lib/api/secrets.ts` instead of defining it |
| `.env.example` | Documentation-only `CRON_SECRET` block |

**Read, confirmed unchanged:** `supabase/schema.sql`, `lib/supabase/types.ts`,
`app/api/scrape/route.ts`, `app/api/analyze/route.ts`, `proxy.ts`, every UI file.

---

## 6. Implementation requirements

### 6.1 `lib/oxylabs/json.ts`

- `server-only`.
- Export `parseOxylabsJson<T>(text: string, context: string): T`.
- Rewrite unquoted integer literals of **16 or more digits** in value position
  into quoted strings, operating on the raw text, then `JSON.parse`.
- A parse failure throws `OxylabsError` naming `context`, never the body.
- A header comment stating why: `schedule_id` is 18 digits, job `id` is 19,
  `Number.MAX_SAFE_INTEGER` is 16 digits, `JSON.parse` corrupts both silently,
  and AGENTS.md section 18 forbids recovering an id from a parsed number.

### 6.2 `lib/oxylabs/scheduler.ts`

- `server-only`. Base `https://data.oxylabs.io`.
- Reuse the Basic-auth header builder and `OxylabsError` from
  `lib/oxylabs/client.ts` — export them from there rather than re-reading the
  credentials in a second module. Credentials stay read in exactly one place.
- One private `request(method, path, body?)` that returns the **raw response
  text**, applies `AbortSignal.timeout(OXYLABS_SCHEDULER_TIMEOUT_MS)`, maps
  non-2xx to `OxylabsError` via the existing `apiErrorMessage` shape, and never
  logs or returns a credential.
- `createSchedule({ cron, items, endTime }): Promise<string>` — `POST
  /v1/schedules`. Extract `schedule_id` from the **raw text** with
  `/"schedule_id"\s*:\s*"?(\d+)"?/` and return the captured digits. Throw if the
  field is absent.
- `listScheduleIds(): Promise<string[]>` — `GET /v1/schedules`, via
  `parseOxylabsJson`, reading `schedules`. Coerce each entry with `String()`
  only if it is already a string; the parser guarantees that.
- `getScheduleRuns(scheduleId): Promise<ScheduleRun[]>` — `GET
  /v1/schedules/{id}/runs`, via `parseOxylabsJson`. Shape:
  `{ runId: string; jobs: { id: string; resultStatus: string | null; createdAt: string | null }[] }[]`.
- `setScheduleState(scheduleId, active): Promise<void>` — `PUT
  /v1/schedules/{id}/state` with `{ active }`. Accept `202` and an empty body.
- `fetchJobResultHtml(jobId): Promise<string>` — `GET
  /v1/queries/{jobId}/results`, via `parseOxylabsJson`, returning
  `results[0].content`. Reject a non-string or empty `content`, and reject a
  `results[0].status_code` outside 2xx with the same "target site returned N"
  message style `client.ts` uses.
- A comment at the top of the module stating that `/jobs` is deliberately not
  implemented: it returns ids with no status, so there is no way to know a job
  is `done` (AGENTS.md section 18).

### 6.3 `lib/scraping/limits.ts`

Add, each with a comment:

- `SCHEDULE_CRON_EXPRESSION = "0 * * * *"` — Oxylabs, top of every hour.
- `CRON_PIPELINE_SCHEDULE = "15 * * * *"` — must match `vercel.json`.
- `SCHEDULE_END_TIME_YEARS = 5`.
- `OXYLABS_SCHEDULER_TIMEOUT_MS = 30_000` — Scheduler control-plane calls are
  small JSON, unlike a page fetch.
- `OXYLABS_RESULT_TIMEOUT_MS = 60_000` — a job result is a full homepage.
- `MAX_JOBS_PER_SCHEDULE_PER_RUN = 1` (D6).
- `MAX_RUNS_LOOKBACK = 20` — most recent runs considered per schedule.

### 6.4 `lib/supabase/queries/schedules.ts`

`server-only`, service-role client, `unwrap` for errors. No
`.eq('foreignTable.column', …)` anywhere — joined conditions are applied in
JavaScript (AGENTS.md section 21).

- `getSchedules(): Promise<OxylabsScheduleRow[]>` — all rows, newest first.
- `getSchedulesWithSources()` — schedules with `sources ( id, name, listing_url,
  parser_strategy, is_active, logo_url )` embedded; flatten the embed with the
  same `firstOrNull` pattern `articles.ts` uses; **filter on the source's
  `is_active` in JS**.
- `insertSchedule({ source_id, schedule_id, cron_expression })` — sets
  `last_synced_at = now()`.
- `touchSchedule(scheduleId)` — updates `last_synced_at`.
- `setScheduleRowActive(scheduleId, isActive)`.
- `recordScheduleRun({ schedule_id, job_id, result_status, run_at })` — upsert
  on the existing `(schedule_id, job_id)` unique constraint, updating
  `result_status`; must never clear `processed_at`.
- `markRunProcessed(scheduleId, jobId, articlesInserted)` — sets
  `processed_at = now()` and `articles_inserted`.
- `getUnprocessedRuns(scheduleId)` — rows with `processed_at is null`.
- `getRecentRuns(limit)` — newest run rows for `GET /api/oxylabs/runs`.

### 6.5 `lib/pipeline/source-run.ts` (the extraction, D1)

Move out of `scrape.ts`, unchanged in behaviour:

- `Totals`, `emptyTotals()`, `messageOf()`, `forEachConcurrently()`.
- `processSourceHtml(source, html, perSource, totals, rejections, log):
  Promise<SourceOutcome>` — sections 9 steps 3–8: `extractCandidateLinks` →
  `checkCandidateUrl` → `findExistingUrls` → concurrent detail fetch →
  `extractArticle` + `validateArticle` → `insertArticle`. The reserved-slot
  concurrency guard and every existing log line come across verbatim.
- Module header: this is the one implementation of section 9's per-source steps;
  manual scraping and Scheduler processing both call it, and neither may fork it.

`scrape.ts` then keeps `scrapeSource` as: log source start → `fetchPageHtml` →
render retry when zero candidates → `processSourceHtml`, plus `runScrape`
unchanged. Manual `POST /api/scrape` output must be byte-identical in shape.

### 6.6 `lib/pipeline/scheduler.ts`

`server-only`. Two entry points, both returning a typed summary and both using
`createRunLogger("scheduler")`.

**`syncSchedules(): Promise<SyncSchedulesSummary>`**

1. Load active sources and all `oxylabs_schedules` rows.
2. For each active source **without** a row: `createSchedule` with
   `SCHEDULE_CRON_EXPRESSION`, the single `universal` item (D3) and the computed
   `end_time` (D5); insert the row with the exact `schedule_id` string; log
   `Schedule created: <source> (<schedule_id>)`. A per-source failure is
   recorded and the loop continues.
3. For each active source **with** a row: `touchSchedule`, log
   `Schedule exists: <source>`.
4. For each row whose source is inactive or missing: `setScheduleState(id,
   false)` then `setScheduleRowActive(id, false)`; log `Schedule deactivated
   (source inactive)`.
5. **Orphan sweep (section 18):** `listScheduleIds()`; for every Oxylabs id not
   present in `oxylabs_schedules.schedule_id`, `setScheduleState(id, false)`;
   log `Orphan schedule deactivated: <id>` and count it.
6. Summary: `status`, `runId`, `activeSources`, `schedulesCreated`,
   `schedulesExisting`, `schedulesDeactivated`, `orphansDeactivated`,
   `durationMs`, `errors[]`, and `schedules[{ source, scheduleId, cron,
   created }]`. Log it with `log.summary`.

**`runScheduledProcessing(options): Promise<ScheduledProcessingSummary>`**

1. `getSchedulesWithSources()`, keeping active schedule rows whose source is
   active. Log `Scheduled processing started` with the schedule count.
2. Per schedule, at `SOURCE_CONCURRENCY` via `forEachConcurrently`:
   - `getScheduleRuns(scheduleId)`, take the most recent `MAX_RUNS_LOOKBACK`.
   - `recordScheduleRun` for **every** job seen, so the run table is a complete
     record regardless of status.
   - Partition the unprocessed jobs by `result_status`: `done`, `pending`
     (leave alone, count), `faulted`/other (mark processed, count, log a
     warning — D7).
   - Sort `done` jobs newest-first by `createdAt`; take
     `MAX_JOBS_PER_SCHEDULE_PER_RUN`; mark the remainder processed with
     `articles_inserted = 0` and a `Job superseded` line (D6).
   - For the selected job: `fetchJobResultHtml(jobId)`, log
     `Job result fetched: <source>`, then **`processSourceHtml`** with the
     source row, the job HTML and `perSource`. Zero candidates logs a warning
     — a scheduled job cannot be re-fetched with rendering (D3).
   - `markRunProcessed(scheduleId, jobId, outcome.articlesInserted)`.
   - A throw anywhere in a schedule is caught, recorded as a source error, and
     the run continues.
3. Summary: the full `ScrapeSummary` field set (`status`, `runId`,
   `sourcesChecked`, `candidatesFound`, `candidatesRejected`,
   `duplicatesSkipped`, `detailPagesScraped`, `articlesInserted`,
   `articlesRejected`, `articlesFailed`, `durationMs`, `rejectionReasons`,
   `sourceErrors`, `sources`) plus `schedulesChecked`, `jobsDone`,
   `jobsProcessed`, `jobsSuperseded`, `jobsPending`, `jobsFaulted`. Same run
   logging as manual scraping, because it is the same code.
4. Raw scheduled homepage HTML is never inserted as an article — it only ever
   reaches `extractCandidateLinks`.

### 6.7 `lib/pipeline/cron.ts`

`runCronPipeline(): Promise<CronPipelineSummary>` with
`createRunLogger("cron")`:

1. Log `Cron pipeline started`.
2. Step one: `runScheduledProcessing` in its own try/catch. On throw, record
   `processingError` and log an error — **do not return**.
3. Step two: `runAnalysis({})` — always, per section 18 rule 6, because
   pre-existing unanalyzed articles may be waiting. Its own try/catch records
   `analysisError`.
4. `status`: `completed` when both succeeded cleanly; `completed_with_errors`
   when one failed or either sub-summary is itself not `completed`; `failed`
   only when **both** threw.
5. Summary object `{ status, runId, processing, processingError, analysis,
   analysisError, durationMs }`, logged with `log.summary`, and a closing
   `Cron pipeline completed` / `... completed with errors` line.

### 6.8 `lib/api/secrets.ts` and `lib/api/cron.ts`

- `secrets.ts`: `server-only`, exports `secretsMatch(provided, expected)` —
  the existing length-guarded `timingSafeEqual`, moved verbatim.
- `cron.ts`: `requireCronSecret(request): NextResponse | null`.
  - `process.env.NODE_ENV !== "production"` → log
    `CRON_SECRET check skipped (non-production)` and return `null` (D9).
  - Unset `CRON_SECRET` in production → console error + `500`, fail closed.
  - Compare `request.headers.get("authorization")` against
    `` `Bearer ${secret}` `` with `secretsMatch`; mismatch or missing → `401`
    with a generic body.
  - Never log the header or the expected value.

### 6.9 Routes

All four are thin handlers (AGENTS.md section 5) with `maxDuration = 300` where
they run a pipeline, PostHog capture mirroring `app/api/scrape/route.ts`, a
generic 500 body, and details only on the server console.

**`app/api/oxylabs/schedules/route.ts`**
- `POST` — `requireAdminSecret` → `syncSchedules()` → the summary; `500` when
  `status === "failed"`.
- `GET` — `getSchedules()` → `{ schedules: [{ schedule_id, source_id,
  cron_expression, is_active, last_synced_at, created_at }] }`. No secret (D13).

**`app/api/oxylabs/scheduled-results/process/route.ts`**
- `POST` only. `requireAdminSecret`. Tolerant empty-body parse, then Zod
  `{ perSource?: number }` bounded by `MAX_ARTICLES_PER_SOURCE`, defaulting to
  `DEFAULT_ARTICLES_PER_SOURCE`. Delegates to `runScheduledProcessing`.

**`app/api/oxylabs/runs/route.ts`**
- `GET` only. Optional `?limit=` (Zod-coerced, 1–200, default 50) →
  `getRecentRuns`. No secret (D13).

**`app/api/cron/pipeline/route.ts`**
- `GET` only, because Vercel Cron always sends GET (section 14's one exception).
- `requireCronSecret` first, before anything else runs.
- `export const maxDuration = 300;` and `export const dynamic =
  "force-dynamic";` so the response is never served from a cache.
- `runCronPipeline()`; `500` when `status === "failed"`, otherwise `200`.
- A module comment: internal only, not callable by browsers or users, protected
  by `CRON_SECRET` and **not** by `BIASLY_ADMIN_SECRET` (section 18).

### 6.10 `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/pipeline", "schedule": "15 * * * *" }]
}
```

Must stay equal to `CRON_PIPELINE_SCHEDULE`. Vercel cron timezone is always UTC.

### 6.11 `.env.example`

Append a commented block: `CRON_SECRET` protects `GET /api/cron/pipeline`, is
set in **Vercel project settings only**, is injected automatically as
`Authorization: Bearer <value>` on every cron invocation, must **not** be added
to `.env.local`, and is skipped entirely in local development.

---

## 7. Security requirements

- `lib/oxylabs/scheduler.ts`, `lib/oxylabs/json.ts`, `lib/pipeline/*`,
  `lib/supabase/queries/schedules.ts`, `lib/api/cron.ts` and `lib/api/secrets.ts`
  all start with `import "server-only"`.
- Oxylabs credentials are read in `lib/oxylabs/client.ts` and nowhere else; the
  Scheduler client imports the header builder rather than reading the env vars
  again. No credential is logged, returned, or placed in a URL.
- Scraping, Oxylabs calls, model calls and scheduler processing never run from
  browser code. No new client component, hook or server action is added.
- `POST /api/oxylabs/schedules` and
  `POST /api/oxylabs/scheduled-results/process` require
  `x-biasly-admin-secret`; the secret is header-only, never a query parameter,
  and a missing or wrong value returns `401` (section 15).
- `GET /api/cron/pipeline` is protected by `CRON_SECRET` only — never by
  `BIASLY_ADMIN_SECRET`, and `CRON_SECRET` is never added to `.env.local`
  (section 18). Fail closed in production when it is unset.
- Both secret comparisons are constant-time and never reveal which half failed.
- Error responses carry a generic message; stack traces, PostgREST messages and
  Oxylabs bodies go to the server console only.
- `GET /api/oxylabs/schedules` and `GET /api/oxylabs/runs` expose ids, cron
  strings, statuses and counts — no credential, no HTML, no raw job payload.
- No table is read or written with anything but the service-role client; RLS
  stays enabled with no policies, exactly as `schema.sql` has it.

---

## 8. Acceptance criteria

1. `POST /api/oxylabs/schedules` creates one Oxylabs schedule per active source
   and stores an 18-digit `schedule_id` whose digits match the Oxylabs dashboard
   **exactly**, with no trailing-digit corruption.
2. Re-running the sync route creates nothing new and reports the existing
   schedules; it does not double-charge the account.
3. After a sync, `GET /v1/schedules` on Oxylabs contains no active schedule that
   is absent from `oxylabs_schedules` — orphans are deactivated via
   `PUT /state`.
4. `GET /api/oxylabs/schedules` returns the stored rows.
5. `POST /api/oxylabs/scheduled-results/process` reads runs via `/runs`, never
   `/jobs`, fetches results only for `result_status === "done"` jobs, and inserts
   valid articles through the same validation, cleanup, dedupe and URL-existence
   path as manual scraping.
6. No source homepage, listing or category page is ever stored as an article,
   and no article is deleted, replaced or reset.
7. `oxylabs_schedule_runs` gains one row per job seen, with `processed_at` set
   exactly once per job and `articles_inserted` recorded.
8. Running the process route twice in a row inserts nothing the second time —
   the second pass reports the jobs already processed.
9. `GET /api/oxylabs/runs` returns those rows newest-first.
10. `GET /api/cron/pipeline` runs processing then analysis, and analysis still
    runs when processing fails.
11. In production, `GET /api/cron/pipeline` without the correct
    `Authorization: Bearer $CRON_SECRET` returns `401`; locally the check is
    skipped so the route can be tested by hand.
12. `POST` to either action route without `x-biasly-admin-secret` returns `401`.
13. `vercel.json` registers `/api/cron/pipeline` on `15 * * * *`.
14. `POST /api/scrape` and `POST /api/analyze` behave exactly as before; their
    response shapes are unchanged.
15. Scheduler runs emit the section 9 run logging to the console and a final
    summary object, the same way manual scraping does.
16. `npm run typecheck`, `npm run lint` and `npm run build` all pass.

---

## 9. Checks to run

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `eslint`
- `npm run build` — required here: new routes, new server modules and a new
  `vercel.json` all affect the build

Exact output reported; no check claimed as passing without running it.

---

## 10. Manual test steps

No schema change is needed — `oxylabs_schedules` and `oxylabs_schedule_runs`
already exist in `supabase/schema.sql`. Confirm they are present in Supabase
Dashboard → SQL Editor before starting:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('oxylabs_schedules', 'oxylabs_schedule_runs');
```

Start the dev server and **watch its terminal** — all scrape, scheduler and
analysis progress is logged there (AGENTS.md section 17):

```bash
npm run dev
```

In a second terminal:

```bash
export ADMIN="$(grep '^BIASLY_ADMIN_SECRET=' .env.local | cut -d= -f2-)"
```

**1. Confirm the active sources**

```bash
curl -s http://localhost:3000/api/sources | jq '.sources[].name'
```

**2. Create the Oxylabs schedules (one-time setup #1)**

```bash
curl -s -X POST http://localhost:3000/api/oxylabs/schedules \
  -H "x-biasly-admin-secret: $ADMIN" | jq
```

Expect `schedulesCreated` equal to the active-source count on the first call and
`0` with `schedulesExisting` on a second call.

**3. Verify the schedule ids are not corrupted**

```bash
curl -s http://localhost:3000/api/oxylabs/schedules | jq '.schedules[].schedule_id'

curl -s -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  https://data.oxylabs.io/v1/schedules | jq
```

Every id stored must appear character-for-character in the Oxylabs list. A
trailing digit that differs means the big-integer handling is broken.

**4. Reject a call with no admin secret**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/oxylabs/schedules
```

Expect `401`.

**5. Wait for Oxylabs to run (top of the hour), then process the results**

```bash
curl -s -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
  -H "x-biasly-admin-secret: $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"perSource": 5}' | jq
```

Watch the dev-server terminal for the per-source pipeline lines and the final
summary. Before the first Oxylabs run completes, expect `jobsDone: 0` and
`articlesInserted: 0` — that is correct, not a failure.

**6. Inspect the recorded runs**

```bash
curl -s 'http://localhost:3000/api/oxylabs/runs?limit=20' | jq
```

**7. Confirm idempotency**

Run step 5 again immediately. Expect `jobsProcessed: 0` and
`articlesInserted: 0`.

**8. Run the full cron pipeline locally (the secret check is skipped in dev)**

```bash
curl -s http://localhost:3000/api/cron/pipeline | jq
```

Both steps must appear in the terminal: scheduled-result processing, then AI
analysis. Articles reach the home page only once `analyzed_at` is set, so this
is the step that makes them visible.

**9. Confirm the cron route is GET-only**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/cron/pipeline
```

Expect `405`.

**10. See the result**

Open `http://localhost:3000` — newly inserted and analyzed articles appear in
the feed.

**11. Deploy-time setup #2 (Vercel Cron)**

`vercel.json` is committed with `15 * * * *`. In Vercel → Project → Settings →
Environment Variables, add `CRON_SECRET` (a random string of at least 16
characters) for Production, then deploy. Verify in Settings → Cron Jobs that
`/api/cron/pipeline` is listed, and use **Run** / **View Logs** there to confirm
an invocation. In production only:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-app>/api/cron/pipeline
# 401 without the header

curl -s https://<your-app>/api/cron/pipeline \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

**Vercel plan note (D12):** on the Hobby plan, cron jobs may only run once per
day and a more frequent expression **fails the deployment**. The hourly
`15 * * * *` schedule AGENTS.md section 18 requires needs a Pro team; on Hobby,
change `vercel.json` to a daily expression such as `15 9 * * *`. Everything
else — the Oxylabs hourly schedules, both manual routes and local cron
testing — works identically either way.

Creating the Oxylabs schedules (step 2) and configuring Vercel Cron (step 11)
are two independent one-time setups. Neither triggers the other, and both must
be done for the pipeline to be fully automatic.
