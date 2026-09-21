# Prompt: biasly News Details Page UI

## Goal

Implement the attached **news details page** mock as the app's `/news/[id]` route: the existing
utility bar and masthead, then a two-column reading layout — an article column (eyebrow, headline,
byline with Save / Share actions, hero image with caption and credit, a **Bias Distribution** card,
the article body, and a **Related Stories** grid) beside a sidebar of three analysis cards
(**Bias Analysis**, **AI Summary**, **Source Breakdown**) — closed by a newsletter band and the
existing dark site footer.

This is a **UI task only**. It builds no Supabase layer, no Clerk wiring, no scraping, no AI
analysis, no pgvector, and no `/api` routes. It renders typed demo fixtures through presentational
server components so that when the Supabase read layer lands, only the data-loading line changes.

Per AGENTS.md section 5 the UI displays stored data only — no component in this task imports a
database client, calls Oxylabs or OpenAI, or mutates pipeline state.

## Skills read

- `AGENTS.md` — sections 1 (scope: *news details page with full article analysis*), 5 (architecture
  layers: UI displays stored data only), 6 (tech stack), 7 (the `articles` / `article_analyses`
  field lists the fixture type must mirror), 19 (what the details page must show: summary,
  sentiment, framing percentages, confidence, framing notes, loaded terms, disclaimer; framing is
  **AI-estimated**, never objective truth), 20 (Related Articles comes from pgvector later),
  21 (security, code standards), 22 (checks)
- `prompts/design-system.md` — the approved token layer, type scale, grid, spacing rules and
  primitive contracts this page consumes rather than re-derives
- `prompts/homepage-ui.md` — the approved sibling page: chrome composition order, fixture strategy,
  colour/typography tables this page must stay consistent with
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` —
  `[folderName]` segments, `params` as a promise, and the `PageProps<'/route'>` helper
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — page props,
  and the **Page Props Helper**: `PageProps` is globally available after typegen, no import
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` — `notFound()`
  must be called in the render path (a component, or a function a component `await`s)
- `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` — `next/image` `fill` inside
  a sized relative wrapper, `sizes`, and the already-configured `images.remotePatterns`
- No Clerk / Supabase / Oxylabs / AI SDK skill is needed: this task touches no auth, database,
  scraping, or model code.

## Existing code inspected

- `app/layout.tsx` — Poppins on `--font-poppins`, `html.h-full antialiased`,
  `body.min-h-full flex flex-col`, Next 16 `LayoutProps<"/">` typing. **Untouched by this task.**
- `app/globals.css` — the v1.0 token layer: `--color-text-primary #0d0d0f`,
  `--color-text-secondary #6b7280`, `--color-surface #f6f6f6`, `--color-bias-left #b42318`,
  `--color-bias-center #e5e7eb`, `--color-bias-right #1d4ed8`, `--color-bg-primary #ffffff`,
  `--color-bg-secondary #f0f0f0`, `--color-border #e5e7eb`, shadows `sm`/`md`/`lg`, radii, and the
  `.text-h1 … .text-caption` + `.text-card-title` composed classes plus `.container-biasly` /
  `.grid-biasly`. **No new token or type class is needed by this task.**
- `app/page.tsx` — the home route: `UtilityBar`, `SiteHeader`, `TopicRail`, `TopNewsSection`, the
  design-system sheet, `SiteFooter`. This task edits nothing here.
- `components/layout/utility-bar.tsx`, `site-header.tsx`, `site-footer.tsx` — reusable as-is.
  `topic-rail.tsx` exists but the mock's details page does **not** show the rail (decision 4).
- `components/ui/button.tsx` — cva variants `primary` / `secondary` / `outline` / `text`, sizes
  `default` (h-10) / `sm` (h-8) / `lg` / `icon`, `asChild`, `forceHover`.
- `components/ui/card.tsx` — `Card`: `flex flex-col gap-4 rounded-lg border border-border bg-bg-primary p-4 shadow-sm`, plus `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` /
  `CardFooter` / `CardAction`.
- `components/ui/separator.tsx` — radix separator, **`"use client"`**. Not used by this task; a
  plain `border-t border-border` div keeps the whole page a server tree (decision 7).
- `components/ui/badge.tsx` — variants `default` / `secondary` / `outline` / `left` / `center` /
  `right`. Used for the loaded-term chips.
- `components/ui/chip.tsx` — pill with a trailing `Plus`; the `+` affordance is wrong for loaded
  terms, so `Badge variant="secondary"` is used instead.
- `components/bias/bias-meter.tsx` — `full` (h-8, `Left {n}%` labels, plus a `0% / 50% / 100%`
  scale row) and `compact` (h-[22px], `L {n}%` label, no scale row) variants; zero-value segments
  dropped; `role="img"` with an aria-label naming all three percentages; percentages passed
  through `normalizeBiasPercentages`. The mock's Bias Distribution bar needs full-word labels
  **without** the scale row — see decision 2.
- `components/news/news-card.tsx` — the vertical feed card. Currently not a link; this task wraps
  it (decision 3).
- `components/news/top-news-section.tsx` — `Top News` heading + the 3-up grid.
- `components/news/article-card.tsx` — the horizontal design-system-sheet card. **Untouched**: the
  mock's related-story item is a different, much smaller object (decision 6).
- `lib/bias.ts` — `BiasPercentages` + `normalizeBiasPercentages()` (clamps, rescales to exactly
  100, largest-remainder rounding, never throws in render).
- `lib/demo/top-news.ts` — `HomeArticle` (`id`, `title`, `category`, `country`, `sourceName`,
  `publishedLabel`, `imageUrl`, `imageAlt`, `sourceCount`, `bias`, `sentimentLabel`,
  `framingLabel`, `confidence`), `SentimentLabel`, `FramingLabel`, and the 12 demo articles. Its
  `id` field is already documented as "the `/news/[id]` segment later" — this task is that later.
- `next.config.ts` — `images.remotePatterns` already scoped to `https://images.unsplash.com/**`.
  **No change needed**; the details page reuses the same fixture photos.
- **Verified** in `lucide-react@1.47.0`: `Bookmark`, `Share2`, `MoreHorizontal`, `Info`, `Clock`,
  `ChevronRight`, `ArrowLeft` all exist.
- **Verified**: `components/ui/` has **no** `input.tsx`. The newsletter band needs one (decision 8).

## Decisions and assumptions

1. **Route is `/news/[id]`, data comes from typed demo fixtures.** No Supabase layer exists. A new
   `lib/demo/article-detail.ts` exports an `ArticleDetail` type shaped after the future `articles` +
   `article_analyses` join (AGENTS.md sections 7 and 19) and a `getArticleDetail(id)` lookup. When
   Supabase lands, only that lookup's body changes.
2. **`BiasMeter` gains one optional prop, `showScale`,** defaulting to `variant === "full"`. The
   mock's Bias Distribution bar wants the `full` variant's height and full-word labels but shows
   `12 sources` beneath it instead of the `0% / 50% / 100%` scale. One optional boolean is cheaper
   than a third variant and leaves both existing call sites byte-identical in output.
3. **Home feed cards become links.** `top-news-section.tsx` wraps each `NewsCard` in
   `<Link href={`/news/${article.id}`}>`; `NewsCard` itself stays presentational and only gains a
   `hover:shadow-md transition-shadow` class through its existing `className` prop. Wrapping at the
   section keeps the card reusable in non-navigating contexts (the design-system sheet).
4. **No topic rail on the details page.** The mock shows the utility bar and masthead, then a
   border, then content. The rail is a home-feed discovery affordance and is omitted here.
5. **Fixtures cover all 12 articles, not just the mock's.** Every home card is clickable, so every
   id must resolve. The featured article (`trump-iran-revised-peace-proposal`) carries the mock's
   exact copy — headline, byline, caption, eight body paragraphs, five summary bullets, the eight
   `Top Sources` rows. The other 11 are composed by a deterministic `buildDetail()` helper from
   their existing `HomeArticle` fields, so the file stays readable instead of 900 lines of prose.
   An unknown id calls `notFound()`.
6. **Related Stories is a new, small `RelatedStoryCard`**, not `ArticleCard`. The mock's item is a
   72×56 thumbnail beside a two-line title with an eyebrow and a meta line — no description, no
   bias meter, no read-time icons. Branching `ArticleCard` on a size prop would fork every line of
   its body. The demo picks the first six *other* fixture articles; AGENTS.md section 20 replaces
   this with `getRelatedArticles()` cosine-distance results later, and the component's props are
   shaped so that swap is a data change only.
7. **The whole page stays a server tree — no `"use client"` anywhere.** Save / Share / `…`,
   `How We Analyze Bias`, `Provide Feedback`, `View All Sources` and the newsletter form are
   presentational: styled, focusable, and inert until their features exist. Dividers are
   `border-t border-border` divs rather than the client-side radix `Separator`.
8. **A new `components/ui/input.tsx`** is added for the newsletter field — a shadcn-shaped
   `React.ComponentProps<"input">` wrapper carrying the token-level border, radius, height and
   focus ring. It is the design system's missing primitive, not page-local markup. The newsletter
   block is **not** wrapped in a `<form>`, so pressing Enter cannot navigate or reload; the button
   is `type="button"`.
9. **Section 19 fields the mock does not draw are still shown**, because AGENTS.md requires the
   details page to show the full analysis:
   - **framing notes** → the Bias Analysis card's explanatory paragraph (the mock's "Our analysis
     is based on the political leaning of the publication…" slot).
   - **disclaimer** → the line under the AI Summary bullets (the mock's "AI summaries can make
     mistakes.").
   - **sentiment label + confidence** → a small meta row inside the Bias Analysis card, beneath the
     per-side rows: `Sentiment: Negative · Confidence 78%`.
   - **loaded terms** → a `Loaded Terms` block of `Badge variant="secondary"` chips at the foot of
     the Bias Analysis card, above the button.
   - **model name** → a `.text-caption` credit line under the AI Summary disclaimer
     (`Analysed by gpt-5-mini`).
   These four additions sit inside the mock's existing card frames and change no other spacing.
10. **`Source Breakdown`'s per-outlet list has no database backing yet.** AGENTS.md section 7
    stores one source per article, not a per-story outlet roster. It is therefore typed as
    `demoSourceBreakdown` on the fixture and commented as demo-only UI, so nobody mistakes it for a
    schema requirement.
11. **`generateStaticParams` + `generateMetadata` are included.** The fixture is fully static, so
    the 12 detail pages prerender; metadata gives each page a real title and description. Both are
    a few lines and are the Next 16 convention for this route shape.
12. **The sidebar sticks on large screens** (`lg:sticky lg:top-6 self-start`) so the analysis stays
    visible while the body scrolls — one utility pair, no JavaScript.

## Files likely to change

**New**

| File | Purpose |
| --- | --- |
| `app/news/[id]/page.tsx` | The route: resolves `params`, looks up the fixture, composes the page |
| `app/news/[id]/not-found.tsx` | Chrome + "Article not found" message + link home |
| `lib/demo/article-detail.ts` | `ArticleDetail` type, `getArticleDetail()`, `getRelatedArticles()` demo lookups |
| `components/news/article-header.tsx` | Eyebrow, `h1`, byline, Save / Share / `…` actions |
| `components/news/article-hero.tsx` | Hero image + caption + photo credit |
| `components/news/article-body.tsx` | The paragraph stack |
| `components/news/bias-distribution-card.tsx` | The in-body bias bar card + `N sources` |
| `components/news/related-stories.tsx` | Heading + 2-up grid |
| `components/news/related-story-card.tsx` | Thumbnail + eyebrow + title + meta, wrapped in a `Link` |
| `components/analysis/analysis-card.tsx` | Shared sidebar card shell: title + `ⓘ` + body + optional footer |
| `components/analysis/bias-breakdown-row.tsx` | `Label · value · mini bar` row, shared by two cards |
| `components/analysis/bias-analysis-card.tsx` | Overall bias, per-side rows, notes, sentiment/confidence, loaded terms |
| `components/analysis/ai-summary-card.tsx` | Generated meta, bullets, disclaimer, model, feedback button |
| `components/analysis/source-breakdown-card.tsx` | Totals, per-side rows, Top Sources table, button |
| `components/marketing/newsletter-cta.tsx` | The "Stay Informed. Stay Balanced." band |
| `components/ui/input.tsx` | Design-system text input primitive |

**Edited**

| File | Change |
| --- | --- |
| `components/bias/bias-meter.tsx` | Add the optional `showScale` prop (decision 2) |
| `components/news/top-news-section.tsx` | Wrap each card in a `Link` to `/news/[id]` (decision 3) |
| `components/news/news-card.tsx` | Hover shadow + `group-hover` title colour only; no structural change |

**Untouched**: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`,
`components/news/article-card.tsx`, `components/layout/*`, `lib/bias.ts`, `lib/demo/top-news.ts`.

## Implementation requirements

### 1. `lib/demo/article-detail.ts`

```ts
export type SourceBias = "left" | "center" | "right";

export type ArticleDetail = {
  id: string;                    // matches HomeArticle.id
  title: string;
  category: string;
  country: string;
  sourceName: string;
  authorName: string;            // articles.author (demo)
  publishedLabel: string;        // "May 31, 2026"
  publishedIso: string;          // "2026-05-31" - <time dateTime>
  readTimeLabel: string;         // "12 min read"
  imageUrl: string;
  imageAlt: string;
  heroCaption: string;
  heroCredit: string;            // "Photo: Andrew Harnik/Getty Images"
  paragraphs: readonly string[]; // articles.raw_text, split
  sourceCount: number;
  bias: BiasPercentages;         // left + center + right = 100
  biasScore: number;             // (right - left) / 100, AGENTS.md s.7
  framingLabel: FramingLabel;
  sentimentLabel: SentimentLabel;
  sentimentScore: number;        // -1..1
  confidence: number;            // 0..1
  summaryBullets: readonly string[];  // article_analyses.summary
  summaryGeneratedLabel: string;
  summaryReadTimeLabel: string;
  framingNotes: string;
  loadedTerms: readonly string[];
  disclaimer: string;
  model: string;
  demoSourceBreakdown: {              // decision 10 - no schema backing yet
    counts: { left: number; center: number; right: number };
    topSources: readonly { name: string; bias: SourceBias }[];
  };
};
```

- `getArticleDetail(id: string): ArticleDetail | undefined` — record lookup, no throw.
- `getRelatedArticles(id: string, limit = 6): readonly HomeArticle[]` — the first `limit` fixture
  articles whose id differs. Document that pgvector replaces the body (AGENTS.md section 20).
- `buildDetail(article: HomeArticle, overrides?: Partial<ArticleDetail>): ArticleDetail` — fills
  the demo prose deterministically from the home fixture, then applies overrides. The featured
  article passes the mock's real copy as overrides.
- Every fixture's `bias` must already sum to exactly 100 before `normalizeBiasPercentages` sees it,
  and `biasScore` must equal `(right − left) / 100`.
- `demoSourceBreakdown.counts` must sum to `sourceCount`, and each count's share must round to its
  bias percentage (featured: 12 sources → 2 / 4 / 6 shown as 20% / 31% / 49%, matching the mock).
- Top-level comment: demo data, no real reporting, framing splits illustrative not AI-estimated.

### 2. `app/news/[id]/page.tsx`

```tsx
export function generateStaticParams() { /* every fixture id */ }
export async function generateMetadata(props: PageProps<'/news/[id]'>): Promise<Metadata> { … }
export default async function NewsDetailPage(props: PageProps<'/news/[id]'>) {
  const { id } = await props.params;
  const article = getArticleDetail(id);
  if (!article) notFound();
  …
}
```

- `PageProps` is global after typegen — **do not import it**, and do not hand-write
  `{ params: Promise<{ id: string }> }`.
- `notFound()` is called in the render path, before any JSX (per the Next 16 doc).
- `generateMetadata` returns `title: \`${article.title} — biasly\`` and a description built from the
  first summary bullet.
- Composition order: `<UtilityBar />`, `<SiteHeader />`, then
  `<main className="flex-1 bg-surface">` containing:
  1. `<div className="container-biasly py-8">` with `<div className="grid-biasly">`:
     - article column `col-span-12 lg:col-span-8`
     - sidebar `col-span-12 lg:col-span-4 lg:sticky lg:top-6 self-start` holding the three
       analysis cards in a `flex flex-col gap-6`
  2. `<NewsletterCta />` inside the same container, `pb-8`
  then `<SiteFooter />`.
- Article column order: `<ArticleHeader />`, `<ArticleHero />`, `<BiasDistributionCard />`,
  `<ArticleBody />`, `<RelatedStories />`.
- The page is a server component. No `"use client"` in its tree.

### 3. `components/news/article-header.tsx`

- Eyebrow: `.text-caption` — `{category}` in `text-text-primary`, `{" · "}{country}` in
  `text-text-secondary` (identical treatment to `NewsCard`).
- `<h1 className="text-h1 mt-2 text-text-primary">` — the mock's two-line headline. Allow it to
  wrap; never clamp.
- Byline row, `mt-4`, `flex flex-wrap items-center justify-between gap-4`:
  - Left: `.text-body-sm text-text-secondary`, `By {authorName}`, then
    `<time dateTime={publishedIso}>{publishedLabel}</time>`, then `{readTimeLabel}`, separated by
    thin `text-border` pipes (`<span aria-hidden>|</span>`), `gap-3`.
  - Right: `Save` + `Bookmark`, `Share` + `Share2`, and a `MoreHorizontal` button, rendered as
    `Button variant="text" size="sm"` with `aria-label`s; icons at `size={16} strokeWidth={2}`.
    Labels hidden below `sm` (`hidden sm:inline`), icons always visible.

### 4. `components/news/article-hero.tsx`

- `<figure>`; image wrapper `relative aspect-[16/9] w-full overflow-hidden rounded-md`;
  `next/image` with `fill`, `priority`, `sizes="(min-width: 1024px) 832px, 100vw"`,
  `className="object-cover"`.
- `<figcaption className="mt-2 text-caption text-text-secondary">` with the caption on one line and
  the credit on the next (`block` spans), exactly as the mock stacks them.

### 5. `components/news/bias-distribution-card.tsx`

- `Card` with `gap-3 mt-6`.
- Header row: `Bias Distribution` at `.text-body-sm font-semibold text-text-primary` +
  `Info size={14}` in `text-text-secondary` with a `title`/`aria-label` naming the meter as
  **AI-estimated**.
- `<BiasMeter {...bias} variant="full" showScale={false} />`.
- Footer line: `{sourceCount} sources` at `.text-caption text-text-secondary`.

### 6. `components/news/article-body.tsx`

- `<div className="mt-6 flex flex-col gap-4">` of `<p className="text-body-lg text-text-primary">`.
- Takes `paragraphs: readonly string[]`; renders them in order, no clamping, no `dangerouslySetInnerHTML`.

### 7. `components/news/related-stories.tsx` + `related-story-card.tsx`

- Section: `mt-8 border-t border-border pt-6`; heading `Related Stories` as
  `<h2 className="text-card-title text-text-primary">`; grid `mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2`.
- Card: `<Link href={`/news/${id}`} className="group flex gap-3">`:
  - thumbnail `relative h-14 w-[72px] shrink-0 overflow-hidden rounded-sm` with `fill`,
    `sizes="72px"`, `object-cover`;
  - right column: eyebrow `.text-caption` (same two-tone treatment), title
    `.text-body-sm font-semibold line-clamp-2 group-hover:text-bias-right transition-colors`, meta
    `.text-caption text-text-secondary` — `{publishedLabel} · {readTimeLabel}`.

### 8. `components/analysis/analysis-card.tsx`

- Props: `{ title: string; infoLabel: string; children: React.ReactNode; footer?: React.ReactNode }`.
- `Card` with `gap-4`; header row `flex items-center justify-between`: `<h2 className="text-card-title text-text-primary">` + `Info size={16}` in `text-text-secondary` carrying
  `role="img"`, `aria-label={infoLabel}` and `title={infoLabel}`.
- `footer` renders after a `border-t border-border pt-4` divider when present.

### 9. `components/analysis/bias-breakdown-row.tsx`

One row, used by both the Bias Analysis and Source Breakdown cards:

- Props: `{ label: "Left" | "Center" | "Right"; value: string; percent: number; tone: SourceBias }`.
- Layout: `flex items-center gap-3` — label `.text-body-sm text-text-primary` (`w-14 shrink-0`),
  `value` `.text-body-sm text-text-secondary` (`w-16 shrink-0`, e.g. `20%` or `2 (20%)`), then a
  track `h-2 flex-1 overflow-hidden rounded-full bg-bias-center` holding a fill
  `h-full rounded-full` with `style={{ width: `${percent}%` }}` and
  `bg-bias-left` / `bg-bias-center` / `bg-bias-right` by `tone`.
- The `center` tone's fill uses `bg-text-secondary/30` so it stays visible against the
  `bg-bias-center` track (the mock shows the centre bar as a near-white fill on grey).
- `percent` is clamped to `0–100` in the component; it must never render a width outside that.

### 10. `components/analysis/bias-analysis-card.tsx`

Inside `AnalysisCard title="Bias Analysis"`:

1. `Overall Bias` at `.text-caption font-semibold text-text-primary`.
2. `{FramingLabel capitalised} {dominant}%` at `.text-h2`, coloured by framing label:
   `left → text-bias-left`, `right → text-bias-right`, `center / mixed / unclear → text-text-primary`.
   A `AI-estimated` `Badge variant="secondary"` sits beside it — AGENTS.md section 19 forbids
   presenting framing as objective truth.
3. `Based on {sourceCount} balanced sources` at `.text-body-sm text-bias-right`.
4. Divider, then three `BiasBreakdownRow`s (`Left {n}%`, `Center {n}%`, `Right {n}%`).
5. `Sentiment: {label} · Confidence {Math.round(confidence * 100)}%` at
   `.text-caption text-text-secondary` (decision 9).
6. Divider, then `framingNotes` at `.text-body-sm text-text-secondary`.
7. `Loaded Terms` label at `.text-caption font-semibold` + a `flex flex-wrap gap-2` of
   `Badge variant="secondary"` chips. Render the block only when `loadedTerms.length > 0`.
8. `footer`: `<Button variant="secondary" className="w-full">How We Analyze Bias</Button>`.

### 11. `components/analysis/ai-summary-card.tsx`

Inside `AnalysisCard title="AI Summary"`:

1. `Generated {summaryGeneratedLabel} · {summaryReadTimeLabel}` at `.text-caption text-text-secondary`.
2. `<ul className="flex list-disc flex-col gap-3 pl-4">` of `.text-body-sm text-text-primary` items.
3. `disclaimer` at `.text-caption text-text-secondary`.
4. `Analysed by {model}` at `.text-caption text-text-secondary` (decision 9).
5. `footer`: `<Button variant="secondary" size="sm">Provide Feedback</Button>` — auto width,
   left-aligned, as the mock draws it.

### 12. `components/analysis/source-breakdown-card.tsx`

Inside `AnalysisCard title="Source Breakdown"`:

1. `{sourceCount} Total Sources` at `.text-body-sm font-semibold text-text-primary`.
2. Three `BiasBreakdownRow`s with `value={`${count} (${percent}%)`}`.
3. Divider, then a header row `Top Sources` / `Bias` at `.text-caption text-text-secondary`.
4. Rows: name at `.text-body-sm text-text-primary`, bias label right-aligned at
   `.text-body-sm` in `text-bias-left` / `text-text-secondary` / `text-bias-right` by tone, each row
   `flex items-center justify-between gap-3`, list `flex flex-col gap-2`.
5. `footer`: `<Button variant="secondary" className="w-full">View All Sources</Button>`.

### 13. `components/ui/input.tsx` and `components/marketing/newsletter-cta.tsx`

`Input`: `React.ComponentProps<"input">` + `className`, `data-slot="input"`, classes
`h-10 w-full rounded-md border border-border bg-bg-primary px-3 text-[14px] text-text-primary placeholder:text-text-secondary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:cursor-not-allowed disabled:bg-bg-secondary`.

`NewsletterCta`: a `Card` with `p-6 gap-6 md:flex-row md:items-center md:justify-between`:
- Left: `<h2 className="text-h3 text-text-primary">Stay Informed. Stay Balanced.</h2>` and
  `<p className="text-body-md mt-1 text-text-secondary">Get the top stories and bias analysis delivered to your inbox.</p>`.
- Right: `flex w-full gap-3 md:w-auto` — `<Input type="email" placeholder="Enter your email" aria-label="Email address" className="md:w-64" />` and
  `<Button type="button" variant="primary">Subscribe</Button>`.
- No `<form>` element (decision 8).

### 14. `components/bias/bias-meter.tsx` (edit)

- Add `showScale?: boolean` to `BiasMeterProps`, documented as "overrides the variant's default
  scale row".
- `const withScale = showScale ?? isFull;` — the scale row renders on `withScale`; the bar height
  and label length stay driven by `variant`. Both existing call sites keep their current output.

### 15. `components/news/top-news-section.tsx` + `news-card.tsx` (edit)

- Section: wrap each card — `<Link key={article.id} href={`/news/${article.id}`} className="group block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2 focus-visible:outline-none">` around `<NewsCard … />` (drop the now-duplicated `key` on the card).
- `NewsCard`: add `transition-shadow group-hover:shadow-md` to the root and
  `group-hover:text-bias-right transition-colors` to the `h3`. No other change; its props, its
  `ⓘ` badge and its meter stay exactly as they are.

### 16. `app/news/[id]/not-found.tsx`

`UtilityBar`, `SiteHeader`, a `container-biasly py-16` block with
`<h1 className="text-h1">Article not found</h1>`, a `.text-body-md text-text-secondary` line, a
`<Button asChild variant="secondary"><Link href="/">Back to Top News</Link></Button>`, then
`SiteFooter`.

## Visual interpretation

The page reads as a newspaper spread: a single column of black-on-off-white type carrying the
story, and a rail of white analysis cards beside it that never competes with the prose. The only
saturated colour on the page is the framing palette — the red/grey/blue bar under the photo, the
blue `Right 49%` in the sidebar, and the per-outlet bias labels. Everything else is `#0D0D0F` on
`#F6F6F6`, with white reserved for cards.

Reading order: eyebrow → headline → byline → photograph → bias bar → body. Placing the bias bar
between the photo and the first paragraph is deliberate in the mock: the reader sees how the story
is framed *before* reading it, which is the product's entire argument. Keep that order.

The sidebar's three cards share one rhythm — 16px semibold title with a `ⓘ` at the right edge, a
small meta line, a body block, a divider, a full-width (or left-aligned) secondary button. That
repetition is what makes the rail scan as one instrument panel rather than three widgets.

### Colours

Every value comes from the existing token layer. No new colours, no Tailwind palette names.

| Region | Background | Foreground |
| --- | --- | --- |
| Utility bar / footer | `bg-text-primary` `#0D0D0F` | `text-bg-primary` at 100 / 70 / 60 / 50% |
| Header | `bg-surface` `#F6F6F6` | `text-text-primary`, nav rest `text-text-secondary` |
| Page ground | `bg-surface` `#F6F6F6` | body copy `text-text-primary` |
| Cards (bias distribution, sidebar, newsletter) | `bg-bg-primary` `#FFFFFF`, `border-border`, `shadow-sm` | title `text-text-primary`, meta `text-text-secondary` |
| Bias bar / mini bars | `bg-bias-left` `#B42318` / `bg-bias-center` `#E5E7EB` / `bg-bias-right` `#1D4ED8` | white / `text-text-primary` / white |
| Overall bias figure, "balanced sources", right-leaning outlets | — | `text-bias-right` `#1D4ED8` |
| Left-leaning outlets | — | `text-bias-left` `#B42318` |
| Centre outlets, captions, credits, disclaimers | — | `text-text-secondary` `#6B7280` |

### Typography

| Element | Class | Resolved |
| --- | --- | --- |
| Article headline | `.text-h1` | 32px / 700 / 1.2 |
| Newsletter heading | `.text-h3` | 20px / 600 / 1.3 |
| Overall bias figure | `.text-h2` | 24px / 600 / 1.3 |
| Sidebar card titles, `Related Stories` | `.text-card-title` | 16px / 600 / 1.35 |
| Body paragraphs | `.text-body-lg` | 16px / 400 / 1.6 |
| Byline, bullets, breakdown rows, outlet rows, related titles | `.text-body-sm` | 13px / 400 / 1.6 |
| Newsletter subtext | `.text-body-md` | 14px / 400 / 1.6 |
| Eyebrows, captions, credit, meta, disclaimer, model, loaded-term label | `.text-caption` | 11px / 400 / 1.4 |
| Buttons | `size="default"` / `size="sm"` | 14px / 13px, 500 |

No component may write a raw `text-[Npx] font-* leading-*` triple. `font-semibold` layered onto a
scale class (as `NewsCard` already does) is allowed; a new size is not — if a pairing is genuinely
missing it goes into `@layer components` in `globals.css`, as `.text-card-title` did.

### Spacing and layout

4px base unit only — `gap-2 / 3 / 4 / 6`, `p-4 / p-6`, `py-8 / py-16`, `mt-1 / 2 / 4 / 6 / 8`,
`pt-4 / pt-6`. No `p-5`, no arbitrary `p-[18px]`.

- Container: `.container-biasly` (1280px, 24px side padding). Never re-derive it inline.
- Grid: `.grid-biasly` (12 columns, 24px gutter). Article `lg:col-span-8`, sidebar `lg:col-span-4`.
- Article column width at 1280px: `(1280 − 48) × 8/12 − 16 ≈ 805px` — the hero's `sizes` attribute
  is calculated from this.
- Vertical rhythm in the article column: headline `mt-2` under the eyebrow, byline `mt-4`, hero
  `mt-4`, bias card `mt-6`, first paragraph `mt-6`, paragraph gap `gap-4`, related section
  `mt-8 pt-6` above its own top border.
- Sidebar cards: `p-4`, `gap-4` internally, `gap-6` between cards.
- Radii: cards `rounded-lg` (12px), hero and thumbnails `rounded-md` / `rounded-sm`, bias bar
  `rounded-sm`, mini bars and badges fully round.

### Pixel-perfect expectations

- The Bias Distribution segments' widths are exactly their percentages: `20% / 31% / 49%` for the
  featured article, with full words (`Left 20%`, not `L 20%`) and **no** `0% / 50% / 100%` row.
- The three sidebar mini bars are the same length and start at the same x; only their fills differ.
- The sidebar's `ⓘ` icons align on one vertical axis with each card's title baseline.
- Each sidebar card's button sits flush against the card's inner padding, full width on
  `Bias Analysis` and `Source Breakdown`, auto width on `AI Summary`.
- Related-story thumbnails are all 72×56 and their titles clamp at two lines, so all six rows in a
  column share a baseline regardless of title length.
- Body paragraphs are a single measure — they never run edge to edge under the sidebar.
- The hero image is flush with the headline's left edge and the article column's right edge.

### Responsiveness

Mobile-first; no horizontal page scroll at any width down to 320px.

| Breakpoint | Layout | Byline actions | Related grid | Newsletter |
| --- | --- | --- | --- | --- |
| base (< 640px) | 1 column; sidebar cards stack **below** the article | icons only | 1 column | stacked, input full width |
| `sm` (≥ 640px) | 1 column | icon + label | 2 columns | stacked |
| `md` (≥ 768px) | 1 column | icon + label | 2 columns | side by side |
| `lg` (≥ 1024px) | 8 / 4 split, sidebar sticky at `top-6` | icon + label | 2 columns | side by side |

- The bias bar stays one row at every width; only its labels truncate (existing behaviour).
- The headline wraps freely at every width and is never clamped.
- Sticky is `lg`-only: a sticky rail on a phone would pin a card over the article.

## Security requirements

- No secret of any kind is introduced, read, or referenced. This task adds no environment variable
  and touches no `.env` file (AGENTS.md section 21).
- No component imports a Supabase client, an Oxylabs client, an OpenAI client, or any server-only
  module. The only data source is the static fixture module.
- No `"use client"` anywhere in the route's tree, so nothing from this task ships to the browser
  beyond rendered markup — there is nothing to leak.
- No `/api` route is added or called; AGENTS.md sections 14 and 15 (method rules, admin secret) do
  not apply to this task. The page is a read-only `GET` by virtue of being a page.
- `images.remotePatterns` stays scoped to `images.unsplash.com` — it must not be widened.
- Body text renders as React children only; **no `dangerouslySetInnerHTML`** anywhere. Scraped
  article text will flow through this component later, so the sink must never accept HTML.
- Placeholder links stay `#` anchors; any future external URL must carry `rel="noopener noreferrer"`.
- The newsletter input collects nothing: no handler, no form action, no network call.

## Acceptance criteria

1. `/news/trump-iran-revised-peace-proposal` renders, top to bottom: utility bar, header, the 8/4
   article + sidebar split, the newsletter band, the dark footer. No topic rail.
2. The article column shows, in order: `Politics · United States`, the headline, the byline with
   `By David Morgan`, `May 31, 2026`, `12 min read` and the Save / Share / `…` actions, the hero
   with its caption and `Photo:` credit, the Bias Distribution card, the body paragraphs, and
   `Related Stories` with six items in two columns.
3. The Bias Distribution bar reads `Left 20%` / `Center 31%` / `Right 49%` with rendered widths of
   exactly 20 / 31 / 49 percent, shows `12 sources` beneath, and shows **no** `0% / 50% / 100%` row.
4. The home feed's `full`-variant meter in the design-system sheet still shows its `0% / 50% / 100%`
   row, and the feed's `compact` meters still read `L {n}%` — the `showScale` prop changed neither.
5. The sidebar shows all three cards, and between them every AGENTS.md section 19 field is visible:
   summary bullets, sentiment label, framing label and left/center/right percentages, confidence,
   framing notes, loaded terms, disclaimer, and model name.
6. The framing figure is labelled **AI-estimated** and is never presented as objective truth.
7. Clicking any card on `/` navigates to that article's details page, and all 12 ids resolve.
8. An unknown id (`/news/does-not-exist`) renders the not-found page with a 404 status, not a crash.
9. Colours match the table above exactly — `#0D0D0F`, `#F6F6F6`, `#FFFFFF`, `#B42318`, `#E5E7EB`,
   `#1D4ED8`, `#6B7280`. No Tailwind palette name (`gray-500`, `blue-700`, `red-600`) appears in any
   file touched by this task.
10. No raw `text-[Npx]`/`font-*`/`leading-*` size triple exists in any component added here, and no
    new class is added to `globals.css`.
11. At 375px there is no horizontal page scroll, the sidebar sits below the article, and the related
    grid is one column. At 1024px the split is 8/4 and the sidebar sticks while the body scrolls.
12. No `"use client"` directive exists anywhere under `app/news/` or in any component this task adds.
13. No `any`, no non-null assertions, no `dangerouslySetInnerHTML`; every new component has explicit
    prop types.
14. `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Checks to run

Per AGENTS.md section 22, from the project root, reporting the exact output of each:

```bash
npm run typecheck
npm run lint
npm run build
```

`build` is required here, not optional: this task adds a dynamic route with `generateStaticParams`
and `generateMetadata`, and `PageProps<'/news/[id]'>` only resolves after Next's typegen runs.

## Manual test steps

1. Start the dev server and watch its terminal for image, route or typegen warnings:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` and click the first card (`Trump Sends Iran Revised Peace
   Proposal…`). Confirm it navigates to `/news/trump-iran-revised-peace-proposal`.
3. **Article column** — confirm the eyebrow, the two-line headline, the byline (`By David Morgan |
   May 31, 2026 | 12 min read`) with Save / Share / `…` at the row's right edge, the 16:9 hero, and
   the two-line caption + credit beneath it.
4. **Bias Distribution** — in DevTools confirm the three segments report `width: 20%`, `31%` and
   `49%`, that the labels read `Left 20%` / `Center 31%` / `Right 49%` in full, that `12 sources`
   sits below the bar, and that no `0% / 50% / 100%` row is present.
5. **Body and related** — confirm the eight paragraphs render as separate `<p>` elements and that
   `Related Stories` shows six items in two columns, each with a 72×56 thumbnail and a two-line
   title. Click one and confirm it loads that article's page.
6. **Sidebar** — confirm `Bias Analysis` shows `Overall Bias`, a blue `Right 49%` with an
   `AI-estimated` badge, `Based on 12 balanced sources`, the three mini-bar rows, the
   `Sentiment: … · Confidence …%` line, the framing notes paragraph, the loaded-term chips, and the
   full-width `How We Analyze Bias` button. Confirm `AI Summary` shows the generated meta line, five
   bullets, `AI summaries can make mistakes.`, the model credit, and `Provide Feedback`. Confirm
   `Source Breakdown` shows `12 Total Sources`, the three count rows, the eight `Top Sources` with
   blue / grey / red bias labels, and `View All Sources`.
7. **Sticky rail** — at ≥1024px scroll the page and confirm the sidebar pins 24px below the viewport
   top while the body scrolls, and that it releases at the footer without overlapping it.
8. **Newsletter** — confirm the band shows the heading, the subtext, the email input and the dark
   `Subscribe` button; type in the field and press Enter, and confirm the page does **not** reload
   or navigate.
9. **404** — open `http://localhost:3000/news/does-not-exist` and confirm the not-found page renders
   with the chrome and a working `Back to Top News` link. In the Network tab confirm the document
   response status is `404`.
10. **Responsive** — step through 1280px (8/4 split), 1024px (8/4), 900px (stacked), 640px (stacked,
    related 2-up) and 375px (stacked, related 1-up). At 375px confirm in the console that
    `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
11. **Other articles** — visit `/news/real-madrid-win-champions-league-comeback` and confirm the
    bias bar reads `Left 10%` / `Center 20%` / `Right 70%`, the sidebar figure reads `Right 70%`,
    and the source breakdown counts sum to that article's 26 sources.
12. **Accessibility spot-check** — run Lighthouse or axe on the details page; confirm one `<h1>`,
    non-empty `alt` on every image, an `aria-label` on each icon-only button, and no colour-contrast
    failures on the `#6B7280` captions or the sidebar's coloured bias labels.
