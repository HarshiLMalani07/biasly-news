# Prompt: biasly Supabase Database and Data Access

## Goal

Stand up Supabase as biasly's source of truth and give the app its read/write layer:

1. `supabase/schema.sql` — the six core tables of AGENTS.md section 7 (`sources`, `articles`,
   `article_analyses`, `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs`), RLS enabled, granted
   to `service_role` only.
2. `supabase/seed.sql` — the five active sources named in AGENTS.md section 11.
3. `lib/supabase/types.ts` — hand-written `Database` type plus row/insert aliases and the domain
   unions (`SentimentLabel`, `BiasLabel`, `LogLevel`, …).
4. `lib/supabase/server.ts` — a `server-only`, lazily-created service-role client.
5. `lib/supabase/queries/*` — the Data Access Layer: sources, articles, analyses, logs.
6. `lib/articles/view-models.ts` + `lib/supabase/mappers.ts` — DB rows → the view models the
   existing UI renders.
7. Wire `app/page.tsx` and `app/news/[id]/page.tsx` onto Supabase and delete `lib/demo/*`.

This task builds **the data layer plus the UI wiring** only. It adds **no** API route handlers, no
Oxylabs calls, no OpenAI calls, no pgvector (section 20 adds `embedding` later — it must **not**
appear in the initial schema), no Zod dependency, and no Supabase Auth. Per AGENTS.md section 5 the
UI still displays stored data only; nothing added here scrapes, analyses, or mutates pipeline state.

**The database is empty until the scraping and analysis tasks run.** The home feed and the details
page will therefore render empty states after this task. That is expected and was confirmed with the
user before writing this prompt.

## Skills read

- `AGENTS.md` — sections 1 (scope: Supabase persistence is in scope; "do not overbuild"), 2
  (workflow), 5 (layer separation: Website / API / Database — UI displays stored data only), 6
  (stack: Supabase in, **Supabase Auth out**, no local JSON storage), 7 (source-of-truth table list
  and the exact column set for `sources`, `articles`, `article_analyses`; "The `embedding
  vector(1536)` column is added in section 20 … Do not include it in the initial schema"; "update
  `supabase/schema.sql`, `lib/supabase/types.ts`, and run the corresponding ALTER SQL in Supabase
  Dashboard → SQL Editor before testing"), 8 (scraping loads active sources from `sources`; "Do not
  invent source URLs"), 9 (**URL existence check** — "never pass more than 15 URLs to a single
  `.in()` filter"), 10 (articles are append-only; dedupe on original + canonical URL), 19
  (**pending-analysis check** — LEFT JOIN `articles` to `article_analyses`, never `analyzed_at IS
  NULL` alone; the analysis field list; `bias_score = (right − left) / 100`; percentages sum to 100;
  the card and details-page field lists), 20 (pgvector comes later; `getRelatedArticles` will live
  in `lib/supabase/queries/articles.ts`), 21 (service role key is server-only; only `NEXT_PUBLIC_*`
  reaches the browser; env var table; the **joined table filter gotcha** — never
  `.eq('foreignTable.column', value)`, filter in JS instead), 22 (checks to run).
- `.agents/skills/supabase/SKILL.md` — core principles (verify against the changelog, don't trust
  training data; verify the work after implementing) and, from the Security Checklist:
  - "Never expose the `service_role` or secret key in public clients … In Next.js, any
    `NEXT_PUBLIC_` env var is sent to the browser."
  - "Enable RLS on every table in any exposed schema, which includes `public` by default."
  - Data API exposure is separate from RLS: `anon`/`authenticated` need explicit `GRANT`s.
  - "Always pin package versions and commit lockfiles when installing Supabase packages."
- `https://supabase.com/changelog.md` (fetched live per the skill's principle 1) — the relevant
  breaking change is **2026-04-28: tables in `public` are no longer auto-exposed to the Data API**
  (enforced 2026-10-30). This confirms the design below: biasly's tables are service-role only and
  are never reachable with the anon key.
- `https://supabase.com/docs/guides/api/securing-your-api.md` — "For tables that should NOT be
  exposed to the Data API … don't grant privileges to `anon` or `authenticated`. Grant access only
  to `service_role`."
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md` — the **Data Access Layer**
  pattern recommended for new projects: "Only run on the server", "Return safe, minimal Data
  Transfer Objects", and mark modules with `import 'server-only'`.
- `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` — "Since Server
  Components are rendered on the server, credentials and query logic will not be included in the
  client bundle so you can safely make database queries using an ORM or database client."
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` — this project
  does **not** set `cacheComponents`, so the previous model applies and a page with no dynamic API
  would be prerendered at build time; `export const dynamic = 'force-dynamic'` opts a route into
  per-request rendering.
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` — `.env.local` loading and
  the `NEXT_PUBLIC_` browser-bundling rule.

## Existing code inspected

- `.env.local` — already contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY`. `.env.example` does **not** list them yet.
- `package.json` — no `@supabase/supabase-js`, no `server-only`, no `zod` direct dependency.
  Next `16.3.5`, React `19.2.8`, Clerk `@clerk/nextjs` v7.
- `proxy.ts` — Clerk gates `/news(.*)`; `/api` is deliberately unprotected (admin-secret routes come
  later). Unchanged by this task.
- `app/page.tsx` — renders `<TopNewsSection articles={topNewsArticles} />` from `lib/demo/top-news`,
  plus the `DesignSystemSheet` reference panel.
- `app/news/[id]/page.tsx` — `generateStaticParams()` over demo ids, `generateMetadata`, and the
  two-column layout: `ArticleHeader`, `ArticleHero`, `BiasDistributionCard`, `ArticleBody`,
  `RelatedStories`, and the sidebar `BiasAnalysisCard` / `AiSummaryCard` / `SourceBreakdownCard`.
- `lib/demo/top-news.ts`, `lib/demo/article-detail.ts` — the fixture modules and the `HomeArticle`,
  `ArticleDetail`, `RelatedArticle`, `SentimentLabel`, `FramingLabel`, `SourceBias` types. Both
  files say in their own comments that "The Supabase read layer replaces this module wholesale".
- `lib/bias.ts` — `normalizeBiasPercentages()` already clamps and largest-remainder-rounds a
  left/center/right triple back to exactly 100. The mappers reuse it instead of re-implementing it.
- Components typed against the demo modules: `news-card`, `top-news-section`, `article-header`,
  `bias-distribution-card`, `related-stories`, `related-story-card`, `bias-analysis-card`,
  `ai-summary-card`, `bias-breakdown-row`, `source-breakdown-card`.
- `components/news/article-card.tsx` — used **only** by `app/_components/design-system-sheet.tsx`
  with literal props, not by the feed. It stays untouched.
- `next.config.ts` — `images.remotePatterns` currently allows `images.unsplash.com` only.

## Decisions and assumptions

1. **Service-role only; no browser Supabase client.** Auth is Clerk, not Supabase Auth, so an
   anon-key client would carry no user context and buy nothing. Every read and write goes through
   the server-only service-role client from a Server Component or (later) a route handler. RLS is
   enabled on all six tables with **no policies**, `anon`/`authenticated` are revoked, and only
   `service_role` is granted — which also matches the 2026-04-28 "not auto-exposed" change.
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` stay in `.env.example` because the
   AGENTS.md section 21 table lists them, but no code reads the anon key in this task.
2. **Hand-written `Database` type.** No Supabase CLI or MCP server is configured in this project, so
   `supabase gen types` is not available. `lib/supabase/types.ts` is hand-written and AGENTS.md
   section 7 already requires it to be kept in step with `supabase/schema.sql`.
3. **Schema is applied by the user in Dashboard → SQL Editor**, per AGENTS.md section 7. This task
   does not add the Supabase CLI, `supabase/config.toml`, or a migrations directory — that would be
   a second, unused schema workflow.
4. **UUID primary keys** via `gen_random_uuid()` (built into Postgres 13+ on Supabase, no extension
   needed), except `logs`, which uses `bigint generated always as identity` because it is the only
   high-volume append-only table. Article URLs are the dedupe key, so `/news/[id]` now carries an
   article UUID instead of a demo slug.
5. **Fields the UI shows that section 7 does not store are dropped, not faked.** Adding columns
   beyond the section 7 list would be overbuilding, and inventing values would put fiction on a page
   about media honesty. Concretely:
   - `category`, `country`, `authorName`, `heroCaption`, `heroCredit` → become optional in the view
     models and render only when present (always absent for now).
   - `sourceCount` → optional. biasly stores one source per article; there is no cross-outlet
     roster in the schema. Captions fall back to "AI-estimated from this article's text".
   - `SourceBreakdownCard` → removed from the details page and deleted. Its own doc comment already
     flags it as demo-only ("nothing here is backed by the schema").
   - `imageAlt` → the article title.
   - `readTimeLabel`, `summaryReadTimeLabel` → derived from the stored word count at 200 wpm. This
     is computed from stored text, not invented.
   - `summaryBullets` → the stored `summary` split on blank lines, falling back to sentence
     splitting. `summaryGeneratedLabel` → the analysis row's `created_at`.
   - `paragraphs` → `articles.raw_text` split on blank lines, falling back to single newlines.
6. **Card meta rows are re-laid-out around real data**, keeping the existing type scale, spacing and
   colours. `NewsCard`: eyebrow becomes `{sourceName} · {Sentiment}`, the footer becomes
   `AI framing: {label} · {confidence}%` (left) and `{publishedLabel}` (right). `ArticleHeader`'s
   byline becomes `{sourceName} | {publishedLabel} | {readTimeLabel}`. This keeps every field
   AGENTS.md section 19 requires on a card visible, and removes only the fields with no data behind
   them.
7. **Only analysed articles are reachable.** `getFeedArticles()` returns articles that have an
   `article_analyses` row, and `getArticleDetail()` returns `null` when the analysis row is missing
   (→ `notFound()`). AGENTS.md section 18 states "Articles only appear on the homepage after
   `analyzed_at` is set"; the details page follows the same rule so a card and its page never
   disagree.
8. **Related stories are the most recent other analysed articles for now**, from
   `getRelatedArticlesFallback()`, with a comment pointing at AGENTS.md section 20, which replaces
   it with the `getRelatedArticles(articleId, embedding)` cosine-distance query. No vector code,
   column, or index is added in this task.
9. **Pending-analysis detection uses a LEFT embed plus a JS filter**, never
   `.eq('article_analyses.id', …)` — AGENTS.md section 21's joined-table gotcha. `analyzed_at` is
   never used on its own as the pending test (section 19).
10. **Both data pages are `force-dynamic`.** `cacheComponents` is off, so without this a
    Supabase-reading page would be baked at build time and the hourly pipeline's articles would
    never appear.
11. **`next.config.ts` image hosts widen to `https://**`.** Scraped article images come from
    arbitrary publisher CDNs (`i.guim.co.uk`, `ichef.bbci.co.uk`, `media.npr.org`, …) that cannot be
    enumerated up front. Trade-off, stated plainly: a wildcard pattern lets anyone use this app's
    image optimizer as a proxy for any HTTPS image. The alternative — `unoptimized` article images —
    loses resizing on every card. Taking the wildcard; flag it for the user rather than bury it.
12. **Dependencies:** `@supabase/supabase-js` pinned to the current stable `2.116.0` (npm `latest`;
    `3.0.0-next` is prerelease and not used) and `server-only@0.0.1`. Exact versions, no `^`, and
    `package-lock.json` is committed — the skill's supply-chain rule.
13. **Query functions throw on error** through one `unwrap()` helper that prefixes the PostgREST
    message with the operation name. Route handlers and pipeline code added later catch them; the
    two pages let the error boundary handle it.
14. **`oxylabs_schedules.schedule_id` and `oxylabs_schedule_runs.job_id` are `text`,** not `bigint`
    — AGENTS.md section 18's large-integer precision rule. Storing them as text means a value read
    from raw HTTP response text survives the round trip through JS unchanged. No query helpers for
    these two tables ship in this task; the scheduler task adds them alongside its routes.

## Files likely to change

**New**

- `supabase/schema.sql`
- `supabase/seed.sql`
- `lib/supabase/types.ts`
- `lib/supabase/server.ts`
- `lib/supabase/queries/sources.ts`
- `lib/supabase/queries/articles.ts`
- `lib/supabase/queries/analyses.ts`
- `lib/supabase/queries/logs.ts`
- `lib/supabase/mappers.ts`
- `lib/articles/view-models.ts`
- `lib/text.ts` (paragraph/bullet splitting, read-time, date labels)

**Modified**

- `package.json`, `package-lock.json` — add `@supabase/supabase-js`, `server-only`
- `.env.example` — append the Supabase rows
- `next.config.ts` — image `remotePatterns`
- `app/page.tsx` — Supabase feed + empty state + `force-dynamic`
- `app/news/[id]/page.tsx` — Supabase detail + `force-dynamic`, drop `generateStaticParams`
- `components/news/news-card.tsx`, `top-news-section.tsx`, `article-header.tsx`,
  `bias-distribution-card.tsx`, `related-stories.tsx`, `related-story-card.tsx`
- `components/analysis/bias-analysis-card.tsx`, `ai-summary-card.tsx`, `bias-breakdown-row.tsx`
  (type import only)

**Deleted**

- `lib/demo/top-news.ts`, `lib/demo/article-detail.ts`
- `components/analysis/source-breakdown-card.tsx`

## Implementation requirements

### 1. Dependencies

```bash
npm install --save-exact @supabase/supabase-js@2.116.0 server-only@0.0.1
```

Commit the lockfile.

### 2. `supabase/schema.sql`

Idempotent and re-runnable (`create table if not exists`, `create index if not exists`). Header
comment: this file is the source of truth for the schema and is applied by hand in Supabase
Dashboard → SQL Editor; keep it in step with `lib/supabase/types.ts` (AGENTS.md section 7).

- `sources` — `id uuid pk default gen_random_uuid()`, `name text not null`,
  `listing_url text not null unique`, `parser_strategy text`, `is_active boolean not null default
  true`, `logo_url text`, `created_at timestamptz not null default now()`.
  Index: `(is_active)` where `is_active`.
- `articles` — `id uuid pk`, `source_id uuid not null references public.sources(id) on delete
  cascade`, `url text not null unique`, `canonical_url text unique`, `title text not null`,
  `image_url text not null`, `published_at timestamptz not null`, `raw_text text not null`,
  `scraped_at timestamptz not null default now()`, `analyzed_at timestamptz`,
  `created_at timestamptz not null default now()`.
  `image_url` and `published_at` are `not null` because AGENTS.md section 13 forbids saving an
  article without them — the gate is enforced in the database, not only in code.
  Indexes: `(published_at desc)`, `(source_id)`, `(analyzed_at)`.
- `article_analyses` — `id uuid pk`, `article_id uuid not null unique references
  public.articles(id) on delete cascade`, `summary text not null`,
  `sentiment_score real not null check (… between -1 and 1)`,
  `sentiment_label text not null check (… in ('positive','neutral','negative'))`,
  `bias_score real not null check (… between -1 and 1)`,
  `bias_label text not null check (… in ('left','center','right','mixed','unclear'))`,
  `left_percentage smallint not null check (… between 0 and 100)` and the same for
  `center_percentage` / `right_percentage`, plus a table-level
  `check (left_percentage + center_percentage + right_percentage = 100)`,
  `confidence real not null check (… between 0 and 1)`, `framing_notes text`,
  `loaded_terms text[] not null default '{}'`, `disclaimer text`, `model text not null`,
  `created_at timestamptz not null default now()`.
  A comment records that `embedding vector(1536)` is added in AGENTS.md section 20, not here.
- `logs` — `id bigint generated always as identity primary key`,
  `level text not null default 'info' check (… in ('info','warn','error'))`,
  `scope text not null` (`'scrape' | 'analyze' | 'scheduler' | 'cron'`, free text so later stages
  can add their own), `message text not null`, `context jsonb`, `run_id text`,
  `created_at timestamptz not null default now()`. Indexes: `(created_at desc)`, `(run_id)`.
- `oxylabs_schedules` — `id uuid pk`, `source_id uuid not null unique references
  public.sources(id) on delete cascade`, `schedule_id text not null unique` (**text**, section 18),
  `cron_expression text not null`, `is_active boolean not null default true`,
  `last_synced_at timestamptz`, `created_at timestamptz not null default now()`.
- `oxylabs_schedule_runs` — `id uuid pk`, `schedule_id text not null references
  public.oxylabs_schedules(schedule_id) on delete cascade`, `job_id text not null`,
  `result_status text`, `run_at timestamptz`, `processed_at timestamptz`,
  `articles_inserted integer not null default 0`, `created_at timestamptz not null default now()`,
  `unique (schedule_id, job_id)`. Index: `(processed_at)`.

Then, for every one of the six tables:

```sql
alter table public.<t> enable row level security;
revoke all on table public.<t> from anon, authenticated;
grant select, insert, update, delete on table public.<t> to service_role;
```

No RLS policies are created: with no policy, non-`service_role` roles see nothing even if a grant is
ever added by accident. `service_role` bypasses RLS by design. A comment explains this.

### 3. `supabase/seed.sql`

The five outlets AGENTS.md section 11 names, idempotent via
`on conflict (listing_url) do nothing`:

| name | listing_url | parser_strategy |
| --- | --- | --- |
| Reuters | `https://www.reuters.com/` | `reuters` |
| NPR | `https://www.npr.org/` | `npr` |
| BBC News | `https://www.bbc.com/news` | `bbc` |
| Fox News | `https://www.foxnews.com/` | `fox` |
| The Guardian | `https://www.theguardian.com/us` | `guardian` |

All `is_active = true`. `parser_strategy` values are the keys the scraping task will switch on.

### 4. `lib/supabase/types.ts`

- `Database` — `public.Tables.<table>.{Row, Insert, Update}` for all six tables, matching the SQL
  exactly (nullability included). No `Views`, `Functions` or `Enums` blocks beyond empty ones.
- Domain unions: `SentimentLabel`, `BiasLabel`, `LogLevel`, `LogScope`.
- Row aliases: `SourceRow`, `ArticleRow`, `ArticleAnalysisRow`, `LogRow`, and the `Insert` aliases
  the pipeline will need (`ArticleInsert`, `ArticleAnalysisInsert`, `LogInsert`).
- A header comment: keep in step with `supabase/schema.sql` (AGENTS.md section 7).

### 5. `lib/supabase/server.ts`

```ts
import "server-only";
```

- `getServiceRoleClient(): SupabaseClient<Database>` — module-level memoised instance, created with
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and
  `{ auth: { persistSession: false, autoRefreshToken: false } }` (no browser storage, no session
  refresh — this client is never a user session).
- A `requireEnv(name)` helper that throws a clear "Missing <name>" error rather than letting an
  `undefined` key reach Supabase.
- Doc comment: service-role bypasses RLS, so this module must never be imported from a Client
  Component; `server-only` enforces it at build time.

### 6. `lib/supabase/queries/*`

Each file imports `server-only` and uses `getServiceRoleClient()`. A shared `unwrap()` helper
(colocated in `lib/supabase/queries/unwrap.ts`) turns `{ data, error }` into `data` or throws
`` new Error(`${operation}: ${error.message}`) ``.

`sources.ts`
- `getActiveSources(): Promise<SourceRow[]>` — `is_active = true`, ordered by `name`.
- `getActiveSourcesByNames(names: string[]): Promise<SourceRow[]>` — case-insensitive, for
  AGENTS.md section 8's "scrape these 3 sources" flow.

`articles.ts`
- `getFeedArticles(limit = 24): Promise<FeedArticleRow[]>` — `articles` with
  `sources(name, logo_url)` and `article_analyses(...)` embedded, ordered by `published_at desc`,
  limited; rows without an analysis are dropped **in JS** (section 21's joined-filter gotcha).
- `getArticleById(id: string)` — the same shape for one id; returns `null` on not-found (PostgREST
  `PGRST116` is a miss, not a failure) and `null` when the analysis is absent.
- `getRecentArticlesExcluding(id: string, limit = 6)` — the related-stories stand-in, with the
  section 20 comment.
- `findExistingUrls(urls: string[]): Promise<Set<string>>` — the **URL existence check**: chunks of
  **15** maximum (a `URL_EXISTENCE_CHUNK_SIZE = 15` constant with the section 9 reference), checking
  both `url` and `canonical_url`, unioning the results.
- `insertArticles(rows: ArticleInsert[]): Promise<ArticleRow[]>` — append-only insert with
  `onConflict: "url", ignoreDuplicates: true`. Never deletes or resets (section 10).

`analyses.ts`
- `getArticlesPendingAnalysis(limit): Promise<ArticleRow[]>` — selects articles with
  `article_analyses!left(id)` embedded, ordered `published_at desc`, then keeps in JS only the rows
  whose embedded array is empty. Implements AGENTS.md section 19's **pending-analysis check**;
  `analyzed_at` is deliberately not part of the predicate, and a comment says why.
- `saveAnalysis(articleId, analysis): Promise<void>` — upsert on `article_id`, then set
  `articles.analyzed_at = now()` **only after** the analysis insert succeeds (section 19 rule 6).
- `deriveBiasScore(left, right)` — `(right − left) / 100`, rounded to 4 decimals, exported so the
  analysis task cannot re-derive it differently (AGENTS.md section 7).

`logs.ts`
- `writeLog(entry: { level?, scope, message, context?, runId? }): Promise<void>` — never throws;
  a logging failure must not fail a pipeline run, so it catches and `console.error`s instead.
- `getRecentLogs(limit = 100, scope?)` — ordered `created_at desc`, for the later `GET /api/logs`.

### 7. `lib/articles/view-models.ts`

The types moved out of `lib/demo/*` and adjusted per decision 5:

```ts
export type SentimentLabel = "positive" | "neutral" | "negative";
export type FramingLabel = "left" | "center" | "right" | "mixed" | "unclear";

export type FeedArticle = {
  id: string;                 // article uuid, the /news/[id] segment
  title: string;
  sourceName: string;
  publishedLabel: string;     // "Jun 1"
  publishedIso: string;
  imageUrl: string;
  imageAlt: string;
  bias: BiasPercentages;      // always sums to 100
  sentimentLabel: SentimentLabel;
  framingLabel: FramingLabel;
  confidence: number;         // 0..1
  category?: string | null;   // not stored yet - decision 5
  country?: string | null;
  sourceCount?: number | null;
};

export type ArticleDetail = FeedArticle & {
  authorName?: string | null;
  publishedLabel: string;     // "May 31, 2026" on the details page
  readTimeLabel: string;
  heroCaption?: string | null;
  heroCredit?: string | null;
  paragraphs: readonly string[];
  biasScore: number;
  sentimentScore: number;
  summaryBullets: readonly string[];
  summaryGeneratedLabel: string;
  summaryReadTimeLabel: string;
  framingNotes: string | null;
  loadedTerms: readonly string[];
  disclaimer: string | null;
  model: string;
};

export type RelatedArticle = Pick<ArticleDetail, "id" | "title" | "imageUrl" | "imageAlt"
  | "publishedLabel" | "readTimeLabel"> & { category?: string | null; country?: string | null };
```

### 8. `lib/text.ts`

Pure, dependency-free, unit-testable helpers, each with a one-line doc comment:
`toParagraphs(text)`, `toBullets(summary)`, `readTimeLabel(text)` (200 wpm, min 1),
`shortDateLabel(iso)` (`"Jun 1"`), `longDateLabel(iso)` (`"June 1, 2026"`). Dates format in
`en-US` with an explicit `timeZone: "UTC"` so server and client agree and no hydration mismatch
appears.

### 9. `lib/supabase/mappers.ts`

`toFeedArticle(row)` and `toArticleDetail(row)`:

- run the three percentages through `normalizeBiasPercentages` from `lib/bias.ts`;
- prefer the stored `bias_score`, falling back to `deriveBiasScore` when it is absent;
- narrow `sentiment_label` / `bias_label` to the unions with a safe fallback (`"neutral"` /
  `"unclear"`) rather than a cast, so bad data degrades instead of crashing the page;
- set `imageAlt` to the title, `sourceName` from the embedded `sources.name`;
- leave `category`, `country`, `sourceCount`, `authorName`, `heroCaption`, `heroCredit` `null`.

### 10. UI wiring

`app/page.tsx`
- `export const dynamic = "force-dynamic";`
- `const articles = await getFeedArticles();` → `<TopNewsSection articles={...} />`.
- When empty, `TopNewsSection` renders a bordered empty-state panel inside the existing section
  chrome: heading "No analysed articles yet", body "Run the scraper and AI analysis to populate the
  feed." — same `text-body-md text-text-secondary` / `border-border` tokens as the rest of the page,
  so the shell still looks finished.
- `DesignSystemSheet` stays exactly as it is.

`app/news/[id]/page.tsx`
- `export const dynamic = "force-dynamic";`, `generateStaticParams` deleted.
- `generateMetadata` reads the article from Supabase and uses the first summary bullet as the
  description.
- `getArticleDetail(id)` → `notFound()` when null; `getRelatedArticlesFallback(id)` for the related
  grid; `<SourceBreakdownCard>` removed from the sidebar.
- A malformed (non-UUID) `id` must render the 404 page, not a Postgres error: the query layer
  returns `null` for `22P02` (invalid text representation) as well as `PGRST116`.

Component edits — layout, spacing, type scale and colour tokens stay byte-for-byte as they are;
only the data each meta row reads changes (decision 6):
- `news-card.tsx` — eyebrow `{sourceName} · {Sentiment}` (source in `text-text-primary`, sentiment
  in `text-text-secondary`, exactly the two-tone treatment the category/country eyebrow used);
  footer left `AI framing: {Label} · {n}%` and footer right `{publishedLabel}`; the Info tooltip
  string is unchanged; `category`/`country` still render when present.
- `article-header.tsx` — eyebrow renders the source name when `category` is null; byline becomes
  `{sourceName} | {publishedLabel} | {readTimeLabel}`, dropping "By …" when `authorName` is null.
- `bias-distribution-card.tsx` — `sourceCount?: number | null`; caption falls back to
  "AI-estimated from this article's text".
- `bias-analysis-card.tsx` — "Based on N balanced sources" falls back to the same sentence; the
  `loadedTerms` / `framingNotes` / `disclaimer` blocks skip cleanly when null.
- `ai-summary-card.tsx` — tolerates a null `disclaimer`.
- `related-story-card.tsx` — eyebrow falls back to nothing when category is null; meta line drops
  the leading separator.
- All of the above re-point their type imports at `@/lib/articles/view-models`.

### 11. `.env.example` and `next.config.ts`

Append to `.env.example`, matching the AGENTS.md section 21 table and the existing comment style:

```
# --- Supabase (database) ----------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxx
# Server only. Bypasses RLS - never expose to browser code (AGENTS.md section 21).
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx
```

`next.config.ts` — add `{ protocol: "https", hostname: "**" }` with a comment stating the trade-off
from decision 11, keeping the existing Unsplash entry for the design-system sheet.

## Security requirements

- `SUPABASE_SERVICE_ROLE_KEY` is read only inside `lib/supabase/server.ts`, which starts with
  `import "server-only"`. Every query module imports it too, so a Client Component importing any of
  them is a build error, not a runtime leak.
- No `NEXT_PUBLIC_` variable is introduced. Nothing under `lib/supabase/` is imported by a file
  carrying `"use client"`.
- RLS is enabled on all six tables; `anon` and `authenticated` are explicitly revoked and no policy
  is created, so the tables are unreachable with the anon key even if the Data API exposes them.
- Query helpers take typed parameters and go through supabase-js (parameterised PostgREST calls) —
  no string-concatenated SQL anywhere in the app.
- `raw_text` renders through `ArticleBody` as React children only; no `dangerouslySetInnerHTML` is
  added anywhere in this task.
- Errors thrown by the query layer carry the operation name and the PostgREST message, never the
  URL or key.
- `@supabase/supabase-js` and `server-only` are installed with exact versions and the lockfile is
  committed.

## Acceptance criteria

1. `supabase/schema.sql` creates all six tables with the section 7 column sets, runs clean twice in
   a row, contains **no** `vector`/`embedding` reference, and ends with RLS + grants for all six.
2. `supabase/seed.sql` inserts the five sources and is safe to re-run.
3. `lib/supabase/types.ts` matches the SQL column-for-column, including nullability.
4. `lib/supabase/server.ts` and every query module begin with `import "server-only"`.
5. `findExistingUrls` never sends more than 15 URLs in one `.in()` call.
6. `getArticlesPendingAnalysis` uses a LEFT embed + JS filter, never
   `.eq('article_analyses.…', …)`, and never uses `analyzed_at` alone.
7. `saveAnalysis` sets `analyzed_at` only after the analysis row is written.
8. `deriveBiasScore(left, right) === (right - left) / 100`.
9. The home page renders Supabase articles; with an empty table it renders the empty state, not a
   crash or a blank section.
10. `/news/<uuid>` renders the stored article and its analysis; `/news/not-a-uuid` and
    `/news/<unknown uuid>` both render the 404 page.
11. `lib/demo/top-news.ts`, `lib/demo/article-detail.ts` and `source-breakdown-card.tsx` are gone,
    and nothing imports `@/lib/demo/*`.
12. No API route handler, Oxylabs call, OpenAI call, or Zod dependency is added.
13. `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Checks to run

```bash
npm run typecheck
npm run lint
npm run build          # routes, config and server modules all changed
grep -rn "@/lib/demo" app components lib     # must return nothing
```

## Manual test steps

1. **Apply the schema.** Supabase Dashboard → SQL Editor → paste `supabase/schema.sql` → Run.
   Run it a second time to confirm it is idempotent. Then paste and run `supabase/seed.sql`.
2. **Confirm the sources landed:**
   ```sql
   select name, listing_url, is_active from public.sources order by name;
   ```
   Five rows, all active.
3. **Confirm the tables are not publicly readable.** In the SQL Editor:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname in ('sources','articles','article_analyses','logs',
                     'oxylabs_schedules','oxylabs_schedule_runs');
   ```
   `relrowsecurity` is `true` for all six.
4. **Start the app:** `npm run dev`. Open `http://localhost:3000` — the feed shows the "No analysed
   articles yet" empty state (the database has no articles yet).
5. **Insert one article plus its analysis** in the SQL Editor to exercise the read path end to end:
   ```sql
   with s as (select id from public.sources where name = 'Reuters'),
   a as (
     insert into public.articles
       (source_id, url, canonical_url, title, image_url, published_at, raw_text)
     select s.id,
       'https://www.reuters.com/world/smoke-test-article-1',
       'https://www.reuters.com/world/smoke-test-article-1',
       'Smoke test article for the biasly data layer',
       'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
       now() - interval '2 hours',
       E'First paragraph of the smoke test article, long enough to read like real body copy.\n\nSecond paragraph, so the paragraph splitter has something to split on.\n\nThird paragraph, which also feeds the read-time estimate.'
     from s returning id
   )
   insert into public.article_analyses
     (article_id, summary, sentiment_score, sentiment_label, bias_score, bias_label,
      left_percentage, center_percentage, right_percentage, confidence,
      framing_notes, loaded_terms, disclaimer, model)
   select a.id,
     E'A neutral one-line summary of the smoke test article.\n\nA second summary line, so the bullet splitter has two bullets.',
     0.05, 'neutral', 0.29, 'right', 20, 31, 49, 0.78,
     'Framing estimated from the article text alone.',
     array['take-it-or-leave-it','tougher terms'],
     'AI summaries can make mistakes.', 'gpt-5-mini'
   from a;
   ```
   Note `bias_score = (49 − 20) / 100 = 0.29` — the section 7 formula.
6. **Reload `http://localhost:3000`.** One card appears: image, headline, the bias meter at
   20/31/49, the eyebrow `Reuters · Neutral`, and the footer `AI framing: Right · 78%` with the
   published date on the right. Resize to phone width to confirm the card still reads correctly.
7. **Open the card.** Sign in with Clerk if prompted (`/news/(.*)` is gated by `proxy.ts`). The
   details page shows the headline, the `Reuters | <date> | N min read` byline, the hero image, the
   Bias Distribution bar, three body paragraphs, and the sidebar Bias Analysis + AI Summary cards
   with two summary bullets, the loaded-term badges, the disclaimer and `gpt-5-mini`. The Source
   Breakdown card is gone.
8. **404 paths:** `http://localhost:3000/news/not-a-uuid` and
   `http://localhost:3000/news/11111111-1111-1111-1111-111111111111` both render the article
   not-found page. Neither logs a Postgres error in the dev server terminal.
9. **Watch the dev server terminal** throughout — there must be no Supabase error output and no
   "Missing NEXT_PUBLIC_SUPABASE_URL"-style env failure.
10. **Clean up the smoke-test row** when finished:
    ```sql
    delete from public.articles where url = 'https://www.reuters.com/world/smoke-test-article-1';
    ```
    (`article_analyses` cascades.) The home page returns to the empty state.
