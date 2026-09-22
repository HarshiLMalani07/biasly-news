import "server-only";

import { NextResponse } from "next/server";

import { secretsMatch } from "@/lib/api/secrets";

/**
 * The Vercel Cron guard (AGENTS.md section 18).
 *
 * `GET /api/cron/pipeline` is internal only and must not be callable by
 * browsers or users. Vercel injects `CRON_SECRET` into the project environment
 * and sends it as `Authorization: Bearer <value>` on every cron invocation, so
 * that header is the whole authentication story for this route.
 *
 * `CRON_SECRET` is deliberately *not* `BIASLY_ADMIN_SECRET`: section 18 keeps
 * the two apart so the cron route cannot be driven with the admin secret, and
 * section 18 also forbids adding `CRON_SECRET` to `.env.local` - which is why
 * the check is skipped outside production.
 */

/**
 * Returns a response to send when the caller is not Vercel Cron, or null when
 * the request may proceed.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  // Local development has no `CRON_SECRET` by design, so the route would be
  // untestable by hand if the check ran here (AGENTS.md section 18).
  if (process.env.NODE_ENV !== "production") {
    console.log("[cron] CRON_SECRET check skipped (non-production).");
    return null;
  }

  const expected = process.env.CRON_SECRET;

  // An unset secret must never mean "everyone is allowed": fail closed, the
  // same way `requireAdminSecret` does.
  if (!expected) {
    console.error(
      "CRON_SECRET is not set - refusing to run the cron pipeline route."
    );

    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set." },
      { status: 500 }
    );
  }

  const provided = request.headers.get("authorization");

  // The header carries the `Bearer ` prefix; compare the whole string so a
  // caller cannot pass the bare secret with a different scheme.
  if (!provided || !secretsMatch(provided, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
