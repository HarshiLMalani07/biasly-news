# biasly

AI-powered news analysis. biasly scrapes real news articles, analyzes them with AI, and shows the sentiment, political framing, and bias breakdown behind each story.

## What it does

- Scrapes articles from configured news sources (Oxylabs Web Scraper API)
- Analyzes each article with OpenAI: neutral summary, sentiment, left/center/right framing, confidence, loaded terms
- Stores everything in Supabase
- Shows news cards on the home page and a full analysis on each article page
- Finds related articles using pgvector similarity search
- Runs the whole pipeline automatically on a schedule (Oxylabs Scheduler + Vercel Cron)

## Tech stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Clerk · Supabase (Postgres + pgvector) · Oxylabs · Vercel AI SDK + OpenAI · Zod · PostHog

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open http://localhost:3000

Run the SQL in `supabase/schema.sql` in your Supabase project, enable the `vector` extension, and add at least one active row to the `sources` table.

## API routes

All action routes require the `x-biasly-admin-secret` header.

| Route | Method | What it does |
| --- | --- | --- |
| `/api/scrape` | POST | Scrape active sources and insert new articles |
| `/api/analyze` | POST | Run AI analysis + embeddings on pending articles |
| `/api/sources` | GET | List sources |
| `/api/oxylabs/schedules` | POST / GET | Create or list hourly Oxylabs schedules |
| `/api/oxylabs/runs` | GET | List scheduler runs |
| `/api/oxylabs/scheduled-results/process` | POST | Process completed scheduler results |
| `/api/cron/pipeline` | GET | Internal — Vercel Cron only, protected by `CRON_SECRET` |

Example:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"limitPerSource": 5}'
```

Watch the `npm run dev` terminal — scrape and analysis progress is logged there.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Disclaimer

Political framing scores are **AI-estimated**, not objective truth. Treat them as a starting point, not a verdict.
