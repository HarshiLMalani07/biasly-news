-- biasly database schema.
--
-- This file is the source of truth for the Supabase schema (AGENTS.md section 7).
-- There is no Supabase CLI or migrations directory in this project: apply this
-- file by hand in Supabase Dashboard -> SQL Editor. It is idempotent, so running
-- it again after an edit is safe.
--
-- Whenever a column is added or changed here, update `lib/supabase/types.ts` in
-- the same commit and run the ALTER SQL in the SQL Editor before testing.
--
-- Access model: every table is service-role only. biasly authenticates with
-- Clerk, not Supabase Auth, so no browser client ever talks to these tables.
-- RLS is enabled with no policies and `anon` / `authenticated` are revoked at
-- the bottom of this file.

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
-- Homepage entry pages only (AGENTS.md section 9). Scraping loads its targets
-- from here; source URLs are never hardcoded in scraping logic.

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  -- Key the per-source parser switches on when generic extraction is not
  -- enough (AGENTS.md section 11).
  parser_strategy text,
  is_active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

create index if not exists sources_is_active_idx
  on public.sources (is_active)
  where is_active;

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
-- Append-only (AGENTS.md section 10). `url` is the dedupe key; `canonical_url`
-- is unique too so two candidates that resolve to the same canonical page
-- cannot both land.
--
-- `image_url` and `published_at` are NOT NULL on purpose: AGENTS.md section 13
-- rejects an article that is missing either, so the gate lives in the database
-- as well as in the validation code.

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  url text not null unique,
  canonical_url text unique,
  title text not null,
  image_url text not null,
  published_at timestamptz not null,
  raw_text text not null,
  scraped_at timestamptz not null default now(),
  -- Null until a valid analysis has been saved (AGENTS.md section 19 rule 6).
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

create index if not exists articles_source_id_idx
  on public.articles (source_id);

create index if not exists articles_analyzed_at_idx
  on public.articles (analyzed_at);

-- ---------------------------------------------------------------------------
-- article_analyses
-- ---------------------------------------------------------------------------
-- One row per article. The checks mirror the output rules in AGENTS.md
-- section 19, so invalid AI output cannot be stored even if validation in code
-- is bypassed.
--
-- The `embedding vector(1536)` column belongs to AGENTS.md section 20 and is
-- added there, after pgvector is enabled. It is deliberately absent here.

create table if not exists public.article_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles (id) on delete cascade,
  summary text not null,
  sentiment_score real not null check (sentiment_score between -1 and 1),
  sentiment_label text not null
    check (sentiment_label in ('positive', 'neutral', 'negative')),
  -- Derived as (right_percentage - left_percentage) / 100.
  bias_score real not null check (bias_score between -1 and 1),
  bias_label text not null
    check (bias_label in ('left', 'center', 'right', 'mixed', 'unclear')),
  left_percentage smallint not null check (left_percentage between 0 and 100),
  center_percentage smallint not null check (center_percentage between 0 and 100),
  right_percentage smallint not null check (right_percentage between 0 and 100),
  confidence real not null check (confidence between 0 and 1),
  framing_notes text,
  loaded_terms text[] not null default '{}',
  disclaimer text,
  model text not null,
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_total_check
    check (left_percentage + center_percentage + right_percentage = 100)
);

-- ---------------------------------------------------------------------------
-- logs
-- ---------------------------------------------------------------------------
-- The only high-volume append-only table, so it uses an identity bigint rather
-- than a uuid. `scope` is free text ('scrape', 'analyze', 'scheduler', 'cron')
-- so later pipeline stages can add their own without a migration.

create table if not exists public.logs (
  id bigint generated always as identity primary key,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  scope text not null,
  message text not null,
  context jsonb,
  -- Groups every line emitted by one pipeline run.
  run_id text,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx
  on public.logs (created_at desc);

create index if not exists logs_run_id_idx
  on public.logs (run_id);

-- ---------------------------------------------------------------------------
-- oxylabs_schedules
-- ---------------------------------------------------------------------------
-- `schedule_id` is TEXT, not bigint. Oxylabs schedule and job ids are 64-bit
-- integers that exceed Number.MAX_SAFE_INTEGER; AGENTS.md section 18 requires
-- them to be read from the raw HTTP response text and carried as strings, so
-- storing them as text keeps the exact digit sequence intact.

create table if not exists public.oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.sources (id) on delete cascade,
  schedule_id text not null unique,
  cron_expression text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- oxylabs_schedule_runs
-- ---------------------------------------------------------------------------
-- One row per job inside a schedule run. `result_status` mirrors the value
-- returned by GET /schedules/{id}/runs; only 'done' jobs may be fetched
-- (AGENTS.md section 18).

create table if not exists public.oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id text not null
    references public.oxylabs_schedules (schedule_id) on delete cascade,
  job_id text not null,
  result_status text,
  run_at timestamptz,
  -- Null until the scrape-to-insert pipeline has consumed this job's HTML.
  processed_at timestamptz,
  articles_inserted integer not null default 0,
  created_at timestamptz not null default now(),
  unique (schedule_id, job_id)
);

create index if not exists oxylabs_schedule_runs_processed_at_idx
  on public.oxylabs_schedule_runs (processed_at);

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
-- RLS is enabled on every table and no policy is created. With no policy, a
-- non-superuser role sees nothing even if a GRANT is ever added by mistake.
-- `service_role` bypasses RLS by design and is the only role biasly uses.

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_analyses enable row level security;
alter table public.logs enable row level security;
alter table public.oxylabs_schedules enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;

revoke all on table public.sources from anon, authenticated;
revoke all on table public.articles from anon, authenticated;
revoke all on table public.article_analyses from anon, authenticated;
revoke all on table public.logs from anon, authenticated;
revoke all on table public.oxylabs_schedules from anon, authenticated;
revoke all on table public.oxylabs_schedule_runs from anon, authenticated;

grant select, insert, update, delete on table public.sources to service_role;
grant select, insert, update, delete on table public.articles to service_role;
grant select, insert, update, delete on table public.article_analyses to service_role;
grant select, insert, update, delete on table public.logs to service_role;
grant select, insert, update, delete on table public.oxylabs_schedules to service_role;
grant select, insert, update, delete on table public.oxylabs_schedule_runs to service_role;

grant usage, select on sequence public.logs_id_seq to service_role;
