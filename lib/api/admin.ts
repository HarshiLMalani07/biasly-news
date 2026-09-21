import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * The shared admin secret guard (AGENTS.md section 15).
 *
 * Every action route that starts or mutates work requires the
 * `x-biasly-admin-secret` *header*. The secret is never read from the query
 * string, never echoed back, and never reaches browser code.
 */

const HEADER_NAME = "x-biasly-admin-secret";

/** Constant-time compare that does not leak the expected length via timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  // timingSafeEqual throws on a length mismatch, so the lengths are compared
  // first. A wrong length is already a wrong secret.
  if (providedBytes.length !== expectedBytes.length) return false;

  return timingSafeEqual(providedBytes, expectedBytes);
}

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
