import "server-only";

import { OxylabsError } from "@/lib/oxylabs/client";

/**
 * Big-integer-safe JSON parsing for Oxylabs Scheduler payloads
 * (AGENTS.md section 18, "Large integer precision - critical").
 *
 * Oxylabs returns `schedule_id` as an unquoted 18-digit integer and each job
 * `id` in `/runs` as an unquoted 19-digit integer. `Number.MAX_SAFE_INTEGER` is
 * 9007199254740991 - 16 digits - so `JSON.parse` rounds both silently and hands
 * back an id Oxylabs will not recognise. Nothing downstream can detect it,
 * because the corrupted value is a perfectly ordinary number.
 *
 * Section 18 is explicit that these ids must be read from the raw HTTP response
 * text before any `JSON.parse` call, and that a parsed number must never be
 * converted back to a string - the precision is already gone by then. So this
 * module rewrites the *text*: every long integer literal is quoted before the
 * parse, and comes out of it as an exact digit string.
 *
 * Every Scheduler response goes through here. `JSON.parse` is never called
 * directly on one.
 */

/**
 * The first digit length that can exceed `Number.MAX_SAFE_INTEGER`.
 *
 * Every other number in these payloads is far shorter - `run_id` is about 9
 * digits, `create_status_code` is 202, `items_count` and `success_rate` are
 * tiny - so nothing that is genuinely a number gets turned into a string.
 */
const UNSAFE_DIGIT_COUNT = 16;

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

/**
 * Quotes every long integer literal in the raw response text.
 *
 * This is a scanner rather than a regular expression on purpose. A regex that
 * matched digits between JSON punctuation would also match *inside* a string,
 * and `GET /v1/queries/{id}/results` returns a whole homepage of HTML in
 * `content` - markup that routinely contains things like `[1234567890123456789]`
 * in an inline script. Rewriting those would corrupt the HTML before Cheerio
 * ever parses it. Tracking string state makes the rewrite exact: only number
 * literals in the JSON grammar are touched, and never a character inside a
 * string.
 *
 * Floats and numbers in exponent form are left alone as well; only a plain
 * integer of `UNSAFE_DIGIT_COUNT` digits or more is quoted, which is exactly
 * the shape Oxylabs uses for `schedule_id` and job `id`.
 *
 * Exported so the rewrite can be exercised on its own.
 */
export function quoteLongIntegers(text: string): string {
  let out = "";
  let index = 0;
  let inString = false;

  while (index < text.length) {
    const char = text[index];

    if (inString) {
      // A backslash escapes the next character, including a quote, so both are
      // copied together and cannot end the string by accident.
      if (char === "\\") {
        out += text.slice(index, index + 2);
        index += 2;
        continue;
      }

      if (char === '"') inString = false;

      out += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }

    // Outside a string, a digit or a leading minus can only begin a number
    // literal - in JSON there is nowhere else either may appear.
    if (isDigit(char) || (char === "-" && isDigit(text[index + 1] ?? ""))) {
      const start = index;
      if (char === "-") index += 1;

      const digitsStart = index;
      while (index < text.length && isDigit(text[index])) index += 1;
      const digits = index - digitsStart;

      // A fraction or an exponent means this is not an id. The *whole* number
      // token is consumed here rather than just its integer part: stopping at
      // the `.` would leave the fractional digits to be rescanned as a number
      // of their own, and a long enough fraction would then be quoted in the
      // middle of the literal (`1."2345678901234567"`), which is not JSON.
      let isInteger = true;

      if (text[index] === ".") {
        isInteger = false;
        index += 1;
        while (index < text.length && isDigit(text[index])) index += 1;
      }

      if (text[index] === "e" || text[index] === "E") {
        isInteger = false;
        index += 1;
        if (text[index] === "+" || text[index] === "-") index += 1;
        while (index < text.length && isDigit(text[index])) index += 1;
      }

      const literal = text.slice(start, index);
      out += isInteger && digits >= UNSAFE_DIGIT_COUNT ? `"${literal}"` : literal;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/**
 * Parses an Oxylabs response, preserving 64-bit ids exactly.
 *
 * `context` names the call for the error message; the raw body is never
 * included, because it can be large and can carry a full page of HTML.
 */
export function parseOxylabsJson<T>(text: string, context: string): T {
  try {
    return JSON.parse(quoteLongIntegers(text)) as T;
  } catch {
    throw new OxylabsError(`Oxylabs returned a non-JSON body for ${context}`);
  }
}
