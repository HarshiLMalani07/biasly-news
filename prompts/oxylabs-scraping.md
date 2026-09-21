# Prompt: biasly Oxylabs Scraping Pipeline

## Goal

Build the manual scrape-to-insert pipeline of AGENTS.md sections 9–16: `POST /api/scrape` loads
active sources from Supabase, fetches each homepage through the Oxylabs Web Scraper API, extracts
story-card links, rejects non-article URLs, dedupes against stored articles, scrapes the surviving
article detail pages, validates and cleans them, and appends the valid ones to `public.articles`.

Concretely:

1. `lib/oxylabs/client.ts` — a `server-only` Oxylabs Realtime client (`source: "universal"`).
2. `lib/scraping/limits.ts` — every tunable number and per-source setting, in one place.
3. `lib/parsing/*` — URL normalisation, the non-article reject list, per-source candidate URL
   checks, homepage link extraction, article detail extraction, `raw_text` cleanup, validation.
4. `lib/pipeline/*` — the orchestrator, its typed result, and the run logger.
5. `lib/api/admin.ts` — the shared `x-biasly-admin-secret` guard.
6. `app/api/scrape/route.ts` (POST) and `app/api/sources/route.ts` (GET) — thin handlers only.
7. `lib/supabase/queries/articles.ts` — swap the batch `insertArticles` for a per-row
   `insertArticle` that survives a `canonical_url` unique violation.
8. Add `cheerio` and `zod` as direct dependencies; add the Oxylabs and admin-secret rows to
   `.env.example`; rename the three mis-named keys in `.env.local`.

This task builds **manual scraping only**. It adds **no** Oxylabs Scheduler (section 18), no
`/api/analyze` or OpenAI calls (section 19), no pgvector (section 20), no Vercel Cron, and no UI
changes. The home feed stays empty after a scrape, because an article only reaches a reader once
its analysis exists — that is expected and is called out in the manual test steps below.

## Skills read

- `AGENTS.md` — sections 1 (Oxylabs scraping is in scope; "Do not overbuild"), 2 (workflow: prompt
  first, implement after approval), 5 (layer separation — API handlers are thin, Scraping / Parsing
  / Pipeline / Database are separate layers; "UI must not scrape, analyze, or mutate pipeline
  state"), 6 (stack: Oxylabs Web Scraper API, Cheerio, Zod), 7 (the `articles` column list, and
  "Do not hardcode source URLs inside scraping logic"), 8 (source selection: inspect active sources
  and ask the user; "Do not invent source URLs"; "Do not scrape source sub-endpoints that are not
  stored in Supabase"), 9 (**the canonical scrape-to-insert pipeline**, the **URL existence
  check** — "never pass more than 15 URLs to a single `.in()` filter", the **article content
  gate**, **run logging** and its summary fields, and the **non-article reject list**), 10
  (append-only; "Never delete, replace, or reset the article list during a scrape"; dedupe on
  original *and* canonical URL), 11 (homepage link extraction: visible story cards only, the
  per-source examples of what is *not* an article URL, "Use only homepage URLs already stored in
  Supabase"), 12 (candidate URL filtering; "If the candidate URL check is uncertain, use the
  stricter choice and reject before detail scraping"), 13 (validation accept/reject criteria, the
  3-paragraphs-or-900-characters rule, the one-large-paragraph splitting rule, and the `raw_text`
  cleanup list), 14 (`POST /api/scrape`, `GET /api/sources`; "Do not switch scraping or AI analysis
  between `GET` and `POST`"), 15 (the `x-biasly-admin-secret` header, `BIASLY_ADMIN_SECRET`, never
  in the query string, never in browser code, `401` on missing/invalid), 16 (manual scraping
  behaviour: default all active sources and up to 5 valid articles each; "It is better to insert
  fewer good articles than to insert bad ones"; return the summary object in the response; "Do not
  rely on a run-id polling test format"), 17 (share exact curl commands; tell the user to watch the
  dev server terminal), 21 (Oxylabs credentials are server-only; the env var table; the **joined
  table filter gotcha**; "Avoid `any`… long route handlers, mixed UI/business logic"), 22 (checks).
- `.agents/skills/web-scraper-api/SKILL.md` —
  - Auth is HTTP Basic with `$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD`.
  - `POST https://realtime.oxylabs.io/v1/queries` for an immediate response (the right endpoint
    here; `data.oxylabs.io` is Push-Pull and belongs to the Scheduler task).
  - "Use `universal` for unsupported sites" — news homepages have no dedicated source, so
    `source: "universal"` with `url` is correct, and `parse: true` does **not** apply.
  - `render: "html"` for JavaScript-heavy pages; `user_agent_type` presets including
    `desktop_chrome`; `geo_location` as country/state for non-commerce targets.
  - "set client timeouts near 180 seconds for rendered Realtime … requests".
  - Response shape: `{ "results": [{ "content": "...", "status_code": 200, "url": "..." }] }` —
    note the **per-result** `status_code`, which is the target's code, not the API's.
  - Error table: 401 auth failed, 429 rate limit exceeded.
- `.agents/skills/web-scraper-api/examples.md` — the universal-scraping request/response pair, the
  Node `fetch` + `Basic` auth form, the `render: "html"` variant, and the `{ "error": { "code",
  "message" } }` error body.
- `.agents/skills/supabase/SKILL.md` — principle 2 ("After implementing any fix, run a test query
  to confirm the change works"), principle 3 ("If an approach fails after 2-3 attempts, stop and
  reconsider" — the per-source try/catch below follows this), the Security Checklist line "Never
  expose the `service_role` or secret key in public clients … In Next.js, any `NEXT_PUBLIC_` env
  var is sent to the browser", and "Always pin package versions and commit lockfiles".
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Route Handlers live
  in `route.ts` under `app/`; "Route Handlers are not cached by default", and only `GET` can opt
  in, so `POST /api/scrape` needs no cache opt-out; `NextRequest`/`NextResponse` are the extended
  APIs; an unsupported method returns `405` automatically.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — the
  supported method exports and the `NextRequest` parameter type.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`
  — `export const maxDuration = <seconds>`; "Deployment platforms can use `maxDuration` from the
  Next.js build output to add specific execution limits."
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md`
  — **deprecation heeded**: "The Edge Runtime is deprecated. Remove the `runtime` export from your
  route files." So these routes export **no** `runtime`; `nodejs` is already the default.

## Existing code inspected

- `supabase/schema.sql` — `articles` already enforces the content gate at the database level:
  `image_url` and `published_at` are `NOT NULL`, `url` is `unique`, and **`canonical_url` is
  `unique` too**. That second unique index is the one thing a naive batch insert gets wrong (see
  Decisions). `logs.scope` is free text and `logs.run_id` groups one run's lines.
- `supabase/seed.sql` — the five sources and their `parser_strategy` keys: `reuters`, `npr`, `bbc`,
  `fox`, `guardian`. These keys are what the per-source parser table switches on.
- Live Supabase state (queried with the service-role key before writing this prompt, per AGENTS.md
  section 8): **5 active sources** — Reuters `https://www.reuters.com/`, NPR `https://www.npr.org/`,
  BBC News `https://www.bbc.com/news`, Fox News `https://www.foxnews.com/`, The Guardian
  `https://www.theguardian.com/us` — and **0 rows in `articles`**.
- `lib/supabase/server.ts` — `getServiceRoleClient()`, lazily created, `server-only`. Reuse it; do
  not create another client.
- `lib/supabase/queries/sources.ts` — `getActiveSources()` and `getActiveSourcesByNames(names)`
  already exist and are exactly what section 8's selection needs. No changes.
- `lib/supabase/queries/articles.ts` — `findExistingUrls(urls)` already implements the **URL
  existence check** in chunks of `URL_EXISTENCE_CHUNK_SIZE = 15`, matching both `url` and
  `canonical_url`. Reuse as-is. `insertArticles(rows)` (batch upsert, `onConflict: "url"`,
  `ignoreDuplicates`) is **replaced** — see Decisions.
- `lib/supabase/queries/logs.ts` — `writeLog(entry)` never throws and takes `{ level, scope,
  message, context, runId }`. The run logger wraps this; it does not re-implement it.
- `lib/text.ts` — `toParagraphs(text)` splits stored text on blank lines first. This is what the
  details page renders, so `raw_text` must be written back as paragraphs joined by `\n\n`.
- `proxy.ts` — Clerk protects `/news(.*)` only; `/api/*` is deliberately unprotected there so
  machine callers reach the admin-secret guard instead. No change needed.
- `app/` — there is **no** `app/api` directory yet. This task creates the first route handlers.
- `package.json` — `cheerio` is absent; `zod@4.6.5` is present only transitively. Both must become
  direct dependencies.
- `.env.local` — currently holds `OXY_WS_USERNAME`, `OXY_WS_PASSWORD` and a key literally named
  `x-biasly-admin-secret`, none of which match AGENTS.md section 21.

## Decisions and assumptions

Confirmed with the user before writing this prompt:

1. **Scrape scope** — default to **all 5 active sources, up to 5 valid articles per source**
   (AGENTS.md section 16's default). The POST body may override both; nothing is hardcoded.
2. **Env var names** — `.env.local` is corrected to the AGENTS.md section 21 names, keeping the
   existing values: `OXY_WS_USERNAME` → `OXY_WSA_USERNAME`, `OXY_WS_PASSWORD` →
   `OXY_WSA_PASSWORD`, `x-biasly-admin-secret` → `BIASLY_ADMIN_SECRET`. Code reads only the
   canonical names.

Decided while writing this prompt:

3. **`insertArticle`, not `insertArticles`.** `articles.canonical_url` is unique, but the existing
   batch upsert only declares `onConflict: "url"`. Two candidates that resolve to the same
   canonical page — or a canonical colliding with a row stored in an earlier run — raise Postgres
   `23505` and, in a batch, lose every other row in the statement. The pipeline therefore inserts
   **one row at a time** with a new `insertArticle(row): Promise<ArticleRow | null>` that returns
   `null` on `23505` (counted as a duplicate skipped, not a failure). `insertArticles` is deleted
   rather than left as dead code — nothing else calls it.
4. **Over-fetch, then stop at the target.** Validation rejects a meaningful share of candidates, so
   the per-source loop scrapes detail pages until it has `perSource` valid articles or has tried
   `perSource * DETAIL_ATTEMPT_MULTIPLIER` (3) candidates, whichever comes first. This is what
   makes "fewer good articles beats bad ones" (section 16) achievable without scraping the whole
   homepage.
5. **Render fallback, not render by default.** All five sources server-render their homepage
   markup, and `render: "html"` is slower and more expensive. Homepages are fetched without it; if
   a homepage yields **zero** candidate links, that one source is retried once with
   `render: "html"` before being reported as empty. Detail pages never render. The retry is logged.
6. **Sources are fetched sequentially; detail pages run at concurrency 4.** Sequential sources keep
   the run log readable per section 9; bounded detail concurrency keeps a 5×5 run inside
   `maxDuration`. The limit lives in `lib/scraping/limits.ts`.
7. **A failing source never fails the run.** Each source is wrapped in try/catch; the error is
   logged at `error` level with the source name and the run continues. The response is `200` with
   `status: "completed_with_errors"` when at least one source threw, `"completed"` otherwise.
8. **`GET /api/sources` is included.** AGENTS.md section 14 lists it as a read route, and section
   8's "show the user the available source names" needs it to be inspectable without a database
   client. It is ~20 lines, read-only, and returns no secrets. This is the one route beyond
   `/api/scrape` in this task.
9. **`GET /api/sources` requires no admin secret.** Section 15 scopes the secret to "action routes
   that start or mutate work". Listing source names mutates nothing. It is still server-side only
   and returns `id`, `name`, `listing_url`, `parser_strategy`, `is_active`, `logo_url`.
10. **Rejection reasons are a closed union**, not free strings, so section 9's "rejection reasons
    grouped by count" is countable and typo-proof.
11. **Both console and `logs` table.** Section 9 mandates console output and section 17 tells the
    user to watch the dev-server terminal, so console is primary. Every line is also mirrored to
    `public.logs` with `scope: "scrape"` and a shared `run_id`, which is what that table exists
    for. A logging failure never fails a run (`writeLog` already swallows).
12. **`maxDuration = 300`.** A 5×5 run is up to 5 homepage plus ~75 detail requests. Note in the
    file comment that Vercel's Hobby plan caps this lower; local `next dev` is unbounded.
13. **Assumption — Oxylabs credit is available and the account is a Web Scraper API account.** If
    the API returns `401`, the implementation stops and reports it rather than retrying, per the
    Supabase skill's "recover from errors, don't loop".

## Files likely to change

Created:

- `lib/oxylabs/client.ts` — Realtime universal scraping, Basic auth, typed errors.
- `lib/scraping/limits.ts` — all tunables and the per-source parser table.
- `lib/parsing/urls.ts` — absolutise, normalise, same-host check.
- `lib/parsing/reject-list.ts` — the section 9 non-article reject list, in one place.
- `lib/parsing/candidates.ts` — per-source article URL checks (section 12).
- `lib/parsing/homepage.ts` — story-card link extraction (section 11).
- `lib/parsing/article.ts` — detail page field extraction.
- `lib/parsing/clean.ts` — `raw_text` cleanup and paragraph splitting (section 13).
- `lib/parsing/validate.ts` — the article content gate (section 13).
- `lib/pipeline/types.ts` — `ScrapeSummary`, `RejectionReason`, per-source result types.
- `lib/pipeline/run-logger.ts` — console + `logs` table, one `run_id`.
- `lib/pipeline/scrape.ts` — the orchestrator.
- `lib/api/admin.ts` — the `x-biasly-admin-secret` guard.
- `app/api/scrape/route.ts` — POST handler.
- `app/api/sources/route.ts` — GET handler.

Modified:

- `lib/supabase/queries/articles.ts` — `insertArticles` → `insertArticle` (decision 3).
- `package.json` / `package-lock.json` — add `cheerio` and `zod`, pinned, lockfile committed.
- `.env.example` — add the Oxylabs and `BIASLY_ADMIN_SECRET` rows.
- `.env.local` — rename the three keys (decision 2).

Not touched: `supabase/schema.sql` and `lib/supabase/types.ts` (no column changes — the schema
already has everything scraping writes), all of `app/page.tsx`, `app/news/`, `components/`,
`lib/articles/`, `lib/supabase/mappers.ts`, `proxy.ts`.

## Implementation requirements

### 1. Dependencies

Install `cheerio` and `zod` as direct dependencies with exact pinned versions, and commit the
updated `package-lock.json`. `zod` must be pinned to the `4.x` already resolved in the tree so the
transitive copy is not duplicated.

### 2. `lib/scraping/limits.ts`

No `server-only` import — this is plain data with no secrets, imported by parsing and pipeline
alike. Export as `const` objects with explicit types:

- `DEFAULT_ARTICLES_PER_SOURCE = 5`
- `MAX_ARTICLES_PER_SOURCE = 20` (the upper bound the request body is validated against)
- `DETAIL_ATTEMPT_MULTIPLIER = 3`
- `DETAIL_CONCURRENCY = 4`
- `MAX_CANDIDATES_PER_SOURCE = 60` (cap on links kept from one homepage before filtering)
- `OXYLABS_TIMEOUT_MS = 180_000`
- `MIN_BODY_PARAGRAPHS = 3`
- `MIN_BODY_CHARACTERS = 900`
- `MIN_PARAGRAPH_CHARACTERS = 40`
- `MIN_TITLE_CHARACTERS = 15`
- A `PARSER_STRATEGIES` record keyed by the `parser_strategy` values in `seed.sql`, each entry
  holding the source's allowed hostnames and its article-URL predicate's configuration.

Every magic number used anywhere else in this task must come from here (AGENTS.md section 21,
"centralized limits").

### 3. `lib/oxylabs/client.ts`

`import "server-only"` at the top. Reads `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` through a
`requireEnv` helper that mirrors `lib/supabase/server.ts`'s error wording. Credentials are encoded
into the `Authorization: Basic` header and must never appear in a log line, an error message, or a
response body.

Export one function:

```ts
export async function fetchPageHtml(
  url: string,
  options?: { render?: boolean }
): Promise<string>
```

- `POST https://realtime.oxylabs.io/v1/queries`, `Content-Type: application/json`.
- Body: `{ source: "universal", url, user_agent_type: "desktop_chrome", geo_location: "United
  States" }`, plus `render: "html"` only when `options.render` is true.
- `signal: AbortSignal.timeout(OXYLABS_TIMEOUT_MS)`.
- Throw a typed `OxylabsError` (carrying `status` and a short reason) when:
  - the HTTP status is not 2xx — include the status and, for `401`, the explicit message that
    `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD` were rejected, and for `429` that the rate limit was
    hit;
  - the body parses to `{ error: { code, message } }`;
  - `results` is empty or `results[0].content` is not a non-empty string;
  - `results[0].status_code` is not 2xx — this is the **target site's** status, so a `403` or `404`
    here means the page was blocked or is gone, not that the API failed. Say which in the message.
- Return `results[0].content` as a string.

### 4. `lib/parsing/urls.ts`

Pure functions, no I/O, no `server-only`:

- `absolutise(href, baseUrl): string | null` — resolve a relative href against the source homepage;
  return `null` for `mailto:`, `tel:`, `javascript:`, `#`-only, and anything that is not
  `http`/`https` after resolution.
- `normaliseUrl(url): string` — lowercase the host, drop the hash, drop tracking query parameters
  (`utm_*`, `cmpid`, `ito`, `at_*`, `intcmp`, `fbclid`, `gclid`, `srnd`), drop an empty query
  entirely, and strip a trailing slash **except** on a bare origin. Normalisation must be
  idempotent: normalising twice gives the same string. This string is what the URL existence check
  and dedupe compare, and what is stored in `articles.url`.
- `isSameSite(url, allowedHosts): boolean` — host equals, or is a subdomain of, an allowed host.

### 5. `lib/parsing/reject-list.ts`

The single home of AGENTS.md section 9's **non-article reject list**. A file-level comment must say
so and point back at section 9 ("When this list changes, update it here only").

Export `matchRejectRule(pathname): RejectRule | null`, where the rules cover, as path segments or
prefixes: category/section, topic/tag, author/profile/people, search, shows/programs/podcasts,
live/liveblog, games/puzzles/crossword, products/reviews/shopping/deals, corporate/about/careers/
contact/support/help/legal/privacy/terms, newsletters/subscribe/subscription/account/signin, and
video/audio/gallery/picture-only paths. Also reject file extensions that are not pages (`.pdf`,
`.jpg`, `.xml`, `.rss`).

Matching is on **path segments**, not substrings, so a story slug containing the word "support"
survives. Return the rule name — it becomes the `RejectionReason` context in the log.

### 6. `lib/parsing/candidates.ts`

`isLikelyArticleUrl(url, parserStrategy): boolean` — the section 12 check, applied **before** any
detail scrape. Order: reject if `matchRejectRule` hits; reject if not `isSameSite`; then apply the
per-strategy predicate:

- `reuters` — path ends in a `-YYYY-MM-DD` dated slug (`/world/…-2026-09-21/`). `/world/africa`
  fails: no date.
- `npr` — path is `/YYYY/MM/DD/<id>/<slug>`, or a legacy `…/<9-or-more-digit-id>/<slug>`.
  `/sections/politics` fails.
- `bbc` — `/news/articles/<alphanumeric-id>`, or legacy `/news/<topic>-<digits>`. Reject `/sport`,
  `/news/live/…`, `/news/topics/…`, `/news/videos/…`.
- `fox` — a two-or-more-segment path whose last segment is a slug of at least 4 hyphen-separated
  words. Reject `/shows/…`, `/games/…`, `/live-news/…`, `/video/…`, `/category/…`, `/person/…`.
- `guardian` — path contains `/YYYY/<mon>/DD/` (`/us-news/2026/sep/21/<slug>`). `/us/environment`
  and `/thefilter-us` fail.
- Unknown or null strategy — the generic fallback: a date path, **or** a final slug of at least 4
  hyphen-separated words, **or** a trailing numeric id of 6+ digits.

Section 12's tie-break is binding: **when the check is uncertain, reject.** Each predicate is a
small named function with the example URLs from section 11 in a comment above it.

### 7. `lib/parsing/homepage.ts`

`extractCandidateLinks(html, source): string[]`.

- Load with Cheerio.
- **Remove chrome first**: `script, style, noscript, nav, header, footer, aside, form,
  [role="navigation"], [role="banner"], [role="contentinfo"], [aria-label*="navigation" i]`. This
  is how section 11's "ignore navigation, menus, footers" is enforced structurally rather than by
  guessing at URLs.
- Collect `a[href]` from what remains, preferring links inside `main`, `[role="main"]`, `article`,
  and elements whose class or data attribute names contain `story`, `card`, `teaser`, `promo`, or
  `headline`; fall back to the whole remaining body when those yield nothing.
- Drop links whose visible text is empty (an icon or image-only chrome link) unless the anchor
  contains a heading element — a genuine story card often wraps its `<h3>`.
- `absolutise` then `normaliseUrl` each href, drop nulls, dedupe preserving order, cap at
  `MAX_CANDIDATES_PER_SOURCE`.
- Do **not** filter for article-likeness here; that is `candidates.ts`, so the run log can report
  "candidates found" and "candidates rejected" as separate numbers (section 9).

Never follow a link to discover more listing pages (section 9 step 2).

### 8. `lib/parsing/article.ts`

`extractArticle(html, url): ExtractedArticle` where `ExtractedArticle` is
`{ title, imageUrl, publishedAt, canonicalUrl, paragraphs }` with every field nullable except
`paragraphs: string[]`. Extraction only — **no** accept/reject decisions here.

- `title` — `og:title`, then `<h1>`, then `<title>` with a trailing ` | Source` / ` - Source`
  suffix trimmed.
- `imageUrl` — `og:image`, then `twitter:image`, then JSON-LD `image`, then the first `<img>`
  inside `article`/`figure` with an absolute `src`. Absolutise the result.
- `publishedAt` — `meta[property="article:published_time"]`, then JSON-LD `datePublished`, then
  `time[datetime]`, then `meta[name="date"]` / `meta[name="pubdate"]` / `meta[itemprop="datePublished"]`.
  Parse to a `Date`; return `null` when unparseable. Emit as an ISO string.
- `canonicalUrl` — `link[rel="canonical"]`, then `og:url`, absolutised and normalised.
- `paragraphs` — JSON-LD `articleBody` when present (split per `clean.ts`), otherwise the cleaned
  `<p>` text from the first matching body container: `article`, `[data-component="text-block"]`,
  `[class*="article-body" i]`, `[class*="story-body" i]`, `[itemprop="articleBody"]`, `main`.

JSON-LD parsing must tolerate an array, a `@graph` wrapper, and invalid JSON (try/catch, skip).

### 9. `lib/parsing/clean.ts`

Implements section 13's cleanup list. Two exports:

- `cleanBodyElement($, element)` — before text extraction, remove `script, style, noscript, iframe,
  svg, form, figcaption, aside, nav`, plus elements whose class/id matches newsletter, subscribe,
  signup, related, more-on, most-read, most-viewed, read-more, load-more, social, share, follow,
  promo, advert/ad-slot/ad-container, author-bio, byline-block, tags, comments, or paywall.
- `cleanParagraphs(rawParagraphs): string[]` — collapse whitespace and non-breaking spaces; drop a
  paragraph that is shorter than `MIN_PARAGRAPH_CHARACTERS` and contains no sentence-ending
  punctuation; drop known boilerplate phrasings (sign up / subscribe / advertisement / follow us on
  / read more / load more / most viewed / all rights reserved / this article was originally
  published / copyright / share this); drop CSS and JS debris (text containing `{` and `}`, or
  `function(`, or `@media`, or a high ratio of `;` to words); dedupe repeated lines (navigation
  labels that survived); and preserve source order.

Also export `splitLongParagraph(text)` implementing section 13's one-large-paragraph rule: when
extraction returns a single block, split it on sentence boundaries into chunks of roughly 3
sentences so a real article is not rejected for a DOM quirk. A page must **not** be rejected merely
because paragraph extraction returned one paragraph.

### 10. `lib/parsing/validate.ts`

`validateArticle(extracted, url, parserStrategy): ValidationResult`, a discriminated union of
`{ ok: true; article: ValidArticle }` and `{ ok: false; reason: RejectionReason }`.

Checks, in this order, each mapping to one `RejectionReason`:

1. `missing_title` — no title, or shorter than `MIN_TITLE_CHARACTERS`.
2. `generic_title` — title matches a generic/section/show/program/podcast/product/game/live/
   corporate page name (`Home`, `News`, `Latest News`, `Video`, `Live`, `Watch`, `Shows`,
   `Podcasts`, `Newsletters`, `Privacy Policy`, `Page not found`, `Access Denied`, a bare source
   name, …), case-insensitively.
3. `missing_image` — no `imageUrl`, or it is not an absolute `http(s)` URL.
4. `missing_published_date` — no `publishedAt`, or it does not parse, or it is more than 2 days in
   the future (a clock-skew guard, not a freshness filter).
5. `non_article_canonical` — a `canonicalUrl` exists and fails `isLikelyArticleUrl`. This is
   section 13's "canonical URL points to a listing/category/program/product page".
6. `thin_body` — after cleanup (and `splitLongParagraph` when there is exactly one paragraph),
   neither `>= MIN_BODY_PARAGRAPHS` paragraphs nor `>= MIN_BODY_CHARACTERS` characters.
7. `unrelated_body` — more than half the paragraphs are other headlines: short lines with no
   sentence-ending punctuation. Section 13's "body is mostly unrelated headlines".

On success, `ValidArticle` carries the exact `ArticleInsert` fields: `url` (normalised),
`canonical_url`, `title`, `image_url`, `published_at` (ISO), and `raw_text` — the cleaned
paragraphs joined with `\n\n`, so `lib/text.ts`'s `toParagraphs` reads it back correctly.

### 11. `lib/pipeline/types.ts`

- `RejectionReason` — the seven above plus `detail_fetch_failed` and `insert_conflict`.
- `ScrapeSummary` with exactly section 9's fields: `status` (`"completed" | "completed_with_errors"
  | "failed"`), `sourcesChecked`, `candidatesFound`, `candidatesRejected`, `duplicatesSkipped`,
  `detailPagesScraped`, `articlesInserted`, `articlesRejected`, `articlesFailed`, `durationMs`, and
  `rejectionReasons: Partial<Record<RejectionReason, number>>` (grouped by count), plus
  `sourceErrors: { source: string; message: string }[]`.
- `ScrapeOptions` — `{ sourceNames?: string[]; perSource: number }`.

No `any` anywhere.

### 12. `lib/pipeline/run-logger.ts`

`createRunLogger(scope)` returns `{ runId, info, warn, error, summary }`. Each method prints a
readable, prefixed console line (`[scrape 8f3a] Fetched homepage: NPR (48 candidates)`) and mirrors
the line to `public.logs` via the existing `writeLog` with the shared `runId`. `summary(obj)`
prints the final object with `console.log` so it is readable in the dev terminal, and writes one
`logs` row with the summary as `context`. Mirroring is fire-and-forget and must never throw or
block a run.

### 13. `lib/pipeline/scrape.ts`

`import "server-only"`. Exports `runScrape(options: ScrapeOptions): Promise<ScrapeSummary>` — the
canonical section 9 pipeline, and the only place this order is written down:

1. Load sources: `getActiveSourcesByNames(options.sourceNames)` when names were given, else
   `getActiveSources()`. Log the selected source names. If the selection is empty, return a
   `failed` summary explaining that no active source matched — do not invent a URL.
2. For each source, sequentially, inside try/catch:
   1. `fetchPageHtml(source.listing_url)`; on zero candidates, retry once with `{ render: true }`
      (decision 5) and log the retry.
   2. `extractCandidateLinks` → count as `candidatesFound`.
   3. Filter with `isLikelyArticleUrl` → the rejected count is `candidatesRejected`.
   4. `findExistingUrls` on the survivors → drop matches, count as `duplicatesSkipped`. This is the
      **URL existence check**; it is already chunked at 15, so do not add another `.in()` call.
   5. Scrape detail pages with `DETAIL_CONCURRENCY`, stopping once `perSource` valid articles are
      collected or `perSource * DETAIL_ATTEMPT_MULTIPLIER` candidates have been attempted. A failed
      detail fetch is `detail_fetch_failed` and increments `articlesFailed`, not `articlesRejected`.
   6. `extractArticle` → `validateArticle`. Rejections increment `articlesRejected` and their
      reason's count, and are logged at `warn` with the URL and the reason.
   7. `insertArticle` per valid article. `null` (a `23505` canonical conflict) counts as
      `duplicatesSkipped` with reason `insert_conflict`; a real error counts as `articlesFailed`.
      **Nothing is ever deleted, replaced, or reset** (section 10).
   8. Log a per-source line with that source's counts.
3. Emit the summary object and return it.

Log lines required by section 9's **run logging**, in order: scrape started · selected sources ·
per-source start · homepage fetched · candidate links found · candidates rejected before detail
scrape · duplicates skipped · detail pages scraped · articles inserted · articles rejected after
validation · source-level errors · scrape completed or failed.

### 14. `lib/api/admin.ts`

```ts
export function requireAdminSecret(request: Request): NextResponse | null
```

Reads the `x-biasly-admin-secret` **header** only — never a query parameter (section 15). Compares
against `process.env.BIASLY_ADMIN_SECRET` with a constant-time comparison
(`crypto.timingSafeEqual` over equal-length buffers, with a length check first). Returns a `401`
`NextResponse` with a generic body (`{ error: "Unauthorized" }` — never echo the expected value or
say whether it was missing vs. wrong) or `null` when the caller is authorised. If
`BIASLY_ADMIN_SECRET` itself is unset, return `500` with a message naming the missing variable —
an unset secret must never mean "everyone is allowed".

### 15. `app/api/scrape/route.ts`

Thin (AGENTS.md section 5): guard, parse, delegate, respond. No parsing or Oxylabs logic here.

```ts
export const maxDuration = 300;

export async function POST(request: NextRequest) { … }
```

- No `runtime` export (deprecation heeded).
- `requireAdminSecret(request)` first; return its response if non-null.
- Parse the body with Zod, tolerating an empty body (`{}`):
  `{ sources: z.array(z.string().min(1)).min(1).optional(), perSource: z.number().int().min(1).max(MAX_ARTICLES_PER_SOURCE).optional() }`.
  On a Zod failure return `400` with the flattened issues.
- `runScrape({ sourceNames: body.sources, perSource: body.perSource ?? DEFAULT_ARTICLES_PER_SOURCE })`.
- Return `NextResponse.json(summary)` — `200` for `completed` / `completed_with_errors`, `500` for
  `failed`. The response body **is** the section 9 summary object (section 16).
- Wrap in try/catch; on an unexpected throw, log it and return `500` with a generic message. Never
  leak credentials or a stack trace to the client.

### 16. `app/api/sources/route.ts`

`GET` only, no admin secret (decision 9). Returns
`{ sources: [{ id, name, listing_url, parser_strategy, is_active, logo_url }] }` from
`getActiveSources()`. `500` with a generic message on failure.

### 17. `lib/supabase/queries/articles.ts`

Replace `insertArticles` with:

```ts
export async function insertArticle(row: ArticleInsert): Promise<ArticleRow | null>
```

Plain `.insert(row).select("*").single()`. Return `null` when `error.code === "23505"` (a unique
violation on `url` **or** `canonical_url` — both mean "already stored"); throw otherwise. Document
in the function comment why this is per-row rather than a batch (decision 3) and restate the
append-only rule. Leave `findExistingUrls` and `URL_EXISTENCE_CHUNK_SIZE` untouched.

### 18. Environment

`.env.example` gains, with comments matching the file's existing tone:

```
# --- Oxylabs (Web Scraper API) ----------------------------------------------
OXY_WSA_USERNAME=<your-oxylabs-web-scraper-api-username>
OXY_WSA_PASSWORD=<your-oxylabs-web-scraper-api-password>

# --- Pipeline admin secret --------------------------------------------------
BIASLY_ADMIN_SECRET=<a-long-random-string>
```

`.env.local`: rename the three keys in place, preserving the existing values (decision 2). Do not
print any value into the terminal or into a commit.

## Security requirements

- `lib/oxylabs/client.ts`, `lib/pipeline/*`, `lib/api/admin.ts` and `lib/supabase/*` all carry
  `import "server-only"`, so importing one from a Client Component is a build error rather than a
  runtime leak (AGENTS.md section 21).
- `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `BIASLY_ADMIN_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are
  never prefixed `NEXT_PUBLIC_`, never logged, never included in an API response, and never put in
  a URL query string.
- `POST /api/scrape` rejects a missing or wrong `x-biasly-admin-secret` with `401` and a generic
  body; the comparison is constant-time; an unset `BIASLY_ADMIN_SECRET` fails closed with `500`.
- No browser code triggers scraping. Nothing under `app/` outside `app/api/` imports the pipeline.
- Scraped HTML is untrusted input: it is parsed with Cheerio and read for text and attributes only.
  No scraped string is ever `eval`'d, rendered as HTML, or used to build a SQL string — every write
  goes through supabase-js parameter binding.
- Only `source.listing_url` values already stored in Supabase are fetched as homepages; detail URLs
  must pass `isSameSite` against that source's allowed hosts, so a hostile homepage link cannot
  redirect the scraper at an arbitrary host (SSRF guard).
- Error messages returned to the caller are generic; details go to the server console and `logs`.

## Acceptance criteria

1. `POST /api/scrape` with no body and a valid secret scrapes all 5 active sources, up to 5 valid
   articles each, and returns the section 9 summary object.
2. `POST /api/scrape` with `{"sources":["NPR"],"perSource":2}` scrapes only NPR and inserts at most
   2 articles.
3. A missing or wrong `x-biasly-admin-secret` returns `401` with no detail. The secret is accepted
   from the header only.
4. `GET /api/scrape` returns `405` (Next.js default — no `GET` export).
5. `GET /api/sources` returns the 5 active sources.
6. No source homepage, category, topic, show, live, game, product or corporate page is stored as an
   article. Spot-check every inserted `url` against section 9's reject list.
7. Every inserted row has a non-empty `title`, an absolute `image_url`, a valid `published_at`, and
   `raw_text` that reads as one article — not a page dump, no CSS or script debris, no navigation
   labels, no newsletter or "most viewed" blocks.
8. Running the scrape twice inserts no duplicates the second time; `duplicatesSkipped` rises and no
   existing row is modified or deleted (append-only, section 10).
9. One failing source does not abort the run: the other sources still insert, the error is logged,
   and `status` is `completed_with_errors`.
10. The dev-server terminal shows the ordered run-logging lines of section 9 and the final summary
    object; `public.logs` holds the same lines under one `run_id` with `scope = 'scrape'`.
11. No `any` in any new file; no secret in any log line or response body.
12. `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Checks to run

Per AGENTS.md section 22, from the project root, reporting exact output:

```bash
npm run typecheck
npm run lint
npm run build      # required: this task adds route handlers and server modules
```

## Manual test steps

Start the dev server and **watch this terminal** — all scrape progress is logged there
(AGENTS.md section 17):

```bash
npm run dev
```

**1. List the active sources** (no secret needed):

```bash
curl -s http://localhost:3000/api/sources | jq
```

**2. Scrape one source, shallow — the cheapest first run:**

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -d '{"sources":["NPR"],"perSource":2}' | jq
```

**3. Full default run — all 5 active sources, 5 articles each** (takes a few minutes):

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -d '{}' | jq
```

**4. Re-run the same command.** `articlesInserted` should be at or near 0 and `duplicatesSkipped`
should rise — dedupe works and articles are append-only.

**5. Confirm the admin guard:**

```bash
# 401, no detail
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/scrape -d '{}'

# 401 - the secret is not accepted from the query string
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "http://localhost:3000/api/scrape?x-biasly-admin-secret=$BIASLY_ADMIN_SECRET" -d '{}'

# 405 - scraping is POST only
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/scrape
```

**6. Inspect what landed** in Supabase Dashboard → SQL Editor:

```sql
select s.name, a.title, a.url, a.image_url, a.published_at,
       length(a.raw_text) as chars
from public.articles a
join public.sources s on s.id = a.source_id
order by a.scraped_at desc
limit 25;

-- Read one article end to end: it must read like one story.
select raw_text from public.articles order by scraped_at desc limit 1;

-- The run's log lines, in order.
select created_at, level, message, context
from public.logs
where scope = 'scrape'
order by id asc
limit 100;
```

**Expected after this task:** the home page and article pages still show nothing. Articles only
reach a reader once `article_analyses` exists (AGENTS.md section 18), and AI analysis is the next
task. Confirm the scrape worked with the SQL above, not with the UI.
