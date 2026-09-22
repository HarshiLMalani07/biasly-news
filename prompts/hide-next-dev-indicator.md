# Hide the Next.js dev indicator (bottom-left button)

## Goal

Remove the floating button in the **bottom-left corner** of the app during
development. It is not a biasly UI element: it is the Next.js dev tools
indicator that `next dev` injects on every page. Hide it so the site renders
clean while developing, without touching any product code or the production
build output.

## Skills read

- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/devIndicators.md`
  — the `devIndicators` config option, its `position` values, and `false` to
  hide the indicator entirely.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  (§ `devIndicators` Options) — in v16 the `appIsrStatus`, `buildActivity`, and
  `buildActivityPosition` sub-options were **removed**; only `position` remains,
  and `false` still disables the indicator. Confirms the v14/v15 snippets in
  training data are stale for this project.

None of the four approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`,
`ai-sdk`) apply — this is a Next.js config change only.

## Existing code inspected

- `next.config.ts` — currently sets `images.remotePatterns` only; no
  `devIndicators` key, so the indicator renders at its default `bottom-left`.
- No application component renders a fixed bottom-left control, so nothing in
  `components/` or `app/` is the source of this button.

## Decisions and assumptions

- **Assumption:** "next button, from bottom left corner" is the Next.js dev
  indicator (the round Next.js logo button `next dev` overlays bottom-left).
  Nothing in the codebase renders a control there, and the design system has no
  floating action button, so this is the only candidate.
- Use `devIndicators: false` (hide entirely) rather than moving it with
  `position` — the request is to remove it, not relocate it.
- Next.js still surfaces compile and runtime errors when the indicator is
  disabled, so this does not hide build failures.
- The indicator is a development-only overlay; `npm run build` / `npm run start`
  output is unchanged either way.

## Files likely to change

- `next.config.ts` (only file)

## Implementation requirements

1. Add `devIndicators: false` to the `NextConfig` object in `next.config.ts`.
2. Add a short comment stating that this hides the dev-only overlay and that
   compile/runtime errors are still reported, so a future reader does not think
   errors are being suppressed.
3. Leave `images.remotePatterns` and its existing comments untouched.
4. No changes to components, routes, styles, or pipeline code.

## Security requirements

- No secrets, env vars, or credentials involved.
- No change to server/client boundaries, admin-secret handling, or any route.
- No `NEXT_PUBLIC_*` surface change; nothing new reaches browser code.

## Acceptance criteria

- `next.config.ts` exports a config with `devIndicators: false` and keeps the
  existing `images` block intact.
- After restarting `npm run dev`, no Next.js indicator button appears in the
  bottom-left corner on any page.
- The app itself is visually unchanged; the home page and article pages render
  exactly as before.
- Compile and runtime errors still appear (terminal, and the error overlay).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (config file changed, so the build is in scope)

## Manual test steps

1. Stop the running dev server, then start it again — **a config change is not
   hot-reloaded**, so the indicator persists until `next dev` restarts:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000/` and confirm the bottom-left corner is empty.
3. Open an article page and `http://localhost:3000/for-you` (the coming-soon
   page) and confirm the corner is empty there too.
4. Confirm the page content itself is unchanged and the theme toggle still works.
