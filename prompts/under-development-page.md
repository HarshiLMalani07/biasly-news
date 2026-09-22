# Under Development page (global not-found replacement)

## Goal

Replace the bare 404 a reader currently hits on any route biasly has not built
yet (`/for-you`, `/local`, `/blindspot` from the masthead nav, plus any mistyped
URL) with one on-brand "still developing" page: biasly's own chrome, a short
newsroom-voiced statement, and a way back to the feed.

One page, one file. No new data, no new routes.

## Skills read

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
  - Root `app/not-found.tsx` handles **both** `notFound()` calls in the root
    segment **and** every unmatched URL in the app (since 13.3). That single
    file is the whole feature.
  - It renders inside the root layout, so `ThemeProvider`, Clerk, Poppins and
    the palette all apply - no style re-imports needed.
  - `global-not-found.js` is experimental, bypasses the layout, and must return
    a full HTML document. Not used: it would lose the theme script and chrome
    for no gain here.
  - not-found components take **no props**, and the doc calls out that reading
    the pathname needs a Client Component. Copy therefore stays path-agnostic.
- No Clerk / Supabase / Oxylabs / AI SDK skill applies: this page renders no
  stored data and triggers no pipeline work (AGENTS.md section 5).

## Existing code inspected

- `app/layout.tsx` - root chrome, theme init script, Clerk provider.
- `app/page.tsx` - `UtilityBar` + `SiteHeader` + `TopicRail` + `main` + `SiteFooter`.
- `app/news/[id]/not-found.tsx` - the existing segment not-found: same chrome,
  `main.flex-1.bg-surface` > `container-biasly py-16`, h1 + body + secondary
  button back to `/`.
- `components/layout/site-header.tsx` - nav targets `/for-you`, `/local`,
  `/blindspot` are the unbuilt routes this page catches; `Home` is hardcoded
  `active`.
- `components/layout/site-footer.tsx`, `utility-bar.tsx`, `topic-rail.tsx`.
- `components/ui/button.tsx` (variants primary/secondary/text, sizes sm/default/lg),
  `components/ui/badge.tsx`, `components/bias/bias-meter.tsx` (the tri-colour
  motif this page echoes).
- `app/globals.css` - type scale (`text-h1` 32/700, `text-body-lg`, `text-body-sm`,
  `text-caption`), colour tokens, `container-biasly`.
- `proxy.ts` - only `/news(.*)` is protected, so unmatched URLs render signed out.

## Decisions and assumptions

1. **One file: `app/not-found.tsx`.** It covers every unbuilt and unknown route
   at once. No `components/layout/under-development.tsx` wrapper while there is
   a single call site (AGENTS.md section 21: keep it small).
2. **`app/news/[id]/not-found.tsx` stays as it is.** A wrong article id is a
   genuinely missing story, not an unbuilt page, and "Article not found" is the
   honest message there.
3. **HTTP status stays 404** for unmatched URLs - that is correct for SEO and
   Next injects `noindex` for it. Only the *visible* page changes.
   Optional follow-up, not in this round: real `app/for-you/page.tsx`,
   `app/local/page.tsx`, `app/blindspot/page.tsx` rendering the same shell so
   those three nav targets return 200 with per-section copy. Say the word and I
   will add them (it also makes the header's hardcoded `active: true` on Home
   worth deriving from the pathname).
4. **Copy is path-agnostic** because not-found takes no props; one statement has
   to read well for both "not built yet" and "no such URL".
5. `TopicRail` is left off: the rail invites browsing topics that also do not
   exist yet, and the page reads cleaner without it. `UtilityBar`, `SiteHeader`
   and `SiteFooter` stay, matching `app/news/[id]/not-found.tsx`.
6. Footer placeholder links (`href="#"`) stay inert this round.

## Files likely to change

- `app/not-found.tsx` - **new**, the whole feature.

No other file changes. No schema, env, route-handler or pipeline changes.

## Implementation requirements

Server Component, no `"use client"`, no data access.

```
<UtilityBar /> <SiteHeader />
<main className="flex-1 bg-surface"> ... </main>
<SiteFooter />
```

Inside `main`, one centred column: `container-biasly` + a flex column that is
`items-center justify-center text-center` with `min-h-[60vh]`.

Stack, top to bottom:

1. **Status badge** - `Badge variant="outline"`, uppercase, letter-spaced, with a
   small `bg-bias-left` dot that pulses. Text: `Developing`.
2. **Headline** - `h1`, `text-h1`, `text-balance`: *"This one is still developing."*
3. **Bias rule** - a 4px, 160px, fully-rounded bar split in three equal
   `bg-bias-left` / `bg-bias-center` / `bg-bias-right` blocks. Decorative echo of
   the bias meter, `aria-hidden`. **Not** the `BiasMeter` component: that one
   carries real analysis and must never render invented numbers.
4. **Standfirst** - `text-body-lg`, `text-text-secondary`, max ~56ch:
   *"This page hasn't gone to press yet. biasly is busy reading the day's news
   and measuring how each story is framed - this section joins the front page
   once it can do the same."*
5. **Primary CTA** - `Button asChild variant="primary" size="lg"` wrapping
   `<Link href="/">Back to Top News</Link>`.
6. **Reassurance caption** - `text-caption`, `text-text-secondary`:
   *"The news index keeps updating on its own while this page is being built."*

Voice: newsroom, plain, no exclamation marks, no emoji, no "oops" or "404"
cuteness. It must read like the masthead wrote it.

## Visual interpretation

The feeling is a paper that has gone to press without this section: quiet,
confident, deliberate - not an error. Weight sits in the middle of the viewport
with generous air above and below, the way a standfirst sits under a headline.
The only colour is the three-block bias rule, which ties the page to the
product's one visual signature.

### Layout and spacing

- Vertical rhythm from the badge down: `mt-6` headline, `mt-8` rule, `mt-8`
  standfirst, `mt-10` CTA, `mt-6` caption.
- Section padding `py-20`, `sm:py-28`. `min-h-[60vh]` keeps the block optically
  centred without pushing the footer below a second scroll.
- Measures capped in `ch` (`max-w-[20ch]` headline, `max-w-[56ch]` standfirst) so
  lines break like editorial copy at every width.

### Typography

Design-system classes only - `text-h1` (32/700) for the headline, `text-body-lg`
for the standfirst, `text-caption` for the badge and the closing line. No ad-hoc
font sizes, no responsive size jumps: H1 is the scale's largest and the page
stays in system.

### Colour

Tokens only: `bg-surface` page, `text-text-primary` headline,
`text-text-secondary` supporting copy, `bias-left`/`center`/`right` for the rule
and the badge dot. No `dark:` variants - every token already swaps under
`:root.dark`.

### Responsiveness

Single column at every width; `container-biasly` supplies the 24px gutter. No
horizontal scroll at 375px. Padding steps up once at `sm`. The header nav hides
its section links below `lg` on its own.

### Pixel-perfect expectations

- Badge: 24px tall pill, 11px uppercase, `tracking-[0.12em]`, 6px dot, 8px gap.
- Rule: exactly `h-1 w-40`, `rounded-full`, three equal thirds, no gaps between
  blocks, corners clipped by `overflow-hidden`.
- CTA: `size="lg"` = 48px tall, 24px horizontal padding.
- Everything centres on the same optical axis, including the button.

## Security requirements

- No service-role key, Oxylabs, OpenAI or admin secret is read or referenced.
- No scraping, analysis, or pipeline mutation - this page only renders static
  markup (AGENTS.md sections 5 and 21).
- No user input is read or echoed back, so there is nothing to escape.
- The page stays public: `proxy.ts` protects `/news(.*)` only, and nothing here
  leaks signed-in state.

## Acceptance criteria

1. `/for-you`, `/local`, `/blindspot` and any nonsense URL render the new page
   with biasly's utility bar, masthead and footer instead of Next's bare 404.
2. The page reads as "not built yet", not as an error, and never shows the
   string "404".
3. "Back to Top News" returns to `/`.
4. Light and dark themes both look correct, with no flash of the wrong palette
   (the layout's theme script still runs, since not-found renders inside it).
5. `/news/<unknown-id>` still shows the existing "Article not found" page.
6. `/` and `/news/<valid-id>` are visually unchanged.
7. No layout shift or horizontal scroll from 375px to 1440px.
8. The decorative rule is `aria-hidden`; the page exposes exactly one `h1`.
9. The dot's pulse is disabled under `prefers-reduced-motion`.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (a new route file changes the route manifest)

## Manual test steps

With the dev server running (`npm run dev`, already up on :3000):

1. Visit `http://localhost:3000/for-you` - expect the Developing page.
2. Visit `http://localhost:3000/local`, `/blindspot`, and a junk URL such as
   `http://localhost:3000/this-does-not-exist` - same page each time.
3. Click **Back to Top News** - lands on the feed.
4. Toggle the theme in the utility bar, then reload on `/for-you` - the page
   paints in the chosen theme with no light flash.
5. Narrow the window to 375px - one column, no horizontal scroll, nothing clipped.
6. Visit `http://localhost:3000/news/00000000-0000-0000-0000-000000000000`
   (signed in) - still the "Article not found" page, unchanged.
7. Confirm the status code is still 404 for unmatched URLs:
   `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/for-you`
