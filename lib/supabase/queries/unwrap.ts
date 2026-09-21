import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/** PostgREST returns this when `.single()` matched no row - a miss, not a failure. */
export const NOT_FOUND_CODE = "PGRST116";

/** Postgres 22P02: invalid input syntax, e.g. a malformed uuid in the URL. */
export const INVALID_TEXT_CODE = "22P02";

/**
 * Turns a supabase-js result into its data, or throws with the operation name
 * in front of the PostgREST message. Connection details and keys never appear
 * in the message.
 */
export function unwrap<T>(
  operation: string,
  result: { data: T | null; error: PostgrestError | null }
): T {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error(`${operation}: no data returned`);
  }

  return result.data;
}

/** True when the error means "no such row", rather than a real failure. */
export function isMiss(error: PostgrestError | null): boolean {
  return (
    error?.code === NOT_FOUND_CODE || error?.code === INVALID_TEXT_CODE
  );
}
