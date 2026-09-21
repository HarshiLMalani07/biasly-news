# Prompt: biasly AI Article Analysis Pipeline

## Goal

Build the AI analysis stage of AGENTS.md section 19: `POST /api/analyze` finds every stored
article that has no `article_analyses` row, sends its text to OpenAI through the Vercel AI SDK,
validates the model output with Zod, saves one analysis row per article, and only then stamps
`articles.analyzed_at`. Analysed articles are what the home feed and the news details page already
read, so this is the stage that makes the UI show real data.

Concretely:

1. `lib/ai/limits.ts` — every tunable number and the model id, in one place.
2. `lib/ai/analysis-schema.ts` — the Zod schema the model output is validated against.
3. `lib/ai/prompt.ts` — the system prompt, the per-article user prompt, the stored disclaimer.
4. `lib/ai/analyze-article.ts` — one `server-only` OpenAI call per article, with one retry.
5. `lib/pipeline/analyze.ts` — the orchestrator: pending detection, batching, logging, summary.
6. `lib/pipeline/types.ts` — `AnalyzeOptions`, `AnalyzeSummary`, `AnalysisFailureReason`.
7. `lib/supabase/queries/analyses.ts` — a lighter pending-analysis scan plus `getArticlesByIds`.
8. `app/api/analyze/route.ts` (POST) — a thin handler only.
9. `package.json` — pin `ai` and `@ai-sdk/openai`; `.env.example` — add the OpenAI and batch rows.

This task builds **AI analysis only**. It adds **no** embeddings and no pgvector (AGENTS.md
section 20 — the `embedding` column is deliberately still absent from `supabase/schema.sql`), no
Oxylabs Scheduler, no Vercel Cron, no `/api/logs` route, and **no UI changes**: `lib/articles/*`,
`lib/supabase/mappers.ts` and every component under `components/` already render an analysis and
need no edit. No Supabase schema change is required — `article_analyses` already has every column
section 19 lists, with the check constraints that mirror its output rules.

## Skills read

- `AGENTS.md` — sections 1 (AI article analysis is in scope; "Do not overbuild"), 2 (workflow:
  prompt first, implement after approval), 3 (`ai-sdk` for "Vercel AI SDK and OpenAI provider
  usage, model calls, AI analysis output handling"; `supabase` for queries and logs), 5 (layer
  separation — thin route handler, AI layer separate from Pipeline and Database layers; "UI must
  display stored data only"), 6 (stack: Vercel AI SDK, OpenAI provider, Zod), 7 (the
  `article_analyses` column list and `bias_score = (right − left) / 100`; "The `embedding
  vector(1536)` column is added … in section 20 … Do not include it in the initial schema"), 14
  (`POST /api/analyze`; "Do not switch scraping or AI analysis between `GET` and `POST`"), 15 (the
  `x-biasly-admin-secret` header, `BIASLY_ADMIN_SECRET`, never in the query string, never in
  browser code, `401` on missing/invalid), **19** (the whole section: the **pending-analysis
  check** by LEFT JOIN and never `analyzed_at IS NULL` alone; "Default behavior should process all
  pending valid articles"; "Do not analyze only 10 total articles unless the user explicitly asks
  for 10"; "Do not hardcode analysis to: latest scrape only, specific article IDs, specific
  sources, a fixed one-time batch"; "Batching is allowed only to avoid timeouts"; the field-to-
  column mapping; the framing output rules including the 0–100 percentages that "must add up to
  100", the five allowed labels, "The label should match the strongest percentage unless confidence
  is low or percentages are close", "If evidence is weak, use `unclear` and keep confidence low",
  "Use article text evidence only. Do not infer based on source name alone", "Validate AI output
  with Zod or equivalent before saving", "If output is invalid, retry once or mark the article as
  failed without saving bad analysis"; required behaviour rules 1–9 including "Mark `analyzed_at`
  only after valid analysis is saved" and the per-batch and final logging), 17 (share exact curl
  commands; tell the user to watch the dev server terminal), 21 (OpenAI credentials are server-only
  and never run from browser code; the env var table row for `OPENAI_API_KEY` and
  `ANALYSIS_BATCH_SIZE`; the **joined table filter gotcha**; "Avoid `any`… long route handlers…
  unrequested features"), 22 (checks: `npm run typecheck`, `npm run lint`, `npm run build`).
- `.agents/skills/supabase/SKILL.md` — principle 2 ("After implementing any fix, run a test query
  to confirm the change works" — the manual test steps below end with a row count), principle 3
  ("If an approach fails after 2-3 attempts, stop and reconsider" — one retry per article, then the
  article is marked failed and the run moves on), the Security Checklist line "Never expose the
  `service_role` or secret key in public clients … In Next.js, any `NEXT_PUBLIC_` env var is sent
  to the browser", and "Always pin package versions and commit lockfiles" (both new packages are
  pinned exactly, matching how `@supabase/supabase-js`, `cheerio` and `zod` are already pinned).
- `.agents/skills/ai-sdk/SKILL.md` — "Never write AI SDK code from memory"; read the bundled,
  version-matched docs in `node_modules/ai/docs/` and `node_modules/@ai-sdk/openai/docs/`; install
  `ai` first, then the provider package; "Be minimal — only set options that differ from the
  defaults"; run the project's type checker afterwards.
- `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx` (installed `ai` 7.0.107)
  — **`generateObject` no longer exists in v7**. Structured output is
  `generateText({ model, output: Output.object({ schema }) })`, and the result is read from
  `result.output`, already validated against the schema. `Output.object` also takes `name` and
  `description`, which some providers pass to the model as schema metadata, and `.describe()` on
  individual properties is the documented way to give the model per-field hints.
- `node_modules/ai/docs/03-ai-sdk-core/50-error-handling.mdx` — non-streaming calls throw, so a
  plain `try/catch` around `generateText` is the documented pattern.
- `node_modules/ai/docs/03-ai-sdk-core/25-settings.mdx` — `maxRetries` defaults to `2` and covers
  transport-level failures; `abortSignal` is the documented way to bound a call
  (`AbortSignal.timeout`). The `maxRetries` default is left alone; it is transport retry, which is
  a different thing from section 19's "retry once" on *invalid output*.
- `node_modules/@ai-sdk/openai/docs/03-openai.mdx` (installed `@ai-sdk/openai` 4.0.71) — `import
  { openai } from '@ai-sdk/openai'`; the default instance reads `OPENAI_API_KEY` from the
  environment, so no key is ever passed in code; `openai('model-id', { …settings })` selects the
  Responses API automatically; `reasoningEffort` is `'none' | 'minimal' | 'low' | 'medium' | 'high'
  | 'xhigh' | 'max'` and defaults to `medium`; **structured outputs use strict JSON schema by
  default, and strict mode does not support optional properties — "You need to change Zod
  `.nullish()` and `.optional()` to `.nullable()`"**. The installed model-id union was read from
  `node_modules/@ai-sdk/openai/dist/index.d.ts` rather than from memory.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and
  `…/03-api-reference/03-file-conventions/route.md` — Route Handlers live in `route.ts`, are not
  cached by default, take `NextRequest`, and answer an unexported method with `405`; `maxDuration`
  is a route segment config export.

## Existing code inspected

- `supabase/schema.sql` — `article_analyses` already exists with `summary`, `sentiment_score`,
  `sentiment_label`, `bias_score`, `bias_label`, `left/center/right_percentage`, `confidence`,
  `framing_notes`, `loaded_terms`, `disclaimer`, `model`, a unique `article_id`, and the check
  constraints `sentiment_score between -1 and 1`, `bias_score between -1 and 1`, the label sets,
  each percentage `between 0 and 100`, `confidence between 0 and 1`, and
  `left + center + right = 100`. **No schema change is needed for this task.**
- `lib/supabase/types.ts` — `ArticleAnalysisInsert` is already column-for-column correct, with
  `SentimentLabel` and `BiasLabel` narrowing the two label columns. No change needed.
- `lib/supabase/queries/analyses.ts` — already has `getArticlesPendingAnalysis` (LEFT JOIN embed +
  JS emptiness test, per the joined-filter gotcha), `deriveBiasScore`, and `saveAnalysis` (upsert
  the analysis, then stamp `analyzed_at`). Two changes are needed, below.
- `lib/pipeline/scrape.ts` / `lib/pipeline/types.ts` / `lib/pipeline/run-logger.ts` — the shape the
  analysis run must copy: a typed summary object, a `RunLogger` created with a scope that prefixes
  every console line with a short run id and mirrors each line to `public.logs`, and a summary
  printed at the end. `createRunLogger("analyze")` needs no change; `"analyze"` is already in the
  `LogScope` union.
- `app/api/scrape/route.ts` — the thin-handler pattern this route copies: `requireAdminSecret`
  first, tolerant empty-body parse, Zod `safeParse` with `z.flattenError` on failure, delegate,
  return the summary, and a generic `500` that keeps the real error on the server console.
- `lib/api/admin.ts` — `requireAdminSecret(request)` returns a `NextResponse` to send or `null`;
  constant-time compare, fails closed when `BIASLY_ADMIN_SECRET` is unset.
- `lib/bias.ts` — `normalizeBiasPercentages` already clamps and rescales three percentages to a
  total of exactly 100 using largest-remainder rounding. It is plain, non-`server-only` code, so
  the write path can reuse it instead of a second rounding implementation.
- `lib/supabase/mappers.ts`, `lib/articles/read.ts`, `components/news/*`, `components/analysis/*`,
  `app/page.tsx`, `app/news/[id]/page.tsx` — the UI already maps and renders summary, sentiment
  label, framing label, left/center/right percentages, confidence, framing notes, loaded terms,
  disclaimer and model. **The pages need no change**; they are empty today only because no
  analysis row exists. `getFeedArticles` drops articles whose analysis is missing.
- `lib/scraping/limits.ts` — the precedent for a centralized limits module with a documented reason
  per constant; `lib/ai/limits.ts` follows the same style.
- Live Supabase state (service-role read, counts only): **98 articles, 0 analyses**, sources
  Reuters, NPR, BBC News, Fox News, The Guardian; `raw_text` length min/median/max across a sample
  is 1,056 / 4,672 / 13,315 characters. So a first full run analyses 98 articles, and the input
  cap below is a safety net rather than something that fires in normal use.

## Decisions and assumptions

1. **Model: `gpt-5.4-mini`, `reasoningEffort: "low"`.** Verified present in the installed provider's
   model-id union, not recalled. It is the cheap tier of the current generation, and this task is
   classification plus a short summary over at most a few thousand words. `reasoningEffort` is the
   one setting deviating from a default (`medium`), to keep a 98-article run's latency and token
   spend down. Both live in `lib/ai/limits.ts` as `ANALYSIS_MODEL` / `ANALYSIS_REASONING_EFFORT`,
   so changing the model is a one-line edit, and `ANALYSIS_MODEL` is the exact string saved to
   `article_analyses.model`.
2. **No `ANALYSIS_MODEL` env var.** AGENTS.md section 21's table is the canonical env list and does
   not include one; adding an unrequested variable would put the table and `.env.example` out of
   step with the spec. The model id is a code constant.
3. **`bias_score` is always derived in code**, never asked of the model: `deriveBiasScore(left,
   right)` from `lib/supabase/queries/analyses.ts`, exactly as AGENTS.md section 7 defines it.
4. **The disclaimer is a stored constant, not model output.** Section 19 requires a disclaimer to
   be saved, and section 19 also requires framing to be shown as AI-estimated. A fixed
   `ANALYSIS_DISCLAIMER` string in `lib/ai/prompt.ts` says exactly that on every article, instead of
   paying tokens for a sentence that would vary in wording per article. It is saved to
   `article_analyses.disclaimer` for every row.
5. **Percentages: strict Zod, plus a ±2 rounding repair.** The schema requires three integers in
   0–100. If they total exactly 100, they are saved as-is. If the total is within 2 of 100 (pure
   rounding drift, e.g. 33/34/34), `normalizeBiasPercentages` repairs it to exactly 100 and the run
   logs a debug line. Anything further off is treated as invalid output → retry once → mark failed.
   This keeps the database check constraint satisfied without burning a second model call on an
   off-by-one, and without silently rescaling output that is genuinely wrong.
6. **The label is stored as the model returned it.** Section 19's "the label should match the
   strongest percentage unless confidence is low or percentages are close" is a judgement with
   documented exceptions, so it is enforced through the prompt, not by code that rewrites the
   label. Code would have to guess where "close" starts, and rewriting would discard exactly the
   nuance the rule protects.
7. **Retry once, then fail** (section 19). A retry is attempted only for an *invalid output* — a
   schema failure, a percentage total that is too far off, or an empty summary — and the retry
   prompt appends what was wrong with the first attempt. A transport or API error (rate limit,
   timeout, auth) is not retried here; the AI SDK's own `maxRetries` default of 2 already covers
   that layer. A failed article gets no `article_analyses` row and no `analyzed_at`, so the next
   run picks it up.
8. **Batch size default 5, from `ANALYSIS_BATCH_SIZE`** (section 21's table). A batch's articles are
   sent concurrently with `Promise.allSettled`; batches run one after another. Batching exists only
   to bound wall time and concurrent OpenAI calls, per "Batching is allowed only to avoid
   timeouts" — it is not a cap on how much a run analyses.
9. **A full run continues until no pending article remains** (rule 3). Pending articles are
   re-queried after each batch rather than paged through a stale list, so a row inserted by a
   concurrent scrape is still picked up. The loop stops when a pass yields no pending article, or
   when a pass makes zero progress (every article in it failed) — a no-progress guard that keeps a
   persistent failure from looping forever. `MAX_ANALYSIS_ARTICLES = 500` is a second, absolute
   stop for one run.
10. **`limit` and `articleIds` are honoured but never the default** (section 19: "Default behavior
    should process all pending valid articles" / "Do not hardcode analysis to … specific article
    IDs"). An empty body means *every* pending article. `articleIds` analyses exactly those,
    skipping any that already have an analysis.
11. **Article text is capped at `MAX_ARTICLE_CHARS = 16_000`** before being sent, with the cut
    marked in the prompt. The longest stored article is 13,315 characters, so this normally never
    fires; it exists so one pathological `raw_text` cannot blow up a request.
12. **An article with under 200 characters of text is skipped, not failed.** There is nothing to
    analyse and a model call would waste money; it is counted as `skipped` with reason
    `insufficient_text` and left pending. The scrape gate makes this rare.
13. **`maxDuration = 300` on the route**, matching `/api/scrape`. A 98-article first run at batch
    size 5 will exceed this on Vercel's Hobby plan; the manual test steps below note that a big
    first run belongs on the local dev server, or should be split with `limit`.
14. **Packages pinned exactly** — `ai` at `7.0.107` and `@ai-sdk/openai` at `4.0.71` (the installed
    versions), matching the existing pins and the supabase skill's lockfile rule.

## Files likely to change

| File | Change |
| --- | --- |
| `package.json` | Add `"ai": "7.0.107"` and `"@ai-sdk/openai": "4.0.71"`, pinned (already installed while researching the bundled docs; the `^` ranges get pinned). |
| `package-lock.json` | Committed alongside. |
| `.env.example` | New OpenAI section: `OPENAI_API_KEY` (server only) and optional `ANALYSIS_BATCH_SIZE`. |
| `lib/ai/limits.ts` | New. `ANALYSIS_MODEL`, `ANALYSIS_REASONING_EFFORT`, `DEFAULT_ANALYSIS_BATCH_SIZE`, `MAX_ANALYSIS_BATCH_SIZE`, `analysisBatchSize()` (reads `ANALYSIS_BATCH_SIZE`, falls back to 5 on a missing or unparsable value), `MAX_ANALYSIS_ARTICLES`, `MAX_ARTICLE_CHARS`, `MIN_ARTICLE_CHARS`, `PERCENTAGE_TOTAL_TOLERANCE`. |
| `lib/ai/analysis-schema.ts` | New. `AnalysisOutputSchema` (Zod) + `AnalysisOutput` type. Field names are the section 19 names: `neutralSummary`, `sentimentScore`, `sentimentLabel`, `politicalFramingLabel`, `leftPercentage`, `centerPercentage`, `rightPercentage`, `confidence`, `framingNotes`, `loadedTerms`. Every property required and `.nullable()` where a value may be absent — strict JSON schema mode forbids `.optional()`. Each property carries a `.describe()` hint. |
| `lib/ai/prompt.ts` | New. `ANALYSIS_SYSTEM_PROMPT`, `buildAnalysisPrompt(article, previousError?)`, `ANALYSIS_DISCLAIMER`. |
| `lib/ai/analyze-article.ts` | New, `server-only`. `analyzeArticle(article)` → one `generateText` + `Output.object` call, schema-validated, percentage repair, one retry on invalid output, returns `{ ok: true, analysis } \| { ok: false, reason }`. |
| `lib/pipeline/types.ts` | Add `AnalyzeOptions`, `AnalyzeSummary`, `AnalyzeStatus`, `AnalysisFailureReason`, `AnalyzeBatchOutcome`. |
| `lib/pipeline/analyze.ts` | New, `server-only`. `runAnalysis(options)` — the orchestrator. |
| `lib/supabase/queries/analyses.ts` | `getArticlesPendingAnalysis` returns ids only (drops `raw_text` from the scan, so a 98-row scan does not pull ~450 KB of article bodies); add `getArticlesByIds(ids)` to load a batch's full rows; `countPendingAnalyses` is not added — the pending id list's length is the count. `deriveBiasScore` and `saveAnalysis` are unchanged. |
| `app/api/analyze/route.ts` | New. `POST` only, `maxDuration = 300`. |

Not touched: `supabase/schema.sql`, `lib/supabase/types.ts` (no column change), any file under
`app/` other than the new route, any component, `lib/articles/*`, `lib/supabase/mappers.ts`,
`lib/pipeline/scrape.ts`, `lib/parsing/*`, `lib/oxylabs/*`.

## Implementation requirements

### Pending detection (`lib/supabase/queries/analyses.ts`)

- Keep the LEFT JOIN embed `select("id, article_analyses ( id )")` and the **JavaScript** emptiness
  test — never `.eq('article_analyses.id', …)` (section 21's joined-filter gotcha), and never
  `analyzed_at IS NULL` alone (section 19 rule 1).
- Return `string[]` of article ids, newest `published_at` first, sliced to the requested limit.
- `getArticlesByIds(ids: string[]): Promise<ArticleRow[]>` loads full rows for one batch, chunked
  at `URL_EXISTENCE_CHUNK_SIZE`-style small `.in()` calls (15) to stay consistent with section 9's
  rule about oversized `.in()` filters.
- `saveAnalysis` keeps its current order: insert/upsert the analysis, then stamp `analyzed_at`
  (rule 6). Do not change it.

### The model call (`lib/ai/analyze-article.ts`)

- `import "server-only"` at the top. The OpenAI key is read by the provider from the environment;
  it must never be referenced in code, logged, or returned.
- `generateText({ model: openai(ANALYSIS_MODEL, { reasoningEffort: ANALYSIS_REASONING_EFFORT }),
  system: ANALYSIS_SYSTEM_PROMPT, prompt: buildAnalysisPrompt(...), output: Output.object({ name,
  description, schema: AnalysisOutputSchema }) })`, reading `result.output`.
- Post-schema checks before accepting: summary non-empty after trim; percentages total 100 or
  within `PERCENTAGE_TOTAL_TOLERANCE` (repair with `normalizeBiasPercentages`); `sentimentScore`
  within −1…1 and `confidence` within 0…1 (the schema enforces these, so a failure here is a bug
  net, not a second gate).
- On an invalid first attempt, retry **once** with the reason appended to the prompt. On a second
  invalid output, return `{ ok: false, reason: "invalid_output" }`. On a thrown error, return
  `{ ok: false, reason: "model_error", message }` — the message is logged server-side only.
- The returned analysis is the row shape `saveAnalysis` takes: labels narrowed to `SentimentLabel`
  / `BiasLabel`, `bias_score` from `deriveBiasScore`, `model: ANALYSIS_MODEL`, `disclaimer:
  ANALYSIS_DISCLAIMER`, `loaded_terms` defaulting to `[]`.

### The prompt (`lib/ai/prompt.ts`)

The system prompt must state, in the model's own instructions, every framing rule from section 19:
percentages are integers 0–100 that add to exactly 100; the label is one of `left`, `center`,
`right`, `mixed`, `unclear`; the label should match the strongest percentage unless confidence is
low or the percentages are close; weak evidence means `unclear` with low confidence; judge from
**article text evidence only, never the publication's name or reputation**; the summary is neutral
and non-editorialising; loaded terms are quoted from the article text. The user prompt carries the
article title, source name, published date and the (capped) text, and on a retry, one line naming
what was wrong with the previous attempt.

### The orchestrator (`lib/pipeline/analyze.ts`)

- `import "server-only"`. `runAnalysis(options: AnalyzeOptions): Promise<AnalyzeSummary>`.
- `createRunLogger("analyze")`, then log: analysis started (with the resolved options), pending
  count found, batch started (index and size), per-article analysed / skipped / failed, batch
  finished with its three counts (rule 7), and analysis completed or failed, then `log.summary(...)`
  with the final object (rules 8 and 9).
- Loop: resolve the pending id list → take `batchSize` ids → `getArticlesByIds` → analyse the batch
  concurrently with `Promise.allSettled` → save each valid result → re-query pending → repeat.
  Stop when nothing is pending, when the requested `limit` is reached, when
  `MAX_ANALYSIS_ARTICLES` is reached, or when a whole batch made no progress.
- `Promise.allSettled`, not `Promise.all`: one article's failure must never abort its batch.
- Counters: `pendingAtStart`, `analyzed`, `skipped`, `failed`, `batches`, `durationMs`, and
  `failureReasons` grouped by count (the same shape as the scrape summary's `rejectionReasons`).
- Status: `completed`, `completed_with_errors` (any failure), or `failed` (could not load the
  pending list at all, or every article in the run failed).
- No `any`. Every helper small and typed. Nothing here touches Oxylabs, scraping or the UI.

### The route (`app/api/analyze/route.ts`)

- `POST` only — no `GET` export (section 14). `export const maxDuration = 300;`
- `requireAdminSecret(request)` first; return its response when non-null (section 15).
- Tolerant empty-body parse, then Zod: `{ articleIds?: string[] of uuid (min 1), limit?: int
  1…MAX_ANALYSIS_ARTICLES, batchSize?: int 1…MAX_ANALYSIS_BATCH_SIZE }`, all optional. Invalid JSON
  → `400`; invalid shape → `400` with `z.flattenError`.
- Delegate to `runAnalysis`, return the summary with status `500` when `summary.status === "failed"`,
  else `200`. A thrown error logs on the server and returns a generic `{ error: "Analysis failed." }`
  `500`.

## Security requirements

- `OPENAI_API_KEY` is server-only: read only by the AI SDK provider from the environment, never
  imported into a component, never logged, never included in a response body. It is added to
  `.env.example` as a placeholder only.
- `lib/ai/analyze-article.ts` and `lib/pipeline/analyze.ts` import `server-only`, so any future
  import from a Client Component is a build error rather than a runtime leak.
- `POST /api/analyze` requires `x-biasly-admin-secret`; the secret is never accepted from the query
  string and never echoed back. Missing or wrong → `401` with a generic body.
- No browser code calls OpenAI, triggers analysis, or mutates pipeline state (section 21).
- Error responses are generic; model errors, stack traces and provider messages stay on the server
  console.
- Article text sent to OpenAI is public news content already stored in Supabase — no user data, no
  credentials, no Clerk identifiers are included in any prompt.

## Acceptance criteria

1. `POST /api/analyze` with no body analyses **every** article that has no `article_analyses` row —
   all 98 today — not a fixed batch, not the latest scrape, not a fixed 10.
2. Pending detection is the LEFT JOIN check; an article whose `analyzed_at` is set but whose
   analysis row was deleted is picked up again.
3. Every saved row has all of: summary, sentiment score and label, bias label, left/center/right
   percentages that total exactly 100, `bias_score = (right − left) / 100`, confidence, framing
   notes, loaded terms, disclaimer and model name.
4. `analyzed_at` is set only after the analysis row is saved; an article that failed has neither.
5. Invalid model output is retried once and then marked failed — a bad analysis is never saved,
   and the database check constraints are never violated.
6. Batches are configurable (`batchSize`, `ANALYSIS_BATCH_SIZE`, default 5), and a full run
   continues across batches until nothing is pending.
7. The run logs analysed / skipped / failed per batch and in the final summary object, with neat
   progress lines in between, all under one run id and mirrored to `public.logs` with scope
   `analyze`.
8. The route is POST-only, `401`s without the admin header, `400`s on a malformed body, and returns
   the summary object.
9. The home page lists analysed articles and a details page shows summary, sentiment, framing
   percentages, confidence, framing notes, loaded terms and disclaimer — with **no UI edits** in
   this task.
10. No embedding, pgvector, scheduler or cron code is added; `supabase/schema.sql` and
    `lib/supabase/types.ts` are unchanged.
11. `npm run typecheck`, `npm run lint` and `npm run build` pass.

## Checks to run

```bash
npm run typecheck
npm run lint
npm run build      # new route + new server modules, so the build is in scope (section 22)
```

## Manual test steps

Start the dev server and **watch this terminal** — per AGENTS.md section 17, all analysis progress
is logged there:

```bash
npm run dev
```

1. **Auth guard — expect `401`:**

```bash
curl -i -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{}'
```

2. **Bad body — expect `400`:**

```bash
curl -i -X POST http://localhost:3000/api/analyze \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"limit":0}'
```

3. **Small smoke run — 2 articles:**

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"limit":2}' | jq
```

Expect `{"status":"completed", "pendingAtStart":98, "analyzed":2, "skipped":0, "failed":0, …}` and,
in the dev-server terminal, one `[analyze xxxxxxxx]` line per step plus the summary object.

4. **Full run — every pending article** (98 today; on the local dev server this is unbounded, and
   it is the default the spec asks for):

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

Expect `analyzed` + `skipped` + `failed` to equal `pendingAtStart`, and a second identical call to
return `pendingAtStart: 0` with nothing analysed.

5. **Re-analysis check** (rule 1) — in Supabase Dashboard → SQL Editor, delete one analysis row and
   confirm the article comes back as pending even though its `analyzed_at` is still set:

```sql
delete from public.article_analyses
where article_id = (select id from public.articles order by published_at desc limit 1);
```

Re-run step 3 and confirm that article is analysed again.

6. **Verify in the database** (supabase skill, principle 2) — SQL Editor:

```sql
select count(*) as analyses,
       count(*) filter (where left_percentage + center_percentage + right_percentage <> 100) as bad_totals,
       count(*) filter (where abs(bias_score - ((right_percentage - left_percentage)::numeric / 100)) > 0.001) as bad_scores
from public.article_analyses;

select level, message from public.logs where scope = 'analyze' order by id desc limit 20;
```

Expect `bad_totals` and `bad_scores` to be `0`.

7. **Verify in the UI** — open http://localhost:3000. The home page now lists analysed articles
   with source, image, published date, sentiment label, framing label, the left/center/right split
   and confidence. Open one card and confirm the details page shows the summary, sentiment, framing
   percentages, confidence, framing notes, loaded terms and disclaimer.
