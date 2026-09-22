# Prompt: App theme — light / dark / auto

## Goal

Make the app's theme real. Today `components/layout/utility-bar.tsx` renders a
static `Theme: Light Dark Auto` strip that does nothing, and `app/globals.css`
ships a single light palette ("Light theme only" — design-system v1.0 decision 3).

Deliver:

1. A dark palette defined on the same design tokens, so every existing screen
   (home feed, news details, sign-in / sign-up, Clerk UI) switches with no
   per-component dark styling.
2. A working **Light / Dark / Auto** switch in the utility bar.
3. The choice persisted across reloads and applied **before first paint** — no
   white flash on a dark-theme reload, no hydration error.

Scope is styling plus one small client provider. No data, pipeline, API route,
Supabase, Oxylabs or AI change.

## Skills read

- `AGENTS.md` — §5 (layer separation: this is Website layer only), §6 (stack —
  no new dependency), §21 (server/client boundaries, no `any`, small functions),
  §22 (checks).
- `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`
  — the canonical Next 16 recipe for this exact problem: an inline `<script>` in
  `<head>` set via `dangerouslySetInnerHTML`, `suppressHydrationWarning` on the
  element the script mutates, a lazy `useState` initialiser reading the *same*
  source as the script, and a `useLayoutEffect` re-apply because React Strict
  Mode's dev remount resets `<html>` to the attributes it manages from JSX.
  It also warns that `useEffect` is too late (paint has happened) and that
  inline scripts need a CSP nonce where a strict CSP exists (this app has none).
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  — state / event handlers / `localStorage` force a Client Component; keep the
  boundary as small as possible and keep the server parent server-rendered.
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — Tailwind v4
  is wired through `@import "tailwindcss"` + `@tailwindcss/postcss`; there is no
  `tailwind.config.js`, so tokens live in `app/globals.css`.
- Clerk skill not needed: `node_modules/@clerk/ui/dist/themes/shadcn.js` shows the
  `shadcn` theme maps Clerk's variables onto the shadcn CSS custom properties
  (`var(--card)`, `var(--primary)`, `var(--muted-foreground)`, …). `globals.css`
  already re-points those at the biasly tokens, so Clerk UI follows the dark
  palette automatically with **no `appearance` change**. Its one hardcoded
  utility, `dark:bg-input/30`, resolves through the `dark` variant below.
- Supabase / Oxylabs / AI SDK skills: not applicable, nothing server-side changes.

## Existing code inspected

- `app/globals.css` — `@theme { … }` declares the biasly tokens (`--color-*`,
  `--shadow-*`, `--radius-*`, `--container-biasly`); `@theme inline { … }` maps the
  shadcn names onto `:root` aliases (`--background: var(--color-bg-primary)` …);
  `@custom-variant dark (&:is(.dark *))` already exists but nothing ever sets
  `.dark`; `@layer base` paints `body` from `--color-bg-primary` /
  `--color-text-primary`; `@layer components` holds the type scale and grid.
- `app/layout.tsx` — server root layout, Poppins via `next/font/google`,
  `LayoutProps<"/">` typing (Next 16), `<ClerkProvider appearance={{ theme: shadcn }}>`
  wrapping `<PostHogIdentity />` and `children`. No `<head>`, no
  `suppressHydrationWarning`.
- `components/layout/utility-bar.tsx` — server component. `themeOptions =
  ["Light","Dark","Auto"]` rendered as inert `<span>`s, "Light" hardcoded as the
  active one. The whole left group is `hidden md:flex`, so the control is absent
  on phones.
- `components/layout/site-footer.tsx` — `bg-text-primary` with `text-bg-primary`
  children: a deliberately **inverted** panel built out of the light-mode tokens.
- `components/brand/logo.tsx` — `inverted` prop swaps to `text-bg-primary`.
- `components/ui/button.tsx` — `primary` is `bg-text-primary text-bg-primary`
  with a hardcoded `hover:bg-black` / `data-[hover=true]:bg-black`.
- `components/ui/badge.tsx` — `left` / `right` variants put `text-bg-primary`
  (white) on the bias fills; `default` is `bg-text-primary text-bg-primary`.
- `components/bias/bias-meter.tsx` — same: `bg-bias-left text-bg-primary`,
  `bg-bias-right text-bg-primary`, centre segment `text-text-primary`.
- Colour audit across `components/` + `app/`: everything else is already token
  driven (`bg-bg-primary`, `bg-surface`, `text-text-secondary`, `border-border`).
  The only literal colours anywhere are the two `bg-black`s in `button.tsx`.
  `app/_components/design-system-sheet.tsx` is excluded — it is slated for
  deletion by `prompts/remove-design-system-sheet.md` and is not touched here.
- `package.json` — no `next-themes`, no theme library. Poppins, Tailwind v4,
  shadcn primitives, `cn`.

## Decisions and assumptions

Confirmed with the user before writing this prompt:

1. **Dark mode plus a working switch**, not a system-only dark palette and not a
   re-skin of the light palette. Light stays the default for a first-time visitor.
2. **Hand-rolled provider, no new dependency.** `next-themes` is not added —
   §6's stack list stays intact and the Next.js guide above covers every case it
   would have handled (persistence, system tracking, flash, dev remount).

Further decisions, flagged as my own:

3. **`.dark` class on `<html>`, not `data-theme`.** The Next guide demonstrates
   `data-theme`, but `globals.css` already declares `@custom-variant dark
   (&:is(.dark *))` and Clerk's shadcn theme emits `dark:bg-input/30`. A class
   keeps both working; a `data-theme` attribute would silently break them.
4. **Dark tokens are redefined under `:root.dark`, not under a new token set.**
   Tailwind v4 compiles `bg-surface` to `background-color: var(--color-surface)`,
   so redefining the custom property on `<html>` re-themes every utility with no
   component edits. The selector is `:root.dark` (specificity 0,2,0) rather than
   `.dark` (0,1,0) so it always wins against the `:root` rule `@theme` emits,
   regardless of where Tailwind orders the two.
5. **Three stored values, `"light" | "dark" | "system"`.** The UI labels them
   Light / Dark / **Auto** (keeping the existing wording); `"system"` is the
   stored token because that is what `prefers-color-scheme` means.
   `localStorage` key: `biasly-theme`. A missing / unparseable value ⇒ `"light"`.
6. **`localStorage`, not a cookie.** Nothing server-side needs the theme (the
   markup is identical in both themes — only custom properties differ), and the
   guide notes reading a cookie in the root layout opts the whole app out of
   static prerendering.
7. **Three inverted panels get their own tokens.** The utility bar, the footer
   and `Logo inverted` are dark-on-light by design. A blind token swap would
   flip them to *white* bars in dark mode. They move to a dedicated
   `--color-inverse-surface` / `--color-inverse-text` pair that stays dark in
   both themes. Same reasoning for the white labels on the bias fills: they move
   to `--color-bias-foreground`, which is `#ffffff` in both themes.
8. **`Button` `primary` keeps `bg-text-primary text-bg-primary`.** That pair
   inverts correctly on its own — a near-black button with white text in light
   mode, a near-white button with near-black text in dark mode, which is the
   conventional dark-mode primary. Only the literal `bg-black` hover needs a
   token. Same for `Badge` `default`.
9. **The theme switch becomes visible at every width.** Today it is inside the
   `hidden md:flex` group, which would leave the only theme control unreachable
   on a phone. The switch moves out of that group; "Browser Extension" keeps its
   `md:` visibility. Everything else in the bar is untouched.
10. **No global colour transition.** A `transition: background-color` on `*`
    would animate every element on every navigation for one cosmetic frame.
    The switch is instantaneous, as the reference bar implies.
11. **No PostHog event for theme changes.** Not requested; §21 forbids
    unrequested features.

## Files likely to change

**Created**

- `lib/theme.ts` — server-safe, dependency-free module: the `Theme` union, the
  storage key, `isTheme()`, `resolveTheme()`, `applyTheme()`, and the
  `THEME_INIT_SCRIPT` string the layout injects. Single source of truth shared by
  the inline script and the React state, exactly as the guide requires.
- `components/theme/theme-provider.tsx` — `"use client"`. Context + provider.
- `components/theme/theme-switch.tsx` — `"use client"`. The Light / Dark / Auto
  control rendered by the utility bar.

**Modified**

- `app/globals.css` — new inverse / bias-foreground / button-hover tokens,
  `color-scheme` on both themes, the `:root.dark` override block.
- `app/layout.tsx` — `suppressHydrationWarning` on `<html>`, `<head>` inline
  script, `<ThemeProvider>` wrapper.
- `components/layout/utility-bar.tsx` — renders `<ThemeSwitch />`; inverse tokens.
- `components/layout/site-footer.tsx` — inverse tokens.
- `components/brand/logo.tsx` — `inverted` uses `text-inverse-text`.
- `components/ui/button.tsx` — `bg-black` → `bg-button-primary-hover`.
- `components/ui/badge.tsx` — bias variants → `text-bias-foreground`.
- `components/bias/bias-meter.tsx` — bias segments → `text-bias-foreground`.

**Untouched**

`package.json` (no new dependency), `app/page.tsx`, `app/news/[id]/page.tsx`,
every API route, every `lib/` module outside `lib/theme.ts`, `proxy.ts`,
`supabase/`, `vercel.json`, `app/_components/`.

## Implementation requirements

### 1. `lib/theme.ts`

No `"use client"`, no `server-only` — it is imported from both sides.

```ts
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export const THEME_STORAGE_KEY = "biasly-theme";
export const DEFAULT_THEME: Theme = "light";
```

- `isTheme(value: unknown): value is Theme` — the only place the union is validated.
- `resolveTheme(theme: Theme): ResolvedTheme` — `"system"` reads
  `window.matchMedia("(prefers-color-scheme: dark)").matches`; guard for
  `typeof window === "undefined"` and return `"light"` there.
- `readStoredTheme(): Theme` — `localStorage` read in `try/catch`
  (Safari private mode throws), falling back to `DEFAULT_THEME`.
- `applyTheme(theme: Theme): void` — toggles `dark` on
  `document.documentElement.classList` from `resolveTheme(theme)`. Nothing else
  in the app may touch that class list.
- `THEME_INIT_SCRIPT: string` — a self-invoking, `try/catch`-wrapped, ES5-safe
  one-liner that reads `localStorage[THEME_STORAGE_KEY]`, treats
  `"system"`/missing/invalid the same way `resolveTheme` does, and adds the
  `dark` class to `document.documentElement`. Build it from the exported
  constants (template literal) so the key can never drift from the TS code.
  No user input is interpolated into it.

Explicit return types on every export. No `any`.

### 2. `app/globals.css`

**a. New tokens inside the existing `@theme` block**, next to the colours they
relate to, each with a comment saying why it exists:

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--color-inverse-surface` | `#0d0d0f` | `#08080a` | utility bar, footer |
| `--color-inverse-text` | `#ffffff` | `#f5f5f7` | their text, `Logo inverted` |
| `--color-bias-foreground` | `#ffffff` | `#ffffff` | labels on the bias fills |
| `--color-button-primary-hover` | `#000000` | `#e4e4e7` | `Button` primary hover |

**b. `color-scheme`** — `:root { color-scheme: light; }` and `dark` in the block
below, so native scrollbars, form controls and the `Input` caret follow.

**c. The dark palette**, as one `:root.dark { … }` block placed *after* the
`:root` alias block, redefining only these:

| Token | Light (unchanged) | Dark |
|---|---|---|
| `--color-bg-primary` | `#ffffff` | `#0d0d0f` |
| `--color-bg-secondary` | `#f0f0f0` | `#17171a` |
| `--color-surface` | `#f6f6f6` | `#131316` |
| `--color-text-primary` | `#0d0d0f` | `#f5f5f7` |
| `--color-text-secondary` | `#6b7280` | `#a1a1aa` |
| `--color-border` | `#e5e7eb` | `#2a2a30` |
| `--color-divider` | `#e5e7eb` | `#2a2a30` |
| `--color-bias-left` | `#b42318` | `#c4362b` |
| `--color-bias-center` | `#e5e7eb` | `#3f3f46` |
| `--color-bias-right` | `#1d4ed8` | `#2563eb` |
| `--color-inverse-surface` | `#0d0d0f` | `#08080a` |
| `--color-inverse-text` | `#ffffff` | `#f5f5f7` |
| `--color-button-primary-hover` | `#000000` | `#e4e4e7` |

Do **not** redefine `--color-bias-foreground` (white in both), the radii, the
type scale, the grid, or the shadcn `:root` aliases — the aliases are
`var(--color-*)` references declared on the same element, so they re-resolve to
the dark values for free. Verify that in DevTools rather than duplicating them.

Shadows: attempt `--shadow-sm/md/lg` overrides with heavier black alphas
(`0.5 / 0.55 / 0.6`) inside the same block. If Tailwind v4 turns out to inline
the literal shadow value instead of emitting `var(--shadow-*)`, **drop the
shadow overrides** rather than working around it — dark surfaces separate by
border, not by shadow. Say which way it went in the summary.

Leave `@custom-variant dark (&:is(.dark *))` exactly as it is. Replace the
"Light theme only" comment with one describing the two-palette setup.

### 3. `app/layout.tsx`

- `<html …  suppressHydrationWarning>` — the inline script mutates its class list
  before React hydrates; without this React discards the correction and the page
  flashes (see "Understanding `suppressHydrationWarning`" in the guide).
- A `<head>` containing only
  `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />`, before
  `<body>`, so it runs during parsing and ahead of first paint.
- Wrap the existing tree in `<ThemeProvider>` inside `<body>`. `ClerkProvider`
  and `PostHogIdentity` keep their current nesting and props — the `appearance`
  prop is **not** changed.
- Keep `LayoutProps<"/">`, the Poppins variable, `metadata`, and the
  `h-full` / `min-h-full flex flex-col` classes exactly as they are.

### 4. `components/theme/theme-provider.tsx`

`"use client"`. Small and typed:

- `useState<Theme>` with a **lazy initialiser** calling `readStoredTheme()` —
  the same source the inline script reads, so React's first client render agrees
  with the DOM the script produced (guide: "Syncing with React state").
- `useLayoutEffect(() => applyTheme(theme), [theme])` — re-applies the class.
  This is a no-op in production and is what repairs the class after React Strict
  Mode's dev remount wipes `<html>`'s attributes.
- A `useEffect` subscribing to `matchMedia("(prefers-color-scheme: dark)")` with
  `addEventListener("change", …)` and a cleanup that removes it, so **Auto**
  follows the OS live. Subscribe only while `theme === "system"`.
- `setTheme(next: Theme)` — writes `localStorage` in `try/catch`, then sets state.
  Wrap in `useCallback`; memoise the context value with `useMemo`.
- Export `useTheme(): { theme: Theme; resolvedTheme: ResolvedTheme; setTheme(t: Theme): void }`,
  throwing a clear error when used outside the provider.
- No `document`/`localStorage` access during render outside the lazy initialiser.

### 5. `components/theme/theme-switch.tsx`

`"use client"`. Renders the three options and nothing else — it inherits the
utility bar's colours.

- `const options = [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Auto" }] as const;`
- Container `role="radiogroup"` with `aria-label="Theme"`; each option a real
  `<button type="button">` with `role="radio"` and `aria-checked`, calling
  `setTheme(value)`.
- `useTheme()` drives the active style. Because the provider's first client
  render reads `localStorage`, the selected pill is correct on hydration.
- Visible keyboard focus: `focus-visible:ring-2 ring-inverse-text/40
  ring-offset-2 ring-offset-inverse-surface outline-none`, and `rounded-sm`
  so the ring has a shape.
- Cursor `cursor-pointer`; `transition-colors` on the label colour only.

### 6. Component token fixes

- `utility-bar.tsx` — `bg-text-primary` → `bg-inverse-surface`; every
  `text-bg-primary*` → `text-inverse-text*` (keep the existing `/70`, `/60`
  opacities); delete the `themeOptions` array and the inert `<span>` map and
  render `<Theme:` label + `<ThemeSwitch />` instead. Per decision 9, move the
  `Theme:` label and the switch out of the `hidden md:flex` group into a group
  that is always visible, leaving "Browser Extension" `hidden md:inline`.
  The file stays a **server component** — no `"use client"` at the top.
- `site-footer.tsx` — `bg-text-primary` → `bg-inverse-surface`; all
  `text-bg-primary*` → `text-inverse-text*`; `border-bg-primary/10` →
  `border-inverse-text/10`.
- `logo.tsx` — `inverted ? "text-inverse-text" : "text-text-primary"`. Update the
  prop's doc comment: it is the treatment for the inverted bars, in both themes.
- `button.tsx` — both `bg-black` occurrences → `bg-button-primary-hover`.
- `badge.tsx` — `left` and `right` variants: `text-bg-primary` →
  `text-bias-foreground`. Leave `default`, `secondary`, `outline`, `center`.
- `bias-meter.tsx` — left and right segment `className`s: `text-bg-primary` →
  `text-bias-foreground`. Leave the centre segment on `text-text-primary`.

### 7. Visual expectations

- **Light mode must be pixel-identical to today.** Every light value in the
  tables above is copied from the current file; the only visible difference is
  that the theme labels are now buttons with hover/focus affordances.
- **Dark mode** reads as one system, not as inverted light: the page is
  `#0d0d0f`, cards and the details `<main>` sit one step lighter
  (`#131316` surface, `#0d0d0f` card), borders are visible but quiet (`#2a2a30`),
  body copy is `#f5f5f7` and metadata `#a1a1aa`.
- The utility bar and footer stay the darkest bars on the page (`#08080a`) with
  a `border-border` seam separating them from the page background.
- Bias hues stay recognisably red / grey / blue, lifted just enough to hold
  white labels at ~5:1 on the fills.
- Typography, spacing, radii, the 1280px container, the 12-column grid and every
  breakpoint are **unchanged**. This task changes colour only.
- Responsive: the switch is reachable at 375px — it must not overflow the 36px
  utility bar or introduce horizontal scroll. Check 375 / 768 / 1280.

## Security requirements

- `lib/theme.ts` holds no secret and touches no env var. Nothing here reaches
  Supabase, Oxylabs, OpenAI or the admin secret (§21).
- The inline script is a build-time constant with **no interpolation of user,
  URL, cookie or network input**, so `dangerouslySetInnerHTML` introduces no
  injection path. It is the mechanism the Next.js guide prescribes.
- Every `localStorage` access is wrapped in `try/catch`; a throwing or disabled
  store must degrade to the light theme, never to a blank screen.
- No new route, no new network call, no new dependency, no change to
  `proxy.ts` or to any protected route.

## Acceptance criteria

1. `Light` / `Dark` / `Auto` in the utility bar each switch the whole app
   instantly — home, `/news/[id]`, `/sign-in`, `/sign-up`, and the Clerk card
   and `UserButton` popover inside them.
2. The selected option is visually marked and exposed as `aria-checked="true"`.
3. Reloading in dark mode shows **no white flash** at any point, on a hard
   refresh with an empty cache and CPU throttling on.
4. The browser console shows **no hydration error / mismatch warning** on any
   route in any of the three modes.
5. The choice survives a reload, a client-side `<Link>` navigation, and a new tab.
6. In `Auto`, changing the OS appearance re-themes the open page live, with no
   reload and no reselection.
7. Light mode is unchanged from `main` apart from the switch's own affordances.
8. In dark mode no element renders dark-on-dark or light-on-light: specifically
   the footer, the utility bar, the primary `Button`, the default `Badge`, the
   bias meter labels, `Input` placeholders and the Clerk card.
9. No component outside `components/theme/` gained a `dark:` utility — the
   palette does the work.
10. `utility-bar.tsx`, `site-footer.tsx` and both page routes remain server
    components; only the three new theme files are client components.
11. `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Checks to run

```bash
npm run typecheck
npm run lint
npm run build
```

`build` is included because `app/layout.tsx` and `app/globals.css` both change
(§22). Report the real output of each.

## Manual test steps

Start the dev server:

```bash
npm run dev
```

1. **Default** — open `http://localhost:3000` in a fresh profile (or after
   `localStorage.removeItem("biasly-theme")`). The page is light and `Light` is
   the marked option.
2. **Dark** — click `Dark`. The feed, cards, topic rail, utility bar and footer
   all switch instantly. Inspect `<html>`: it carries `class="dark"`.
   `localStorage.getItem("biasly-theme")` is `"dark"`.
3. **No flash** — with `Dark` selected, open DevTools → Network → *Disable
   cache*, Performance → CPU *4× slowdown*, then hard-reload. The page must
   never paint white. Record the reload in the Performance panel and step the
   first frames if it is too fast to judge by eye.
4. **No hydration error** — with the console open, reload `/` and
   `/news/<id>` in dark mode. No "hydration" or "did not match" warning.
5. **Auto** — click `Auto`, then flip macOS
   *System Settings → Appearance* between Light and Dark. The open page follows
   each flip live, with no reload. `localStorage` reads `"system"`.
6. **Persistence** — reload, and open a second tab at `/`. Both come back on the
   stored choice.
7. **Details page** — open any article from the feed in dark mode and check the
   hero, the AI summary card, the bias distribution card, the bias meter labels,
   `Related Stories` and the newsletter band. Nothing is dark-on-dark.
8. **Auth UI** — visit `/sign-in` and `/sign-up` in dark mode, and open the
   `UserButton` popover while signed in. The Clerk card follows the palette.
9. **Responsive** — at 375px and 768px the theme switch is visible and tappable
   and the utility bar does not wrap or scroll sideways.
10. **Storage blocked** — in a Chrome incognito window with *Block all cookies*
    set for localhost, the app still loads on the light theme and clicking the
    options still re-themes the page for that session.
11. **Light regression** — click `Light` and compare `/` and a details page
    against `git stash`-ed `main`. They are identical.

No API, scrape or analysis step is involved, so no `curl` command and no
`x-biasly-admin-secret` header apply to this task.
