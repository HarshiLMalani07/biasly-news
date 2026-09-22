# pgvector and Related Articles

AGENTS.md section 20. Implements the four steps the user asked for: enable
pgvector, add the `embedding` column, generate and save embeddings inside the
AI analysis pipeline, and show a Related Articles section on the news details
page driven by cosine distance.

---

## 1. Goal

1. Enable the `vector` extension in Supabase and add `article_analyses.embedding
   vector(1536)` plus an IVFFlat cosine index, in `supabase/schema.sql` and in
   the Dashboard SQL Editor.
2. `POST /api/analyze` calls `text-embedding-3-small` alongside the existing
   analysis call and saves the vector to `article_analyses.embedding`.
   `articles.analyzed_at` is stamped only after both the analysis row and the
   embedding are stored.
3. Rows whose `article_analyses` row already exists but whose `embedding` is
   null are backfilled on the next analysis run, without re-running the full
   analysis and without paying for it again.
4. The news details page shows up to 5 related articles ordered by cosine
   distance (`<=>`), and hides the section entirely when the current article has
   no embedding.

Out of scope: section 18 (Oxylabs Scheduler, Vercel Cron, `/api/cron/pipeline`)
is not implemented yet and is not started here. Nothing about scraping,
validation, or the framing analysis prompt changes.

---

## 2. Skills read

- `.agents/skills/supabase/SKILL.md` — schema-change workflow, the "views bypass
  RLS" / `SECURITY DEFINER` / function-grant traps, and the rule that a schema
  change is not done until a query proves it works. There is no Supabase CLI and
  no `supabase/migrations/` in this project, so the imperative path applies:
  `supabase/schema.sql` is the source of truth and the ALTER SQL is run by hand
  in Dashboard → SQL Editor (AGENTS.md section 7).
- `.agents/skills/ai-sdk/SKILL.md` — "never write AI SDK code from memory"; the
  embedding API was verified against the installed packages rather than recalled:
  - `node_modules/ai/docs/03-ai-sdk-core/30-embeddings.mdx` and
    `node_modules/ai/docs/07-reference/01-ai-sdk-core/05-embed.mdx` →
    `embed({ model, value })` returns `{ embedding, usage }`, `maxRetries`
    defaults to 2.
  - `node_modules/@ai-sdk/openai/dist/index.d.ts:1599` → `openai.embedding(id)`
    is the current factory (`textEmbeddingModel` is deprecated in the installed
    4.0.71), and `text-embedding-3-small` is a valid `OpenAIEmbeddingModelId`.
  - `node_modules/@ai-sdk/openai/docs/03-openai.mdx:3013` → `text-embedding-3-small`
    is 1536 dimensions, which is what `vector(1536)` in section 20 expects, so
    no `dimensions` provider option is needed.

---

## 3. Existing code inspected

- `supabase/schema.sql` — `article_analyses` already carries a comment saying the
  `embedding vector(1536)` column belongs to section 20 and is deliberately
  absent. Every table is service-role only: RLS on, no policies, `anon` /
  `authenticated` revoked.
- `lib/supabase/types.ts` — hand-written `Database` type, kept column-for-column
  in step with the schema.
- `lib/supabase/queries/analyses.ts` — `getArticlesPendingAnalysis()` (LEFT JOIN
  pending check, section 19 rule 1), `getArticlesByIds()` (chunked at 15),
  `saveAnalysis()` (upsert, then stamp `analyzed_at`), `deriveBiasScore()`.
- `lib/supabase/queries/articles.ts` — `ARTICLE_FIELDS` / `ANALYSIS_FIELDS`
  explicit select lists, `ArticleWithAnalysis`, `flatten()`, `getArticleById()`,
  and `getRecentArticlesExcluding()`, whose doc comment already says section 20
  replaces it with `getRelatedArticles(articleId, embedding)`.
- `lib/pipeline/analyze.ts` — the run loop: pending scan, batches, `analyzeOne`,
  per-batch outcomes, failure-reason counts, final summary.
- `lib/ai/analyze-article.ts`, `lib/ai/limits.ts`, `lib/ai/prompt.ts` — the
  analysis call, centralized limits, `ANALYSIS_MODEL = "gpt-5.4-mini"`.
- `lib/articles/read.ts` — the read boundary; `getRelatedArticles(id, limit = 6)`
  currently maps recent articles.
- `app/news/[id]/page.tsx`, `components/news/related-stories.tsx`,
  `components/news/related-story-card.tsx`, `lib/articles/view-models.ts`
  (`RelatedArticle`), `lib/supabase/mappers.ts` (`toRelatedArticle`) — the UI
  already renders a Related Stories grid and returns `null` for an empty list, so
  no new component is needed.
- `lib/pipeline/types.ts` — `AnalysisFailureReason`, `AnalyzeBatchOutcome`,
  `AnalyzeSummary`.
- `.env.example` — `OPENAI_API_KEY` already covers embeddings; no new variable.

---

## 4. Decisions and assumptions

1. **Cosine ordering needs a Postgres function.** PostgREST cannot express
   `ORDER BY embedding <=> $1`, so similarity search goes through one SQL
   function, `public.match_related_articles(p_article_id, p_embedding, p_limit)`,
   called with `supabase.rpc(...)`. It returns only `article_id` and
   `similarity`; the rows themselves are then loaded with the existing
   `ARTICLE_SELECT` and re-ordered in JavaScript. That keeps one row shape
   (`ArticleWithAnalysis`), one mapper, and no duplicated select list.
2. **The function is `SECURITY INVOKER` with `search_path = ''`,** and its
   cosine operator is written `operator(extensions.<=>)` — pgvector lives in the
   `extensions` schema on Supabase, so an unqualified `<=>` cannot be resolved
   from an empty search path and the function fails to create. `EXECUTE`
   is revoked from `public`, `anon`, and `authenticated` and granted to
   `service_role` only — the supabase skill's warning that a function in
   `public` is callable by every role by default, and the table access model this
   project already uses.
3. **`ivfflat.probes = 10` is set on the function.** AGENTS.md section 20
   requires an IVFFlat cosine index, but at this corpus size (~100 analysed
   articles) a single probe would scan one list and could return fewer than 5
   neighbours. Setting probes inside the function gives full recall now and the
   index stays correct as the corpus grows. `lists = 10` is sized for hundreds to
   a few thousand rows; the comment in `schema.sql` says to raise it later.
4. **What gets embedded:** `title` + `raw_text`, capped at `MAX_EMBEDDING_CHARS`
   (8000 characters, comfortably inside the model's 8191-token limit). Section 20
   says the embedding call runs *alongside* the analysis call, so it cannot
   depend on the generated summary; the article text is also what makes two
   reports of the same story land near each other.
5. **Embedding failure does not throw away a good analysis.** `saveAnalysis`
   takes the embedding as a second argument and stamps `analyzed_at` only when it
   is present. If the embedding call fails, the analysis row is still written
   with `embedding` null, `analyzed_at` stays null, the article counts as failed
   for that run, and the next run's backfill phase fills the embedding and stamps
   `analyzed_at`. No analysis tokens are spent twice.
6. **Backfill is a second phase of the same run,** driven by a cheap
   `.is("embedding", null)` select of `article_id` — not by widening the pending
   scan. Selecting `embedding` in the pending scan would drag ~20 KB of vector
   text per article across the wire for every scan. This is the behaviour section
   20 describes ("picked up for embedding backfill … without re-running the full
   analysis"); the section 19 rule 1 pending check itself is unchanged.
7. **The vector is treated as an opaque string on the read path.** PostgREST
   serialises `vector` as its text form (`"[0.1,0.2,…]"`), so the current
   article's embedding is read as a string and handed straight back to the RPC
   without parsing. A defensive normaliser also accepts a `number[]`, in case a
   future PostgREST version returns one.
8. **`embedding` is excluded from every UI select.** `ArticleWithAnalysis`'s
   analysis embed becomes `Omit<ArticleAnalysisRow, "embedding">`, so the type
   cannot claim a field the explicit `ANALYSIS_FIELDS` list does not fetch.
9. **Related Articles is capped at 5** (section 20), replacing the current
   default of 6. `getRecentArticlesExcluding()` is deleted rather than left
   behind: section 20 replaces it, and its only caller is `read.ts`.
10. **The details page keeps its current layout and component.** Only the data
    source changes. The section already disappears on an empty list, which is
    also the "no embedding" case.

---

## 5. Files likely to change

| File | Change |
| --- | --- |
| `supabase/schema.sql` | `create extension vector`, `embedding` column, IVFFlat index, `match_related_articles` function, its grants |
| `lib/supabase/types.ts` | `embedding: string \| null` on `article_analyses` Row / Insert / Update; `match_related_articles` in `Functions` |
| `lib/ai/limits.ts` | `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `MAX_EMBEDDING_CHARS` |
| `lib/ai/embed-article.ts` | **new** — one `embed()` call, dimension check, typed result |
| `lib/supabase/queries/analyses.ts` | `toVectorLiteral`, `saveAnalysis(analysis, embedding)`, `saveEmbedding`, `getArticleIdsMissingEmbedding` |
| `lib/supabase/queries/articles.ts` | `getArticleEmbedding`, `getRelatedArticles(articleId, embedding, limit)`; delete `getRecentArticlesExcluding`; narrow the analysis embed type |
| `lib/pipeline/analyze.ts` | embed alongside analyse in `analyzeOne`; embedding backfill phase; new counters |
| `lib/pipeline/types.ts` | new failure reasons and summary/batch fields |
| `lib/articles/read.ts` | `getRelatedArticles` via embedding + cosine distance, limit 5 |
| `components/news/related-stories.tsx` | comment now describes pgvector, not the stand-in |
| `app/news/[id]/page.tsx` | unchanged unless the call signature needs it |
| `.env.example` | note that `OPENAI_API_KEY` also covers embeddings (comment only) |

---

## 6. Implementation requirements

### 6.1 Database (`supabase/schema.sql`, then Dashboard → SQL Editor)

Append a pgvector section; keep the file idempotent, and replace the existing
"the embedding column belongs to section 20" comment on `article_analyses` with
a pointer to the new section.

```sql
create extension if not exists vector;

alter table public.article_analyses
  add column if not exists embedding vector(1536);

create index if not exists article_analyses_embedding_idx
  on public.article_analyses using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create or replace function public.match_related_articles(
  p_article_id uuid,
  p_embedding vector(1536),
  p_limit integer default 5
)
returns table (article_id uuid, similarity real)
language sql
stable
security invoker
set search_path = ''
set ivfflat.probes = 10
as $$
  -- Qualified operator: pgvector lives in `extensions` on Supabase, and an
  -- unqualified `<=>` is unresolvable from an empty search path.
  select a.id,
         (1 - (an.embedding operator(extensions.<=>) p_embedding))::real
  from public.article_analyses an
  join public.articles a on a.id = an.article_id
  where an.embedding is not null
    and a.analyzed_at is not null
    and a.id <> p_article_id
  order by an.embedding operator(extensions.<=>) p_embedding
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.match_related_articles(uuid, vector, integer)
  from public, anon, authenticated;
grant execute on function public.match_related_articles(uuid, vector, integer)
  to service_role;
```

Notes to carry into the file's comments:

- The column is nullable on purpose: a row written before pgvector, or one whose
  embedding call failed, is a backfill candidate.
- `sources` is not joined inside the function — the caller re-loads full rows
  with the existing select, which already embeds `sources`.

### 6.2 Types (`lib/supabase/types.ts`)

- `article_analyses.Row`: `embedding: string | null`.
- `Insert` / `Update`: `embedding?: string | null`.
- Replace `Functions: Record<string, never>` with a `match_related_articles`
  entry: `Args: { p_article_id: string; p_embedding: string; p_limit?: number }`,
  `Returns: { article_id: string; similarity: number }[]`.
- Keep the file's "kept column-for-column with schema.sql" promise intact.

### 6.3 Embedding call (`lib/ai/limits.ts`, `lib/ai/embed-article.ts`)

`lib/ai/limits.ts` (plain data, stays non-`server-only`):

- `EMBEDDING_MODEL = "text-embedding-3-small"` — cite the verified factory and
  the 1536-dimension row in the provider docs.
- `EMBEDDING_DIMENSIONS = 1536` — must match `vector(1536)`.
- `MAX_EMBEDDING_CHARS = 8_000`.

`lib/ai/embed-article.ts` — `server-only`, mirrors `analyze-article.ts` in shape:

```ts
export type EmbedArticleResult =
  | { ok: true; embedding: number[] }
  | { ok: false; message: string };

export async function embedArticle(input: {
  title: string;
  text: string;
}): Promise<EmbedArticleResult>;
```

- `embed({ model: openai.embedding(EMBEDDING_MODEL), value })` where `value` is
  `` `${title}\n\n${text}` `` capped at `MAX_EMBEDDING_CHARS`.
- Reject a vector whose `length !== EMBEDDING_DIMENSIONS`, or that contains a
  non-finite number, with `ok: false` — a wrong-width vector would fail the
  insert anyway.
- Catch everything; never throw. No key is read, logged, or returned here.
- Do not set `maxRetries` (the default of 2 is already right).

### 6.4 Writes (`lib/supabase/queries/analyses.ts`)

- `toVectorLiteral(values: number[]): string` → `"[0.1,0.2,…]"`, the text form
  pgvector accepts. Exported so nothing else re-derives it.
- `saveAnalysis(analysis, embedding: number[] | null)`:
  upsert the analysis row with `embedding: embedding ? toVectorLiteral(embedding) : null`,
  then stamp `analyzed_at` **only when `embedding` is not null** (section 20).
  Keep the existing "insert first, stamp second" order and error messages.
- `saveEmbedding(articleId: string, embedding: number[]): Promise<void>`:
  update `article_analyses.embedding` for that `article_id`, then stamp
  `articles.analyzed_at` if it is still null. Throw with the `saveEmbedding:`
  prefix on failure.
- `getArticleIdsMissingEmbedding(): Promise<string[]>`: select `article_id` from
  `article_analyses` where `.is("embedding", null)`, newest first. No join, no
  vector column in the payload.

### 6.5 Pipeline (`lib/pipeline/analyze.ts`, `lib/pipeline/types.ts`)

`types.ts`:

- `AnalysisFailureReason` gains `"embedding_failed"` and `"embedding_save_failed"`.
- `AnalyzeBatchOutcome` gains `embedded: number`.
- `AnalyzeSummary` gains `embeddingModel: string`, `embedded: number`,
  `embeddingsBackfilled: number`, `embeddingsMissingAtEnd: number`.

`analyze.ts`:

- In `analyzeOne`, run `analyzeArticle` and `embedArticle` concurrently with
  `Promise.all` over the two promises (the embedding promise resolves to a
  result object and never rejects, so no `allSettled` gymnastics are needed).
  The existing "too little text" skip still short-circuits before either call.
- If the analysis failed, report exactly as today (the embedding is discarded).
- If the analysis succeeded and the embedding failed: `saveAnalysis(row, null)`,
  count `embedding_failed`, log a warning naming the article, and return
  `"failed"` — the article stays unstamped and is picked up by the backfill
  phase next run.
- If both succeeded: `saveAnalysis(row, embedding)` and return `"analyzed"`,
  incrementing `embedded`.
- **Backfill phase**, after the main loop and before the status is computed:
  1. `getArticleIdsMissingEmbedding()`; log the count; skip the phase when 0.
  2. Load rows with the existing `getArticlesByIds` in `batchSize` chunks and
     embed each with the same concurrency pattern as a batch.
  3. On success call `saveEmbedding`; count `embeddingsBackfilled`. On failure
     count `embedding_failed` / `embedding_save_failed` and keep going — a
     backfill failure must not fail the run's analysis result.
  4. Respect the same overall `cap`: backfill work counts toward
     `MAX_ANALYSIS_ARTICLES` so one request cannot run unbounded.
  5. Set `embeddingsMissingAtEnd` from a final `getArticleIdsMissingEmbedding()`
     count.
- Status: an embedding-only failure means `completed_with_errors`, never
  `failed`, when at least one article was analysed or backfilled. A run where
  nothing was pending and nothing needed backfill stays `completed`.
- Keep every existing log line; add lines for embedding started/finished,
  backfill started/finished, and per-article embedding failures.

### 6.6 Reads (`lib/supabase/queries/articles.ts`, `lib/articles/read.ts`)

`articles.ts`:

- Narrow the analysis embed type to `Omit<ArticleAnalysisRow, "embedding">` in
  `ArticleWithAnalysis` and `RawArticleRow`; `ANALYSIS_FIELDS` stays as it is.
- `getArticleEmbedding(articleId: string): Promise<string | null>` — select
  `embedding` from `article_analyses` by `article_id`, `maybeSingle`, return the
  text form or null. Reuse `isMiss` for a malformed uuid.
- `getRelatedArticles(articleId: string, embedding: string, limit = 5)` — the
  exact name section 20 asks for, on the service-role client:
  1. `supabase.rpc("match_related_articles", { p_article_id, p_embedding, p_limit })`.
  2. Load the returned ids with `ARTICLE_SELECT` (`.in("id", ids)`, chunked by
     `URL_EXISTENCE_CHUNK_SIZE` — 5 ids never needs a second chunk, but the cap
     is the project's rule for `.in()`).
  3. `flatten`, drop rows without an analysis, and return them in the RPC's
     order.
- Delete `getRecentArticlesExcluding`.

`read.ts`:

- `getRelatedArticles(id: string, limit = RELATED_ARTICLES_LIMIT)`: read the
  current article's embedding; return `[]` when it is null (section 20: do not
  show the section); otherwise map the cosine-ordered rows with
  `toRelatedArticle`. Export `RELATED_ARTICLES_LIMIT = 5`.
- Update the doc comment: this is a similarity search now, not a stand-in.

### 6.7 UI

- `components/news/related-stories.tsx`: the heading and markup stay; the doc
  comment now says the list is cosine-distance ordered and that the section
  renders nothing when the article has no embedding. Five cards in a
  `sm:grid-cols-2` grid leave one card on the last row, which is fine and needs
  no layout change.
- `app/news/[id]/page.tsx`: no change expected — it already calls
  `getRelatedArticles(article.id)` and renders `<RelatedStories>`.
- No new component, no client-side work, no fetching in a Client Component.

---

## 7. Security requirements

- Everything new that touches OpenAI or Supabase is `server-only`
  (`lib/ai/embed-article.ts`, the query modules already are). No embedding code
  runs in the browser (AGENTS.md section 21).
- `OPENAI_API_KEY` is read by the provider from the environment; it is never
  referenced, logged, or returned. No new environment variable is introduced,
  and nothing is added to `NEXT_PUBLIC_*`.
- `match_related_articles` is `SECURITY INVOKER`, has `search_path = ''`, and its
  `EXECUTE` is revoked from `public` / `anon` / `authenticated` and granted to
  `service_role` only.
- `article_analyses` keeps RLS enabled with no policies; the new column adds no
  grant beyond the table's existing service-role grants.
- No embedding vector is ever sent to the browser: the UI selects never include
  the column, and `getArticleEmbedding` is used only on the server.
- `POST /api/analyze` keeps requiring `x-biasly-admin-secret` (section 15); no
  route gains a GET.

---

## 8. Acceptance criteria

1. `supabase/schema.sql` contains the extension, the `embedding vector(1536)`
   column, the IVFFlat cosine index, and the function with its grants, and is
   safe to re-run.
2. `lib/supabase/types.ts` matches the schema column-for-column, including the
   new function signature.
3. A full `POST /api/analyze` run writes both the analysis row and a non-null
   `embedding`, and `articles.analyzed_at` is set only for rows that have both.
4. Pre-existing analyses with `embedding IS NULL` are backfilled by the next run
   without a second analysis call, and their `analyzed_at` ends up non-null.
5. An embedding failure leaves the analysis saved, `analyzed_at` null, and the
   run reporting `completed_with_errors` with an `embedding_failed` count — not a
   lost analysis.
6. The run summary reports `embedded`, `embeddingsBackfilled`,
   `embeddingsMissingAtEnd`, and `embeddingModel`.
7. `/news/[id]` shows up to 5 related articles ordered by cosine similarity,
   excluding the current article, and never shows an unanalysed article.
8. The Related Articles section is absent when the current article has no
   embedding.
9. No vector column appears in any UI query payload; `getRecentArticlesExcluding`
   is gone with no dangling imports.
10. `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

---

## 9. Checks to run

```bash
npm run typecheck
npm run lint
npm run build   # server modules and a page read path changed
```

---

## 10. Manual test steps

### Step 0 — apply the SQL first (required before anything else)

1. Supabase Dashboard → Database → Extensions → enable **vector**.
2. Dashboard → SQL Editor → paste and run the pgvector block from
   `supabase/schema.sql` (extension, `ALTER TABLE`, index, function, grants).
3. Confirm the column and index exist:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'article_analyses' and column_name = 'embedding';

select indexname from pg_indexes
where tablename = 'article_analyses' and indexname = 'article_analyses_embedding_idx';
```

### Step 1 — start the dev server and watch its terminal

```bash
npm run dev
```

Scrape and analysis progress is logged there (AGENTS.md section 17).

### Step 2 — backfill embeddings for the articles already analysed

```bash
curl -i -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -d '{}'
```

Expect `200`, and in the response body / terminal summary:
`embeddingsBackfilled` greater than 0 on the first call, `analyzed: 0` when
nothing was pending, and `embeddingsMissingAtEnd: 0`.

### Step 3 — analyse and embed in one pass

Scrape a few fresh articles, then analyse them:

```bash
curl -i -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -d '{"perSource": 3}'

curl -i -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -d '{"limit": 5}'
```

Expect `analyzed` and `embedded` to match, and `pendingAtEnd` to drop.

### Step 4 — verify in SQL

```sql
select count(*) as analyses,
       count(embedding) as with_embedding
from public.article_analyses;

select count(*) from public.articles
where analyzed_at is not null;
```

`with_embedding` should equal `analyses`, and the analysed-article count should
match after a clean run.

### Step 5 — verify the missing-secret guard still applies

```bash
curl -i -X POST http://localhost:3000/api/analyze -d '{}'
```

Expect `401`.

### Step 6 — Related Articles in the UI

1. Open `http://localhost:3000`, click any card.
2. The **Related Stories** section below the article body lists up to 5 other
   articles; the current article is not among them.
3. Click one: it opens its own details page with its own related list.
4. Hide check — clear one article's embedding and reload its page:

```sql
update public.article_analyses set embedding = null
where article_id = '<paste an article uuid>';
```

The section should disappear for that article. Re-run Step 2 to restore it.

### Step 7 — confirm similarity actually orders the list

```sql
select a.title, 1 - (an.embedding <=> (
         select embedding from public.article_analyses where article_id = '<uuid>'
       )) as similarity
from public.article_analyses an
join public.articles a on a.id = an.article_id
where an.embedding is not null and a.id <> '<uuid>'
order by similarity desc
limit 5;
```

The five titles here should be the five the page rendered, in the same order.
