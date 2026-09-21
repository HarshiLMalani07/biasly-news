# Prompt: biasly Homepage UI

## Goal

Implement the attached **biasly homepage** mock as the app's `/` route: a dark utility bar, the
site header with nav and auth buttons, a horizontally scrollable topic chip rail, a **Top News**
3-column feed of vertical article cards each carrying a Left / Center / Right bias meter and a
source count, and the dark site footer.

This is a **UI task only**. It builds no Supabase layer, no Clerk wiring, no scraping, no AI
analysis, and no `/api` routes. It renders typed demo fixtures through presentational server
components so that when the Supabase read layer lands, only the data-loading line changes.

Per AGENTS.md section 5, the UI displays stored data only — no component in this task imports a  
database client, calls Oxylabs or OpenAI, or mutates pipeline state.Skills read

- `AGENTS.md` — sections 1 (scope: home page with news cards), 5 (architecture layers), 6 (tech
stack), 19 (what article cards must show; framing is AI-estimated, not objective truth),
21 (security, code standards), 22 (checks)
- `prompts/design-system.md` — the approved token layer, type scale, grid, and primitive contracts
this page must consume rather than re-derive
- `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` — `next/image` local vs
remote images, `fill` inside a sized relative wrapper, and `images.remotePatterns` in
`next.config.ts`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` —
server-component-by-default boundary; nothing here needs `"use client"`
- No Clerk / Supabase / Oxylabs / AI SDK skill needed: this task touches no auth, database,
scraping, or model code. Clerk is deliberately deferred (decision 3).



## Existing code inspected

- `package.json` — Next.js `16.3.5`, React `19.2.8`, Tailwind `^4`, `lucide-react` `^1.47.0`,
`radix-ui`, `class-variance-authority`, `cn`. Scripts: `dev`, `build`, `start`, `lint`,
`typecheck`.
- `app/layout.tsx` — Poppins via `next/font/google` on `--font-poppins`, Next 16 `LayoutProps<"/">`
typing, `html.h-full antialiased`, `body.min-h-full flex flex-col`, real biasly metadata.
**Untouched by this task.**
- `app/globals.css` — the full v1.0 token layer: colors (`--color-text-primary #0D0D0F`,
`--color-text-secondary #6B7280`, `--color-surface #F6F6F6`, `--color-bias-left #B42318`,
`--color-bias-center #E5E7EB`, `--color-bias-right #1D4ED8`, `--color-bg-primary #FFFFFF`,
`--color-bg-secondary #F0F0F0`, `--color-border` / `--color-divider #E5E7EB`), shadows
`sm`/`md`/`lg`, radii `4/8/12/9999`, `--container-biasly: 1280px`, the `.text-h1 … .text-caption`
composed classes, and `.container-biasly` / `.grid-biasly`.
- `app/page.tsx` — the Design System v1.0 reference sheet (11 panels + a dark sheet footer),
a server component built from hardcoded swatch/type/icon arrays.
- `app/_components/panel.tsx` — `Panel` and `Subhead` chrome used by the sheet.
- `components/ui/button.tsx` — cva variants `primary` / `secondary` / `outline` / `text`, sizes
`default` (h-10 px-4 14px) / `sm` (h-8 px-3 13px) / `lg` / `icon`, `asChild`, and a `forceHover`
prop for the sheet.
- `components/ui/chip.tsx` — presentational `<span>` pill: `h-8`, `rounded-full`, `bg-surface`,
`border-border`, 13px label, trailing lucide `Plus` at 14px, `gap-2`, `px-3`. Takes `label` and
`className`. Exactly the mock's chip.
- `components/ui/card.tsx` — `Card` surface: `flex flex-col gap-4 rounded-lg border border-border bg-bg-primary p-4 shadow-sm`, plus `CardHeader` / `CardTitle` / `CardDescription` / `CardContent`
/ `CardFooter` / `CardAction`.
- `components/ui/separator.tsx`, `components/ui/badge.tsx` — available, unused here.
- `components/bias/bias-meter.tsx` — `full` (h-8 + a `0% / 50% / 100%` scale row) and `compact`
(`h-[22px]`, no scale row) variants. Segments are flex children sized by percentage, zero-value
segments are dropped, labels are `Left {n}%` / `Center {n}%` / `Right {n}%` at caption size,
medium weight, truncated. Carries `role="img"` with an aria-label naming all three percentages.
- `components/news/article-card.tsx` — the **horizontal** sheet card (image left at `md:w-40`,
content right; description, `Clock` published label, `Bookmark` read-time label). This is a
different card from the mock's vertical feed card — see decision 4.
- `components/brand/logo.tsx` — `biasly` / `News` wordmark lockup, sizes `sm` (24px/11px) /
`md` / `lg`, `inverted` boolean for dark bars. Exactly what both the header and footer need.
- `lib/bias.ts` — `BiasPercentages` and `normalizeBiasPercentages()`, which clamps and rescales to
a guaranteed 100 total using largest-remainder rounding. Never throws in a render path.
- `lib/utils.ts` — re-exports `cn`.
- `next.config.ts` — empty `NextConfig`, no `images` block yet.
- `public/demo/article-placeholder.png` — the single existing demo image.
- **Verified**: `lucide-react@1.47.0` exports 6329 icons but **no brand marks** — `Linkedin`,
`Instagram`, `Youtube` and `Twitter` are all absent. `X` exists but is the close/cross glyph.
See decision 8.



## Decisions and assumptions

Confirmed with the user before writing this prompt:

1. **Data comes from typed demo fixtures.** No Supabase layer exists. A new `lib/demo/top-news.ts`
  exports a `HomeArticle` type shaped after the future `articles` + `article_analyses` join, plus
   the 12 articles from the mock. The page maps over it. When Supabase lands, only the array
   source changes.
2. **The design-system sheet stays on** `/`**, below the feed.** The homepage feed renders first, the
  sheet's panels follow it under a divider, and the site footer closes the page.
3. **Subscribe / Login and the nav links are static.** They render as styled `Button`s and anchors
  matching the mock. Clerk, `/for-you`, `/local` and `/blindspot` are separate tasks.

My own choices, flagged for approval:

1. **A new** `NewsCard` **component, leaving** `ArticleCard` **untouched.** The mock's feed card is
  vertical (16:9 image on top, eyebrow, title, meter, source count) and carries different data
   (`sourceCount`, no description, no read time) from the sheet's horizontal `ArticleCard`. Two
   visually distinct cards are two components; branching one component on a `layout` prop would
   fork nearly every line of its body.
2. **The** `compact` **bias meter abbreviates its left label to** `L {n}%`**.** The mock's narrow left
  segments read `L 20%`, `L 18%`, `L 54%` — `Left 20%` does not fit at 20% of a 370px card. The
   `full` variant keeps `Left {n}%`. Tying label length to the existing variant avoids a new prop.
   Side effect: the sheet's `CARD EXAMPLE` (which uses `compact`) also picks up the short label.
3. **A** `.text-card-title` **class is added to the** `@layer components` **block in** `globals.css`
  (16px / 600 / 1.35). The mock's card titles are 16px but visibly heavier than `.text-h4`'s
   500 weight, and `.text-h3` at 20px is too large. `prompts/design-system.md` forbids raw
   `text-[16px] font-semibold` triples at call sites, so the pairing belongs in the token layer.
4. **Card images are remote Unsplash URLs**, with `images.remotePatterns` in `next.config.ts`
  scoped to `https://images.unsplash.com/**`. Twelve visually distinct photos are what make the
   page readable against the mock, and the real pipeline stores remote image URLs anyway, so this
   is groundwork rather than throwaway config. Caveat: the cards need network access on first
   render; `public/demo/article-placeholder.png` stays in the repo as the offline fallback and a
   one-line fixture edit swaps to it.
5. **Footer social icons are four hand-written inline SVGs** in `components/brand/social-icons.tsx`
  (X, LinkedIn, Instagram, YouTube). lucide 1.47 ships no brand marks, so there is nothing to
   import; `prompts/design-system.md`'s "do not re-implement lucide icons by hand" rule does not
   cover marks lucide does not have. No new dependency is added for four paths.
6. **The utility-bar date renders server-side** via `Intl.DateTimeFormat("en-US", { dateStyle:
  "full", timeZone: "UTC" })`. The mock's` Monday, June 1, 2026`is sample data. Known limitation:  on a statically rendered build this freezes at build time — acceptable for a presentational bar,  and fixable later with a client component or`dynamic = "force-dynamic"`.
7. **Theme Light / Dark / Auto in the utility bar is static**, with `Light` shown active. The
  design system defines a single light palette; dark mode is out of scope and inventing
    undesigned dark surfaces is worse than deferring.
8. **The** `For You` **nav dot uses** `--color-bias-left` **(**`#B42318`**).** The mock's dot is a warm
  red-orange and the palette has no accent token; reusing an existing token beats inventing one.
9. **The topic rail scrolls with CSS only** (`overflow-x-auto`), with the mock's right-edge
  `ChevronRight` rendered as a static affordance. No `"use client"`, no scroll JS.
10. **The header is not sticky.** The mock gives no indication either way; static is the smaller
  change and trivially reversible.



### Open conflict — AGENTS.md section 19 vs. the mock

Section 19 requires article cards to show **title, source, image, published date, sentiment label,
AI-estimated framing label, left / center / right percentages, and confidence when available**.

The mock's card shows title, image, category · country, the three percentages, and a source count.
It shows **no source name, no published date, no sentiment label, no framing label, and no
confidence**. The two cannot both be satisfied pixel-for-pixel.

**Recommended resolution — implement this unless the user says otherwise:** keep the mock's layout
exactly, and close the gap in the space the mock already leaves empty.

- The bottom row becomes `{sourceCount} sources` left-aligned with `{sourceName} · {publishedLabel}`
right-aligned on the same line, in the same caption / secondary style. This satisfies **source**
and **published date** with no change to card height or rhythm.
- The **sentiment label** and the **AI-estimated framing label** are carried by the circular `ⓘ`
badge on the image, whose `aria-label` and `title` read
`AI-estimated framing: {framingLabel} · Sentiment: {sentimentLabel} · Confidence {n}%`.
- **Confidence** is "when available" in section 19 and is not given a visible slot on the card; the
news details page is where the full analysis, including confidence, gets rendered.

The alternative is a strict mock-only card that defers all of section 19's extra fields to the
details page. The user should pick one at approval time.

## Files likely to change

**Created**

- `lib/demo/top-news.ts` — `HomeArticle` type + the 12 fixtures from the mock
- `components/layout/utility-bar.tsx` — dark top bar
- `components/layout/site-header.tsx` — logo, nav, Subscribe / Login
- `components/layout/topic-rail.tsx` — scrollable chip rail
- `components/layout/site-footer.tsx` — dark footer with Company / Help / Connect
- `components/brand/social-icons.tsx` — four inline brand SVGs
- `components/news/news-card.tsx` — the vertical feed card
- `components/news/top-news-section.tsx` — `Top News` heading + the responsive card grid

**Modified**

- `app/page.tsx` — renders the homepage above the existing design-system panels
- `app/globals.css` — adds `.text-card-title` to the existing `@layer components` block
- `components/bias/bias-meter.tsx` — `compact` left label becomes `L {n}%`
- `next.config.ts` — adds `images.remotePatterns`

**Untouched**

- `app/layout.tsx`, `app/_components/panel.tsx`, `components/news/article-card.tsx`,
`components/ui/*`, `components/brand/logo.tsx`, `lib/bias.ts`, `lib/utils.ts`,
`tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`



## Implementation requirements



### 1. Fixtures — `lib/demo/top-news.ts`

Export an explicit type and a `readonly` array. No `any`, no inference-only exports.

```ts
export type HomeArticle = {
  id: string;            // stable slug, used as the React key and the future /news/[id] href
  title: string;
  category: string;      // "Politics"
  country: string;       // "United States"
  sourceName: string;    // "Reuters"  — AGENTS.md s19 "source"
  publishedLabel: string;// "Jun 1"    — AGENTS.md s19 "published date"
  imageUrl: string;
  imageAlt: string;      // real descriptive alt text, never the title verbatim
  sourceCount: number;   // "12 sources"
  bias: BiasPercentages; // { left, center, right }, must sum to 100
  sentimentLabel: "positive" | "neutral" | "negative";
  framingLabel: "left" | "center" | "right" | "mixed" | "unclear";
  confidence: number;    // 0–1
};
```

`bias`, `sentimentLabel`, `framingLabel` and `confidence` mirror the `article_analyses` columns in
AGENTS.md section 7 so the fixture is drop-in replaceable by a real row.

All 12 articles from the mock, in the mock's reading order, with the mock's exact titles,
categories, countries, percentages and source counts:


| #   | Category · Country         | Title                                                                                 | L / C / R    | Sources |
| --- | -------------------------- | ------------------------------------------------------------------------------------- | ------------ | ------- |
| 1   | Politics · United States   | Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report                    | 20 / 31 / 49 | 12      |
| 2   | Health · United States     | Researchers Make Case for Grapes as a 'Superfood' After Review of Health Evidence     | 18 / 42 / 40 | 7       |
| 3   | Science · Switzerland      | CERN Finds High-Significance Hint of Physics Beyond Standard Model                    | 16 / 62 / 22 | 8       |
| 4   | World · Nicaragua          | Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention | 54 / 28 / 18 | 63      |
| 5   | World · Middle East        | UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon    | 22 / 35 / 43 | 15      |
| 6   | Business · Global          | Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand                    | 25 / 50 / 25 | 11      |
| 7   | Technology · United States | SpaceX Launches Starship Test Flight in Milestone for Mars Program                    | 12 / 45 / 43 | 9       |
| 8   | Business · United States   | Apple Unveils AI-Powered Features Across iPhone, iPad and Mac                         | 15 / 40 / 45 | 10      |
| 9   | Climate · Global           | 2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says                | 33 / 34 / 33 | 14      |
| 10  | Economy · United States    | Fed Holds Rates Steady, Signals Caution on Inflation and Growth Outlook               | 30 / 45 / 25 | 13      |
| 11  | Soccer · Europe            | Real Madrid Win Champions League After Comeback Victory in Final                      | 10 / 20 / 70 | 26      |
| 12  | Environment · Canada       | Wildfires Force Thousands to Evacuate Across Western Canada                           | 27 / 33 / 40 | 17      |


Two rows in the mock do not sum to 100 and are corrected here so section 19's sum rule holds
(`normalizeBiasPercentages` would otherwise silently rescale them):

- Card 6 reads `L 25% / Center 50% / Right 28%` (103) → stored as `25 / 50 / 25`.
- Card 7 reads `L 12% / Center 45% / Right 49%` (106) → stored as `12 / 45 / 43`.
- Card 11's left segment is truncated to `L %` in the mock; `10 / 20 / 70` is the reading that sums
to 100 and matches the rendered segment width.

Assign `sourceName`, `publishedLabel`, `sentimentLabel`, `framingLabel` and `confidence` plausibly
per article — `framingLabel` must agree with the strongest percentage unless the three are within a
few points, in which case use `mixed` (card 9's `33 / 34 / 33` is `mixed`, not `center`).

### 2. `next.config.ts`

```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  ],
}
```

Nothing else in the config changes. Keep the `NextConfig` type annotation.

### 3. `app/globals.css`

Append one rule inside the existing `@layer components` block, beside the type scale:

```css
.text-card-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}
```

No other change. Do not touch the `@theme` block, the shadcn variable mapping, or `:root`.

### 4. `components/bias/bias-meter.tsx`

One change: the `left` segment's label is `Left {n}%` in the `full` variant and `L {n}%` in the
`compact` variant. `center` and `right` keep their full words in both. The `role="img"` aria-label
keeps naming all three percentages in full — the abbreviation is visual only and must not reach
assistive technology. No new props, no other edits.

### 5. `components/layout/utility-bar.tsx`

Server component. Full-bleed bar, `bg-text-primary` (`#0D0D0F`), height `h-9` (36px), contents in
`.container-biasly`, laid out as a flex row with `justify-between` and `items-center`. All text at
`.text-caption` (11px).

- **Left group**, `gap-6`: `Browser Extension` in `text-bg-primary/70`; then a `Theme:` label in
`text-bg-primary/70` followed by `Light` / `Dark` / `Auto` with `gap-2`. `Light` is
`text-bg-primary font-semibold` (active); `Dark` and `Auto` are `text-bg-primary/60`.
- **Right group**, `gap-6`: the formatted date (decision 9) in `text-bg-primary/70`;
`Set Location` in `text-bg-primary/70`; then `Globe` (lucide, 12px) + `International Edition` +
`ChevronDown` (lucide, 12px) in `text-bg-primary`, `gap-1.5`.
- Everything is non-interactive text or a `<span>`. Do not render buttons that do nothing.
- Below `md`, hide the left group and keep only the right group's date; the bar must never wrap to
two lines or cause horizontal page scroll.



### 6. `components/layout/site-header.tsx`

Server component. `bg-surface` (`#F6F6F6`), no top border, contents in `.container-biasly`,
`h-18` (72px), flex row, `items-center`, `justify-between`.

- **Left group**, `gap-8`: lucide `Menu` at 24px (`strokeWidth={2}`, `text-text-primary`) wrapped
in a `Button variant="text" size="icon"` with an `aria-label="Open menu"`; then `<Logo size="sm" />`.
- **Nav**, `gap-8` to the right of the logo, `.text-body-md`:
  - `Home` — active: `text-text-primary font-medium` with a 2px `bg-text-primary` underline bar
  sitting at the bottom of the header (absolutely positioned within a `relative` nav item, or a
  `border-b-2` on a full-height item — either is acceptable so long as the underline hugs the
  header's bottom edge as in the mock).
  - `For You` — `text-text-secondary`, with a `size-1.5 rounded-full bg-bias-left` dot absolutely
  positioned at its top-right corner (decision 11).
  - `Local`, `Blindspot` — `text-text-secondary`.
  - Each is a `next/link` `<Link>` to `/`, `/for-you`, `/local`, `/blindspot`. Only `/` resolves;
  that is expected (decision 3).
  - Hidden below `lg`.
- **Right group**, `gap-3`: `<Button variant="primary">Subscribe</Button>` and
`<Button variant="secondary">Login</Button>`. Both `size="default"` (h-10, 14px). The mock's
Login is a white pill with a hairline border — that is exactly `secondary`. Do not add a
one-off variant.
- Below `sm`, hide `Subscribe` and keep `Login`.



### 7. `components/layout/topic-rail.tsx`

Server component. `bg-surface`, `border-y border-border`, `py-2`. Contents in `.container-biasly`
as a `relative` wrapper holding a `flex gap-2 overflow-x-auto` row.

- Chips, in the mock's order: `World Cup`, `IPL`, `Social Media`, `Business & Markets`,
`Health & Medicine`, `Soccer`, `Artificial Intelligence`, `Arsenal FC`,
`Extreme Weather and Disasters`. Each is the existing `<Chip label={…} />` — do not restyle it.
- Each chip gets `shrink-0` so the row scrolls rather than compressing.
- The rail hides its scrollbar (`[scrollbar-width:none] [&::-webkit-scrollbar]:none`) and keeps
native touch scrolling.
- A static lucide `ChevronRight` at 16px, `text-text-secondary`, sits at the right edge over a
short `bg-surface` gradient fade, marking the overflow exactly as the mock does. It is
`aria-hidden` and not a button (decision 12).



### 8. `components/news/news-card.tsx`

Server component, presentational, props-only. Signature: `{ article: HomeArticle; className?: string }`.
It imports `HomeArticle` as a type and `BiasMeter`; it imports no data client.

Structure, outer to inner:

- Root: `<article>` — `flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-primary shadow-sm`. `h-full` is what makes cards in a row equal height. Do **not** reuse
`<Card>`: `Card` hardcodes `gap-4` and `p-4`, and this card's image must run edge-to-edge under
the border radius with zero padding.
- **Image block** — `relative aspect-[16/9] w-full shrink-0`, containing:
  - `<Image src={article.imageUrl} alt={article.imageAlt} fill className="object-cover" sizes="(min-width: 1280px) 395px, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw" />`.
  The first three cards pass `priority` (above the fold); the rest lazy-load by default.
  - The `ⓘ` badge: `absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full bg-bg-primary/95 text-text-primary shadow-sm`, holding lucide `Info` at 14px.
  Per the open-conflict resolution it carries `title` and `aria-label`
  `AI-estimated framing: {framingLabel} · Sentiment: {sentimentLabel} · Confidence {Math.round(confidence * 100)}%`.
- **Body** — `flex flex-1 flex-col p-4`:
  - Eyebrow, `.text-caption`: `{category}` in `text-text-primary`, then `·` and `{country}` in
  `text-text-secondary`. One line, `truncate`.
  - Title — `<h3 className="text-card-title mt-2 text-text-primary line-clamp-3">`.
  - `<BiasMeter {...article.bias} variant="compact" className="mt-auto pt-4" />`. `mt-auto` is what
  pins the meter and the row beneath it to the card's bottom, so every meter in a row aligns on
  the same baseline exactly as the mock shows — regardless of whether a title runs to two lines
  or three.
  - Bottom row — `mt-2 flex items-center justify-between gap-2 .text-caption text-text-secondary`:
  `{sourceCount} sources` on the left, `{sourceName} · {publishedLabel}` on the right, the right
  side `truncate`.
- Nothing in this component is clickable yet — the news details page is a later task. Do not wrap
the card in a `<Link>` to a route that does not exist.



### 9. `components/news/top-news-section.tsx`

Server component. Props: `{ articles: readonly HomeArticle[] }`.

- `<section>` on `bg-surface`, `py-8`, contents in `.container-biasly`.
- `<h2 className="text-h2 text-text-primary">Top News</h2>`, then `mt-6` to the grid.
- Grid: `grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. `gap-6` is the design system's 24px
gutter. Do not use `.grid-biasly` here — that is a 12-column primitive and this is a 3-up card
grid.
- Map to `<NewsCard key={article.id} article={article} priority={index < 3} />`.



### 10. `components/brand/social-icons.tsx` and `components/layout/site-footer.tsx`

`social-icons.tsx` exports four tiny server components — `XIcon`, `LinkedInIcon`, `InstagramIcon`,
`YouTubeIcon` — each an inline `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>` with the
brand path, accepting `React.ComponentProps<"svg">` so `className` and `size` pass through. No new
dependency.

`site-footer.tsx` is a server component: `bg-text-primary` (`#0D0D0F`), `mt-auto` so it sits at the
viewport bottom on short pages (the root layout's `body` is already `min-h-full flex flex-col`),
contents in `.container-biasly`, `py-10`.

- Top region: `grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - **Brand column** — `<Logo size="sm" inverted />`, then the tagline
  `Balanced news coverage powered by AI.` on two lines at `.text-body-sm text-bg-primary/60`,
  `mt-4`.
  - **Company** — heading `Company`; links `About`, `Careers`, `Press`, `Contact`.
  - **Help** — heading `Help`; links `Help Center`, `Guides`, `Privacy Policy`, `Terms of Service`.
  - **Connect** — heading `Connect`; a `flex gap-4` row of the four brand icons at 18px,
  `text-bg-primary/70` with `hover:text-bg-primary transition-colors`, each an `<a href="#">`
  with an `aria-label` naming the network.
  - Column headings: `.text-body-sm font-semibold text-bg-primary`. Links: `.text-body-sm text-bg-primary/60 hover:text-bg-primary transition-colors`, stacked `flex flex-col gap-2`,
  `mt-4` below the heading.
- Bottom region: `mt-10 border-t border-bg-primary/10 pt-6`, holding
`© 2026 Biasly News. All rights reserved.` at `.text-caption text-bg-primary/50`.



### 11. `app/page.tsx`

Compose, in order:

1. `<UtilityBar />`
2. `<SiteHeader />`
3. `<TopicRail />`
4. `<main>` containing `<TopNewsSection articles={topNewsArticles} />`
5. The existing design-system panels, unchanged, wrapped in a `<section>` separated from the feed
  by a `border-t border-border` and introduced by a short heading (`Design System v1.0`) so it
   reads as a deliberate reference section rather than stray content (decision 2)
6. `<SiteFooter />`

The sheet's own dark footer bar is removed — `SiteFooter` now occupies that role, and two stacked
dark bars would read as a bug. The `Design System v1.0` and `Stay consistent. Stay unbiased.`
strings move into the sheet section's heading so nothing from the sheet is lost.

Everything else in the sheet — the swatch arrays, the type table, the button matrix, the icon grid,
the `ArticleCard` example, the spacing ramp, the grid demo, the shadows and the radii — stays
byte-for-byte as it is. This task must not refactor the sheet.

The page stays a server component with no `"use client"` anywhere in the tree.

## Visual interpretation

The mock is a light, dense, editorial news grid. The reading hierarchy top to bottom is: a thin
near-black utility strip → a calm off-white masthead → a quiet chip rail → a white card field on a
light grey ground → a near-black footer. The cards are the only white surfaces on the page, which
is what makes them read as the content; the chrome recedes to `#F6F6F6`.

Within a card, the eye lands on the photo, then the title, then the bias meter — the meter is the
product's whole point and is the only saturated colour on the page. Every meter in a row sits on
the same baseline, which is what makes the grid feel typeset rather than assembled; this is the
single most important detail to get right, and `mt-auto` is what delivers it.

### Colours

Every value comes from the existing token layer. No new colours, no Tailwind palette names.


| Region      | Background                                                                        | Foreground                                            |
| ----------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Utility bar | `bg-text-primary` `#0D0D0F`                                                       | `text-bg-primary` at 100 / 70 / 60%                   |
| Header      | `bg-surface` `#F6F6F6`                                                            | `text-text-primary`, nav rest `text-text-secondary`   |
| Topic rail  | `bg-surface` `#F6F6F6`, `border-y border-border`                                  | chip tokens, unchanged                                |
| Feed ground | `bg-surface` `#F6F6F6`                                                            | `text-text-primary`                                   |
| Card        | `bg-bg-primary` `#FFFFFF`, `border-border`, `shadow-sm`                           | title `text-text-primary`, meta `text-text-secondary` |
| Bias meter  | `bg-bias-left` `#B42318` / `bg-bias-center` `#E5E7EB` / `bg-bias-right` `#1D4ED8` | white / `text-text-primary` / white                   |
| Footer      | `bg-text-primary` `#0D0D0F`                                                       | `text-bg-primary` at 100 / 70 / 60 / 50%              |




### Typography


| Element                                            | Class                             | Resolved                |
| -------------------------------------------------- | --------------------------------- | ----------------------- |
| Utility bar, eyebrow, source row, footer copyright | `.text-caption`                   | 11px / 400 / 1.4        |
| Bias meter labels                                  | `.text-caption font-medium`       | 11px / 500 / 1.4        |
| Nav links, footer headings and links               | `.text-body-sm` / `.text-body-md` | 13px / 14px / 400 / 1.6 |
| Chip labels                                        | `.text-body-sm` (inside `Chip`)   | 13px / 400 / 1.6        |
| Buttons                                            | `size="default"`                  | 14px / 500              |
| Card title                                         | `.text-card-title`                | 16px / 600 / 1.35       |
| `Top News`                                         | `.text-h2`                        | 24px / 600 / 1.3        |


No component may write a raw `text-[Npx] font-* leading-*` triple. If a pairing is needed that the
scale does not have, add it to `@layer components` as `.text-card-title` is added here.

### Spacing and layout

4px base unit only — `gap-1.5 / 2 / 3 / 4 / 6 / 8`, `p-4`, `py-2 / 8 / 10`, `mt-2 / 4 / 6 / 10`.
No `p-3`-style off-scale values beyond the listed set, no arbitrary `p-[18px]`.

- Container: `.container-biasly` everywhere — 1280px max-width, 24px side padding, centred. Never
re-derive `max-w-[1280px] mx-auto px-6` inline.
- Feed grid gutter: `gap-6` (24px), matching the design system's gutter.
- Card column width at 1280px: `(1280 − 48 − 48) / 3 ≈ 395px`; the `sizes` attribute in
requirement 8 is calculated from this.
- Card image: `aspect-[16/9]`, flush to the card's top and side edges, clipped by the root's
`overflow-hidden` so the top corners follow the 12px radius.
- Card internal rhythm: `p-4` body; eyebrow → title `mt-2`; title → meter `pt-4` (via `mt-auto pt-4`); meter → source row `mt-2`.



### Pixel-perfect expectations

- The three bias segments' widths are exactly their percentages; a 70% right segment is visibly
more than twice a 33% one.
- Cards within a grid row are the **same height**, and their meters and source rows align on the
same two baselines, whether the title runs two lines or three. This must hold when the fixture
text changes — it is a layout property, not a content coincidence.
- Titles clamp at three lines with an ellipsis; they never push the meter out of alignment.
- The `Home` underline touches the header's bottom edge, and the `For You` dot sits at the label's
top-right, clear of the text.
- The chip rail clips its last chip at the container's right edge with the chevron over it, exactly
as the mock does — it does not wrap to a second row.
- Card corners are 12px (`rounded-lg`); chips are fully round; the bias bar is 4px (`rounded-sm`).
- The `ⓘ` badge is a true circle, offset 12px from the image's top and right edges.



### Responsiveness

Mobile-first; no horizontal page scroll at any width down to 320px.


| Breakpoint      | Feed      | Header                                     | Utility bar | Footer    |
| --------------- | --------- | ------------------------------------------ | ----------- | --------- |
| base (< 640px)  | 1 column  | logo + `Login`; nav and `Subscribe` hidden | date only   | 1 column  |
| `sm` (≥ 640px)  | 2 columns | `Subscribe` returns                        | date only   | 2 columns |
| `lg` (≥ 1024px) | 3 columns | full nav returns                           | full bar    | 4 columns |


- The topic rail scrolls horizontally at every width and never wraps.
- The bias meter stays one row at every width; only its labels truncate.
- The container keeps its 24px side padding at all widths.



## Security requirements

- No secret of any kind is introduced, read, or referenced. This task adds no environment variable
and touches no `.env` file.
- No component imports a Supabase client, an Oxylabs client, an OpenAI client, or any server-only
module. The only data source is the static fixture array.
- No `"use client"` anywhere, so no code from this task ships to the browser beyond the rendered
markup — there is nothing to leak.
- No `/api` route is added or called, so AGENTS.md sections 14 and 15 (method rules, admin secret)
do not apply to this task.
- `images.remotePatterns` is scoped to the single `images.unsplash.com` host with an explicit
`protocol: "https"`. It must not be widened to a wildcard hostname — AGENTS.md's scraping work
will decide its own image host policy later, with its own review.
- External footer links are placeholder `#` anchors. If any is later pointed at a real third-party
URL it must carry `rel="noopener noreferrer"`.



## Acceptance criteria

1. `/` renders, top to bottom: utility bar, header, topic rail, `Top News` with 12 cards in a
  3-column grid, the design-system panels, and the dark footer.
2. Every card shows its image, eyebrow, title, three-segment bias meter with the correct
  percentages, and the source row.
3. Within every grid row, all cards are the same height and their bias meters share a baseline.
4. The bias segments' rendered widths match their percentages, and each row of fixture data sums
  to exactly 100 before `normalizeBiasPercentages` sees it.
5. The `compact` meter's left label reads `L {n}%`; the `full` meter in the sheet still reads
  `Left {n}%`; both variants' aria-labels still spell out all three percentages in full.
6. Colours match the table above exactly — `#0D0D0F`, `#F6F6F6`, `#FFFFFF`, `#B42318`, `#E5E7EB`,
  `#1D4ED8`, `#6B7280`. No Tailwind palette names (`gray-500`, `red-700`) appear in any file.
7. Card titles render at 16px / 600 via `.text-card-title`; no raw size/weight/line-height triple
  exists in any component added by this task.
8. At 375px width there is no horizontal page scroll, the feed is one column, and the topic rail
  scrolls internally.
9. At 1024px the feed is three columns; at 640px it is two.
10. The design-system sheet below the feed is visually unchanged except for the `compact` meter
  label in its `CARD EXAMPLE`, and its duplicate dark footer bar is gone.
11. No `"use client"` directive exists in `app/` or `components/`.
12. No `any`, no non-null assertions, and every new component has explicit prop types.
13. `npm run typecheck`, `npm run lint` and `npm run build` all pass.



## Checks to run

Per AGENTS.md section 22, from the project root, reporting the exact output of each:

```bash
npm run typecheck
npm run lint
npm run build
```

`build` is required here, not optional: this change edits `next.config.ts` and `app/page.tsx` and
introduces remote `next/image` sources, all of which can only fail at build time.

## Manual test steps

1. Start the dev server and watch its terminal for image or config warnings:
  ```bash
   npm run dev
  ```
2. Open `http://localhost:3000`.
3. **Chrome** — confirm the near-black utility bar spans the full width with `Browser Extension`
  and the theme labels at the left (`Light` bold) and today's date, `Set Location` and
   `International Edition` at the right. Confirm the header shows the hamburger, the `biasly /  News` lockup, the four nav links with `Home` underlined and a red dot on `For You`, and the
   dark `Subscribe` plus white `Login` buttons.
4. **Topic rail** — drag or shift-scroll the chip row horizontally and confirm it scrolls without
  moving the page, the chips never wrap to a second line, and the chevron sits at the right edge.
5. **Feed** — count 12 cards in 3 columns. Pick any row and confirm with DevTools that the cards
  report the same height and that the three bias meters' top offsets are identical, even though
   card 2's title runs three lines and card 1's runs two.
6. **Bias meters** — inspect card 11 (`Real Madrid`): the blue right segment must be `width: 70%`,
  the grey centre `20%`, the red left `10%`, and the left label must read `L 10%`, not `Left 10%`.
   Hover the `ⓘ` badge on any card and confirm the tooltip names the framing label, the sentiment
   label and the confidence percentage.
7. **Responsive** — in DevTools device toolbar, step through 1280px (3 columns), 900px (2), 700px
  (2), 600px (1) and 375px (1). At 375px confirm `document.documentElement.scrollWidth ===   document.documentElement.clientWidth` in the console — no horizontal page scroll — and that the
   card image, title and meter all remain legible.
8. **Design system section** — scroll past the feed and confirm all 11 panels still render, and
  that only one dark bar exists on the page (the site footer at the very bottom).
9. **Footer** — confirm the inverted logo, the tagline, the Company / Help / Connect columns with
  four social marks, and the `© 2026 Biasly News. All rights reserved.` line above nothing else.
10. **Accessibility spot-check** — run a Lighthouse or axe pass on `/` and confirm no colour
  contrast failures on the utility bar or the footer's 50–60% opacity text, and that every image
    has non-empty alt text.

