# Remove the Design System sheet from the home page

## Goal

The home route currently renders a "Design System v1.0" reference sheet below the
news feed (brand, colors, typography, icons, UI elements, spacing, grid, shadows,
border radius). This was prototype-only UI and is not part of the product design.
Remove it so the home page ends with the news feed and the footer.

## Skills read

None required. This is a UI-only deletion on an existing route — no Clerk,
Supabase, Oxylabs, or AI SDK behavior is touched. Next.js route structure
confirmed against the existing `app/page.tsx` server component.

## Existing code inspected

- `app/page.tsx` — imports `DesignSystemSheet` and wraps it in a
  `<section className="border-t border-border bg-bg-secondary py-8">` with the
  "Design System v1.0" heading and "Stay consistent. Stay unbiased." subtitle.
- `app/_components/design-system-sheet.tsx` (535 lines) — the sheet itself; only
  consumer is `app/page.tsx`.
- `app/_components/panel.tsx` — `Panel` / `Subhead` helpers; only consumer is
  `design-system-sheet.tsx`.
- Usage scan of everything the sheet imports:
  - Still used elsewhere → keep: `Logo`, `BiasMeter`, `Chip`, `Button`, lucide icons.
  - Becomes unused → `components/news/article-card.tsx` (the feed uses
    `components/news/news-card.tsx`), and `components/ui/separator.tsx`
    (only `panel.tsx` and the sheet import it).

## Decisions / assumptions

1. Delete the sheet and its `Panel`/`Subhead` helpers outright rather than
   hiding them behind a flag — the user called it prototype UI.
2. Also delete `components/news/article-card.tsx`, which exists only to be shown
   inside the sheet's "CARD EXAMPLE" panel and has no other consumer. It is
   prototype UI by the same definition.
3. Keep `components/ui/separator.tsx`. It is a shadcn/ui primitive and removing
   a base primitive is out of scope for this request.
4. Design tokens in the Tailwind config / globals stay untouched — the live UI
   still uses them; only the visual reference sheet goes.
5. No layout compensation needed: `TopNewsSection` already carries its own
   padding, and `SiteFooter` follows directly.

## Files likely to change

- `app/page.tsx` — remove the import and the entire design-system `<section>`.
- `app/_components/design-system-sheet.tsx` — delete.
- `app/_components/panel.tsx` — delete.
- `components/news/article-card.tsx` — delete.
- `app/_components/` — remove the directory if it ends up empty.

## Implementation requirements

- `app/page.tsx` renders exactly: `UtilityBar`, `SiteHeader`, `TopicRail`,
  `<main>` containing only `<TopNewsSection initial={feed} />`, then `SiteFooter`.
- Keep `export const dynamic = "force-dynamic"` and the `getHomeFeed()` call as-is.
- Leave no unused imports behind.
- No other route, component, or style file changes.

## Security requirements

None newly introduced. No secrets, no server/client boundary changes; `app/page.tsx`
stays a server component and no browser code gains access to service keys.

## Acceptance criteria

- The home page shows the feed and "VIEW MORE" button, then the footer — no
  "Design System v1.0" block.
- The news details page and auth pages are visually unchanged.
- `grep -rn "DesignSystemSheet\|design-system-sheet\|ArticleCard" app components`
  returns nothing.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (route file changed)

## Manual test steps

1. `npm run dev`
2. Open http://localhost:3000 — scroll to the bottom of the feed. After the
   "VIEW MORE" button the black footer should appear immediately, with no
   Design System section in between.
3. Click "VIEW MORE" — pagination still loads more cards.
4. Open any article card → the news details page renders as before.
