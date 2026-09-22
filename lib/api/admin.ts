import "server-only";

import { NextResponse } from "next/server";

import { secretsMatch } from "@/lib/api/secrets";

/**
 * The shared admin secret guard (AGENTS.md section 15).
 *
 * Every action route that starts or mutates work requires the
 * `x-biasly-admin-secret` *header*. The secret is never read from the query
 * string, never echoed back, and never reaches browser code.
 */

const HEADER_NAME = "x-biasly-admin-secret";

/**
 * Returns a response to send when the caller is not authorised, or null when
 * the request may proceed.
 *
 * The `401` body is deliberately generic: it does not say whether the header
 * was missing or wrong, and never contains the expected value.
 */
export function requireAdminSecret(request: Request): NextResponse | null {
  const expected = process.env.BIASLY_ADMIN_SECRET;

  // An unset secret must never mean "everyone is allowed": fail closed.
  if (!expected) {
    console.error(
      "BIASLY_ADMIN_SECRET is not set - refusing to run an action route."
    );

    return NextResponse.json(
      { error: "Server misconfigured: BIASLY_ADMIN_SECRET is not set." },
      { status: 500 }
    );
  }

  const provided = request.headers.get(HEADER_NAME);

  if (!provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
