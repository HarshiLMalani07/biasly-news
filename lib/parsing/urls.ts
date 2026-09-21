/**
 * URL absolutisation, normalisation, and the same-site check.
 *
 * Pure functions, no I/O. `normaliseUrl` produces the string that is compared
 * by the URL existence check and stored in `articles.url`, so it must be
 * idempotent: normalising an already-normalised URL returns it unchanged.
 */

/**
 * Query parameters that identify a referral rather than a document. Dropping
 * them keeps one story from being stored twice because it was linked from two
 * homepage slots.
 */
const TRACKING_PARAMS = [
  "cmpid",
  "ito",
  "intcmp",
  "fbclid",
  "gclid",
  "srnd",
  "smid",
  "ref",
  "referrer",
  "taid",
  "cmp",
] as const;

const TRACKING_PREFIXES = ["utm_", "at_", "ns_", "ocid"] as const;

/**
 * Resolves an href against the page it was found on.
 *
 * Returns null for anything that is not a fetchable http(s) document:
 * `mailto:`, `tel:`, `javascript:`, fragment-only links, and malformed hrefs.
 */
export function absolutise(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();

  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;

  try {
    const resolved = new URL(trimmed, baseUrl);

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Canonical form of a URL: lowercase host, no hash, no tracking parameters, no
 * trailing slash except on a bare origin.
 */
export function normaliseUrl(url: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    const isTracking =
      TRACKING_PARAMS.some((param) => param === lower) ||
      TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));

    if (isTracking) parsed.searchParams.delete(key);
  }

  // `search` stays "?" when every parameter was deleted; clear it outright.
  if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

/** The pathname of a URL, or "/" when it cannot be parsed. */
export function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

/**
 * True when the URL's host is, or is a subdomain of, one of `allowedHosts`.
 *
 * This is the SSRF guard: a homepage is untrusted input, so a link is only
 * followed when it stays on the source's own site.
 */
export function isSameSite(
  url: string,
  allowedHosts: readonly string[]
): boolean {
  let host: string;

  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return allowedHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/** Path segments with empties removed: "/news/articles/abc" -> 3 segments. */
export function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}
