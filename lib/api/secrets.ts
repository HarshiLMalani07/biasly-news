import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * The shared secret comparison used by every guarded route.
 *
 * Both guards in this directory compare a caller-supplied string against a
 * server-side secret - `x-biasly-admin-secret` against `BIASLY_ADMIN_SECRET`
 * (AGENTS.md section 15), and the cron `Authorization` header against
 * `CRON_SECRET` (section 18). The compare lives here once so the two cannot
 * drift apart.
 */

/** Constant-time compare that does not leak the expected length via timing. */
export function secretsMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  // timingSafeEqual throws on a length mismatch, so the lengths are compared
  // first. A wrong length is already a wrong secret.
  if (providedBytes.length !== expectedBytes.length) return false;

  return timingSafeEqual(providedBytes, expectedBytes);
}
