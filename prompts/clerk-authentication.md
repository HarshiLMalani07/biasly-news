# Prompt: biasly Clerk Authentication

## Goal

Wire real Clerk authentication into biasly: install the current Clerk Next.js SDK, add
`ClerkProvider` to the root layout, add a root `proxy.ts` that gates **`/news/(.*)`** behind
sign-in while every other route stays public, build dedicated `/sign-in` and `/sign-up` pages,
and replace the masthead's inert **Login** button with real Clerk controls (`SignInButton` /
`SignUpButton` when signed out, `UserButton` when signed in).

Clerk components are themed with `@clerk/ui`'s `shadcn` theme so they read from the existing
biasly token layer rather than shipping Clerk's stock look.

This task builds **auth only**. It adds no Supabase layer, no scraping, no AI analysis, no
`/api` route handlers, no organizations, no billing, and no webhooks. Per AGENTS.md section 5
the UI still displays stored data only — nothing in this task scrapes, analyses, or mutates
pipeline state.

## Skills read

- `AGENTS.md` — sections 1 (scope: *Clerk authentication* is an in-scope deliverable; "do not
  overbuild"), 2 (workflow: skills → inspect → prompt → approval → implement → checks → test
  steps), 5 (architecture layers; UI displays stored data only), 6 (tech stack: Clerk in, **Supabase
  Auth out**), 14/15 (API method + `x-biasly-admin-secret` rules — action routes are **not** Clerk's
  job), 21 (security: only `NEXT_PUBLIC_*` may reach browser code; the env var table already lists
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_*_FALLBACK_REDIRECT_URL`, and names
  `.env.example` as the canonical list), 22 (checks to run)
- `.claude/skills/clerk/SKILL.md` — the router. Version table: `@clerk/nextjs` v7+ is the
  **current SDK**; v5–v6 is Core 2/LTS. Routed this task to `clerk-setup` (install) +
  `clerk-nextjs-patterns` (proxy strategy, server vs client) + `clerk-custom-ui` (shadcn theme).
- `.agents/skills/clerk-setup/SKILL.md` — framework detection (`next` → Next.js quickstart),
  `ClerkProvider` must sit **inside `<body>`** on the current SDK, Next.js ≤15 uses
  `middleware.ts` / Next.js 16 uses `proxy.ts`, themes come from `@clerk/ui` (Core 2 used
  `@clerk/themes`), and the rule: *"If the project has `components.json` (shadcn/ui), ALWAYS apply
  the shadcn theme."* Pitfall table: missing `await` on `auth()`, never expose `CLERK_SECRET_KEY`,
  server imports come from `@clerk/nextjs/server` and client imports from `@clerk/nextjs`.
- `.agents/skills/clerk-nextjs-patterns/SKILL.md` — server (`await auth()`) vs client (`useAuth()`,
  `<Show>`) split; `isAuthenticated` replaces the `!!userId` check on the current SDK.
- `.agents/skills/clerk-nextjs-patterns/references/middleware-strategies.md` — the **public-first**
  strategy (protect listed routes, allow everything else) and the canonical `config.matcher`.
- `.agents/skills/clerk-nextjs-patterns/templates/nextjs-basic-auth/` — reference `proxy.ts` and
  `layout.tsx` shapes for the current SDK.
- `.agents/skills/clerk-custom-ui/SKILL.md` — appearance prop (`variables`, `options`), and the
  shadcn theme instruction: `theme: shadcn` on `ClerkProvider` plus
  `@import '@clerk/ui/themes/shadcn.css'` in global styles.
- `.agents/skills/clerk-custom-ui/core-3/show-component.md` — `<Show when="signed-in" | "signed-out">`
  with `fallback`, and the security caveat: **`<Show>` only visually hides content; it is not a
  security boundary.** Real protection comes from `proxy.ts` / `auth()`.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — *"Starting with Next.js 16,
  Middleware is now called Proxy."* One `proxy.ts` at the project root, beside `app/`; exported as
  default or as a named `proxy` export; `config.matcher` filters the paths it runs on.
- Clerk docs fetched live (the skills instruct WebFetch rather than recalling from memory):
  - `clerk.com/docs/nextjs/getting-started/quickstart` — Next.js 16 → `proxy.ts`; `ClerkProvider`
    inside `<body>`; `Show` / `SignInButton` / `SignUpButton` / `UserButton`.
  - `clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page` — the combined
    sign-in-or-up page, **explicitly not recommended when `clerkMiddleware()` includes auth
    checks** (ours does) → drives decision 4 below.
  - `clerk.com/docs/nextjs/guides/development/custom-sign-up-page` —
    `app/sign-up/[[...sign-up]]/page.tsx`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`.
  - `clerk.com/docs/nextjs/reference/components/unstyled/sign-in-button.md` — `SignInButton`
    accepts **exactly one custom child**, plus `mode`, `forceRedirectUrl`, `fallbackRedirectUrl`,
    `signUpForceRedirectUrl`, `signUpFallbackRedirectUrl`.
- No Supabase / Oxylabs / AI SDK skill is needed: this task touches no database, scraping, or model
  code.

## Existing code inspected

- `package.json` — `next 16.3.5`, `react 19.2.8`, `react-dom 19.2.8`, shadcn primitives
  (`radix-ui`, `class-variance-authority`, `cn`, `lucide-react`, `tailwindcss@4`). **No Clerk
  package installed yet.** Scripts: `dev`, `build`, `start`, `lint`, `typecheck`.
- `.env.local` — already holds `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. The four
  URL variables from the AGENTS.md table are **missing** and must be added.
- `.gitignore` — ignores `.env*` with no exception, so a committed `.env.example` needs a
  `!.env.example` negation. `.env.example` does not exist yet.
- `app/layout.tsx` — Poppins on `--font-poppins`; `html.h-full antialiased`;
  `body.min-h-full flex flex-col`; Next 16 `LayoutProps<"/">` typing; `metadata` export.
  `ClerkProvider` must be inserted **inside `<body>`**, wrapping `{children}`.
- `app/globals.css` — `@import "tailwindcss"`, `"tw-animate-css"`, `"shadcn/tailwind.css"`, then the
  biasly `@theme` token block, then an `@theme inline` block that re-points the shadcn semantic
  variables (`--color-primary`, `--color-background`, `--color-border`, `--color-ring`, …) at the
  biasly palette on `:root` (`--primary: var(--color-text-primary)`, `--radius: 12px`, …). This is
  exactly what makes the Clerk **shadcn theme** the right choice: it consumes those same variables,
  so Clerk components inherit biasly's palette and radius with no per-component overrides.
- `app/page.tsx` — the home route (`UtilityBar`, `SiteHeader`, `TopicRail`, `TopNewsSection`, design
  system sheet, `SiteFooter`). Stays public; **not edited** by this task.
- `app/news/[id]/page.tsx` — the details route. Has `generateStaticParams()` + `generateMetadata()`,
  reads `lib/demo/article-detail`, calls `notFound()`. It **does not call `auth()`**, so it keeps
  prerendering; the proxy enforces the gate per request. **Not edited** by this task.
- `components/layout/site-header.tsx` — server component. Its comment already says the auth buttons
  *"are inert until those routes and Clerk exist."* Ends with
  `<Button variant="primary" …>Subscribe</Button>` + `<Button variant="secondary">Login</Button>` —
  the Login button is what this task replaces.
- `components/layout/utility-bar.tsx`, `site-footer.tsx`, `topic-rail.tsx` — untouched.
- `components/ui/button.tsx` — cva variants `primary` / `secondary` / `outline` / `text`; sizes
  `default` (h-10) / `sm` / `lg` / `icon`; supports `asChild` via `Slot.Root`. The Clerk buttons
  wrap these rather than restyling.
- `components/brand/logo.tsx` — `Logo` with `size` and `inverted` props; reused as the sign-in /
  sign-up page masthead.
- `next.config.ts` — `images.remotePatterns` for `images.unsplash.com` only. **No change needed**;
  Clerk avatars inside `<UserButton />` are rendered by Clerk's own `<img>`, not `next/image`.
- `tsconfig.json` — `strict: true`, `@/*` path alias, `moduleResolution: "bundler"`.

## Decisions and assumptions

1. **Current SDK, not Core 2.** Install `@clerk/nextjs` (latest is **7.9.4**) and `@clerk/ui`
   (**1.33.1**). Verified peer ranges: `next ^16.1.0-0` ✓ 16.3.5, `react ~19.2.3` ✓ 19.2.8. So all
   `> Core 2 ONLY` callouts in the skills are **skipped**: use `<Show>` (not `<SignedIn>` /
   `<SignedOut>`), `await auth()` with `isAuthenticated`, themes from `@clerk/ui`, and
   `ClerkProvider` inside `<body>`.
2. **`proxy.ts`, not `middleware.ts`.** Next 16.3.5 renamed Middleware to Proxy. The file goes at
   the **project root** (beside `app/`), exports `clerkMiddleware()` as default plus `config`. The
   code is identical to the old `middleware.ts`; only the filename changed.
3. **Public-first gating, `/news/(.*)` protected** — per the user's answer to the scoping question.
   `createRouteMatcher(['/news(.*)'])` + `await auth.protect()`. Home, `/sign-in`, `/sign-up`, the
   inert nav targets, and future `/api` routes stay public by default. This keeps `/sign-in` and
   `/sign-up` reachable without a matcher exception.
4. **Two dedicated auth pages, not the combined sign-in-or-up page.** Clerk's own docs say the
   combined `<SignIn>`-handles-both pattern *"is no longer recommended"* when `clerkMiddleware()`
   includes auth checks — and ours does (decision 3). So build
   `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` as optional
   catch-all routes, and point `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` at them.
5. **Auth pages get minimal chrome, not the full masthead.** A centered card on `bg-bg-secondary`
   with the `Logo` linking home. Rendering `SiteHeader` here would show a Login button on the login
   page; rendering `SiteFooter` adds noise to a focused task. This is a deliberate, stated choice.
6. **Clerk never guards the `/api` action routes.** AGENTS.md sections 14/15/18 reserve those for
   `x-biasly-admin-secret` and `CRON_SECRET`. `clerkMiddleware()` still *runs* on `/(api|trpc)(.*)`
   (per the canonical matcher, so auth context exists if ever needed) but calls no `protect()`
   there, so machine callers such as Vercel Cron pass straight through.
7. **No `dynamic` prop on `ClerkProvider`.** The home and news routes are statically prerendered and
   none of them calls `auth()`; Clerk's client components resolve auth after hydration. Adding
   `dynamic` would opt the whole tree into dynamic rendering for no benefit at this stage.
8. **shadcn theme, mandated by the skill** (`components.json` exists). `appearance={{ theme: shadcn }}`
   on `ClerkProvider` + `@import "@clerk/ui/themes/shadcn.css"` in `globals.css`. Both export paths
   verified present in `@clerk/ui`'s package exports (`./themes`, `./themes/shadcn.css`). No
   `variables` overrides are needed — the theme reads the `:root` variables `globals.css` already
   re-points at the biasly palette.
9. **`mode="redirect"` (the default), not modal.** Sends users to the real `/sign-in` page so the
   protected-route redirect and the header button land in the same place.
10. **Header stays a server component.** Clerk's `<Show>` / `SignInButton` / `UserButton` are client
    components imported into it — a valid server→client boundary, no `"use client"` needed on
    `site-header.tsx`.
11. **`Subscribe` stays inert.** Billing is out of scope (AGENTS.md section 1 does not list it).
12. **`.env.example` is created with the Clerk block only.** AGENTS.md section 21 calls it the
    canonical list; the Supabase / Oxylabs / OpenAI / admin-secret rows get appended by the tasks
    that introduce them. The file is added to git via a `!.env.example` negation in `.gitignore`.
13. **The CLI path is skipped.** `clerk init` would overwrite existing keys and rewrite files
    unattended; the keys are already present, so follow the manual quickstart instead.

## Files likely to change

| File | Change |
|------|--------|
| `package.json` / `package-lock.json` | add `@clerk/nextjs` ^7.9.4, `@clerk/ui` ^1.33.1 |
| `proxy.ts` | **new** — root proxy: `clerkMiddleware()`, protect `/news(.*)`, canonical matcher |
| `app/layout.tsx` | wrap `{children}` in `<ClerkProvider appearance={{ theme: shadcn }}>` inside `<body>` |
| `app/globals.css` | add `@import "@clerk/ui/themes/shadcn.css";` after the existing imports |
| `app/sign-in/[[...sign-in]]/page.tsx` | **new** — `<SignIn />` on the minimal auth shell |
| `app/sign-up/[[...sign-up]]/page.tsx` | **new** — `<SignUp />` on the minimal auth shell |
| `app/(auth)/_components/auth-shell.tsx` *(or `components/auth/auth-shell.tsx`)* | **new** — shared centered wrapper + `Logo` |
| `components/layout/site-header.tsx` | replace the inert `Login` button with `<Show>` + Clerk buttons / `UserButton`; update the stale comment |
| `.env.local` | add the four `NEXT_PUBLIC_CLERK_*` URL variables |
| `.env.example` | **new** — Clerk block, no real values |
| `.gitignore` | add `!.env.example` under the env section |

Not touched: `app/page.tsx`, `app/news/[id]/page.tsx`, `next.config.ts`, every component under
`components/news/`, `components/analysis/`, `components/bias/`, `lib/`.

## Implementation requirements

### 1. Install

```bash
npm install @clerk/nextjs @clerk/ui
```

Confirm the resolved `@clerk/nextjs` major is **7** (current SDK). If npm resolves a 5.x or 6.x,
stop and report it — every pattern below would need the Core 2 variants instead.

### 2. `proxy.ts` (project root)

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Article detail pages require an account; everything else is public. */
const isProtectedRoute = createRouteMatcher(["/news(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- Use the matcher **verbatim** from `references/middleware-strategies.md` — it is what excludes
  `_next` and static assets and what keeps API routes in scope.
- `auth.protect()` is `await`ed (current SDK; the Core 2 `auth().protect()` form is wrong here).
- Add a short comment noting that action routes are guarded by `x-biasly-admin-secret`
  (AGENTS.md section 15), not by Clerk.

### 3. `app/layout.tsx`

Keep the existing `metadata`, fonts, `LayoutProps<"/">` typing and body classes. Insert the
provider inside `<body>`:

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";

// ...
<body className="min-h-full flex flex-col">
  <ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
</body>
```

`ClerkProvider` must **not** wrap `<html>` — that is the Core 2 placement and is a listed pitfall
for the current SDK. Do not add the `dynamic` prop (decision 7).

Note: `body` is `flex flex-col` and the page trees rely on `mt-auto` on the footer. `ClerkProvider`
renders a context provider, but confirm in the browser that the footer still pins to the bottom on
a short page; if the provider introduces a wrapper element that breaks the flex column, keep the
provider where it is and move the `flex flex-col min-h-full` classes onto an inner wrapper rather
than removing the provider from `<body>`.

### 4. `app/globals.css`

Add the theme stylesheet with the other imports at the very top of the file (CSS requires all
`@import` rules to precede other rules), after `shadcn/tailwind.css`:

```css
@import "@clerk/ui/themes/shadcn.css";
```

Add no new tokens. The biasly `@theme` block and the `:root` shadcn variable mapping already supply
everything the theme reads.

### 5. Auth shell + pages

A small shared presentational component — centered column, `bg-bg-secondary`, vertical padding,
`Logo` linking to `/`, then the Clerk component. Typed props, no `any`, server component.

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in — biasly" };

export default function Page() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
```

Mirror it for `app/sign-up/[[...sign-up]]/page.tsx` with `<SignUp />` and
`title: "Create account — biasly"`. Both use the **optional catch-all** `[[...sign-in]]` /
`[[...sign-up]]` segment — Clerk routes its own sub-steps (factor-one, SSO callback, verification)
through those segments, and a plain `page.tsx` would 404 on them.

No `appearance` prop on `<SignIn>` / `<SignUp>`: the provider-level shadcn theme covers them.

### 6. `components/layout/site-header.tsx`

Replace the trailing button pair. `Subscribe` is unchanged; `Login` becomes:

```tsx
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

<Show
  when="signed-in"
  fallback={
    <>
      <SignInButton>
        <Button variant="secondary">Login</Button>
      </SignInButton>
      <SignUpButton>
        <Button variant="primary" className="hidden sm:inline-flex">
          Sign up
        </Button>
      </SignUpButton>
    </>
  }
>
  <UserButton />
</Show>
```

- `SignInButton` / `SignUpButton` accept **exactly one child** — wrap multiples in a fragment only
  at the `fallback` level, never as the button's child.
- Reuse the existing `Button` variants; do not restyle or add new variants.
- Keep the existing `Subscribe` button and the `flex items-center gap-3` container.
- Update the component's doc comment — it currently claims the auth buttons are inert.
- Signed-out header height must not shift when `<Show>` resolves after hydration; if `UserButton`
  is shorter/taller than the 40px `Button`, constrain it with a wrapper of the same height rather
  than changing the `Button` size.

### 7. Environment variables

Append to `.env.local` (the two Clerk keys already there stay as-is):

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

Create `.env.example` with the same six keys and **empty or placeholder values only** — never the
real `pk_test_…` / `sk_test_…`. Add a header comment saying the Supabase, Oxylabs, OpenAI and
admin-secret rows from AGENTS.md section 21 are appended as those features land.

In `.gitignore`, under the existing `# env files` section, add:

```
!.env.example
```

### 8. Code standards

- TypeScript throughout, no `any`.
- Server imports from `@clerk/nextjs/server`; client components from `@clerk/nextjs`. Never mix.
- No unrelated refactors, no new Button variants, no token changes, no touching the news/analysis
  components.

## Security requirements

- `CLERK_SECRET_KEY` is server-only. It must appear **nowhere** in `app/`, `components/`, or any
  `"use client"` file — only in `.env.local`, and as a placeholder in `.env.example`. Only the four
  `NEXT_PUBLIC_CLERK_*` URL values and the publishable key may reach the browser.
- The real key values must not be committed. `.gitignore` continues to ignore `.env*`; only the
  placeholder `.env.example` is negated.
- Enforcement lives in `proxy.ts` and in server-side `auth()`. `<Show>` is presentation only and is
  **not** a security boundary — do not use it as the sole guard for anything sensitive.
- Clerk does not replace `x-biasly-admin-secret` (AGENTS.md section 15) or `CRON_SECRET`
  (section 18) on `/api` routes; no `auth.protect()` is applied to `/api/*` in this task.
- Supabase Auth remains unused (AGENTS.md section 6).
- No Oxylabs, OpenAI, scraping, or analysis code is added or called from browser code.

## Acceptance criteria

1. `@clerk/nextjs` v7.x and `@clerk/ui` v1.x are in `package.json` dependencies.
2. `proxy.ts` exists at the project root, uses `clerkMiddleware` + `createRouteMatcher`, awaits
   `auth.protect()` for `/news(.*)` only, and exports the canonical matcher.
3. `ClerkProvider` is inside `<body>` in `app/layout.tsx` with `appearance={{ theme: shadcn }}`.
4. `app/globals.css` imports `@clerk/ui/themes/shadcn.css` alongside the other `@import` rules.
5. `/sign-in` and `/sign-up` render Clerk's `<SignIn>` / `<SignUp>` from optional catch-all routes
   and visually match the biasly palette (dark near-black primary, 12px radius, Poppins).
6. Signed out: the masthead shows **Login** and **Sign up**; signed in: it shows `UserButton`.
7. Signed out, visiting `/news/<id>` redirects to `/sign-in`; after signing in the user lands back
   on that article.
8. Signed out, `/` renders fully — feed, topic rail, design-system sheet, footer.
9. Sign-out from `UserButton` returns the user to a signed-out header with no error.
10. No `CLERK_SECRET_KEY` reference in any client-reachable file; `.env.example` holds placeholders
    only and is no longer git-ignored.
11. `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
12. No file under `components/news/`, `components/analysis/`, `lib/`, `app/page.tsx`,
    `app/news/[id]/page.tsx`, or `next.config.ts` is modified.

## Checks to run

Per AGENTS.md section 22 — this change adds a root proxy file, new routes, and a provider in the
root layout, so **all three** apply:

```bash
npm run typecheck
npm run lint
npm run build
```

Report the exact output of each. Do not claim a check passed without running it.

## Manual test steps

```bash
npm run dev
```

Watch the dev server terminal throughout.

1. **Public home** — open `http://localhost:3000` in a **signed-out / private window**. The page
   renders in full. The header shows **Login** and **Sign up** (no `UserButton`, no redirect).
2. **Protected article, signed out** — navigate to any article card, or go straight to
   `http://localhost:3000/news/<id>` (use an id from `lib/demo/article-detail.ts`). You are
   redirected to `/sign-in` with a `redirect_url` query param pointing back at the article.
3. **Sign up** — click **Sign up** in the header (or the link on the sign-in card). `/sign-up`
   renders Clerk's card on the biasly shell with the Logo above it. Create a test account and
   complete email verification. You land back on `/`.
4. **Header, signed in** — the masthead now shows the `UserButton` avatar in place of the Login /
   Sign up pair. Header height has not shifted.
5. **Protected article, signed in** — open `/news/<id>` again. It renders the full details page:
   article header, hero, Bias Distribution, body, Related Stories, and the three analysis cards.
6. **Sign out and back in** — open `UserButton` → *Sign out*. The header returns to Login / Sign up.
   Click **Login**, sign in with the same account, confirm you return to `/`.
7. **Direct auth routes** — `http://localhost:3000/sign-in` and `/sign-up` both load without a
   redirect loop while signed out.
8. **Theme check** — on the sign-in card, confirm the primary button is biasly's near-black
   (`#0d0d0f`), corners are 12px, and the type is Poppins — i.e. the shadcn theme is picking up the
   `:root` variables, not Clerk's stock blue.
9. **Secret leak check** — confirm nothing sensitive is bundled:

   ```bash
   grep -rn "CLERK_SECRET_KEY" app components lib proxy.ts
   ```

   Only `.env.local` / `.env.example` should contain it — this command must return nothing.

10. **Production build sanity**:

    ```bash
    npm run build && npm run start
    ```

    Repeat steps 1, 2 and 5 against `http://localhost:3000` to confirm the gate holds in a
    production build (home prerendered and public, `/news/<id>` redirecting when signed out).
