import "server-only";

import {
  OXYLABS_RENDER_TIMEOUT_MS,
  OXYLABS_TIMEOUT_MS,
} from "@/lib/scraping/limits";

/**
 * The Oxylabs Web Scraper API client.
 *
 * Realtime (`realtime.oxylabs.io`) is used because manual scraping needs the
 * HTML in the same request; `data.oxylabs.io` is Push-Pull and belongs to the
 * Scheduler task (AGENTS.md section 18).
 *
 * News homepages have no dedicated Oxylabs source, so every call uses
 * `source: "universal"` with a `url`. `parse: true` does not apply - it only
 * produces structured output for supported targets, and biasly parses the HTML
 * itself with Cheerio.
 *
 * Credentials are read here and nowhere else. They are never logged, never
 * returned to a caller, and `server-only` above makes importing this module
 * from browser code a build error (AGENTS.md section 21).
 */

const REALTIME_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

/** A failed scrape, with enough detail for a log line and nothing more. */
export class OxylabsError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "OxylabsError";
    this.status = status;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local - see .env.example for the full list.`
    );
  }

  return value;
}

function authorizationHeader(): string {
  const username = requireEnv("OXY_WSA_USERNAME");
  const password = requireEnv("OXY_WSA_PASSWORD");

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/** The slice of the Oxylabs response this client reads. */
type OxylabsResponse = {
  results?: { content?: unknown; status_code?: number; url?: string }[];
  error?: { code?: string; message?: string };
  message?: string;
};

/**
 * Scrapes one URL and returns its HTML.
 *
 * `render` turns on JavaScript rendering. It is off by default: all five
 * seeded sources server-render their markup, and rendering is slower and more
 * expensive. The pipeline retries a homepage once with `render: true` when it
 * yields no candidate links at all.
 */
export async function fetchPageHtml(
  url: string,
  options: { render?: boolean } = {}
): Promise<string> {
  const payload: Record<string, unknown> = {
    source: "universal",
    url,
    user_agent_type: "desktop_chrome",
    geo_location: "United States",
  };

  if (options.render) payload.render = "html";

  const timeoutMs = options.render
    ? OXYLABS_RENDER_TIMEOUT_MS
    : OXYLABS_TIMEOUT_MS;

  let response: Response;
  let body: string;

  // The body read is inside the try as well: an abort can land while the
  // response is still streaming, and that must surface as an OxylabsError
  // naming the URL rather than a bare AbortError.
  try {
    response = await fetch(REALTIME_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    body = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new OxylabsError(`Oxylabs request failed for ${url}: ${reason}`);
  }

  if (!response.ok) {
    throw new OxylabsError(apiErrorMessage(response.status, body), response.status);
  }

  let parsed: OxylabsResponse;

  try {
    parsed = JSON.parse(body) as OxylabsResponse;
  } catch {
    throw new OxylabsError(
      `Oxylabs returned a non-JSON body for ${url}`,
      response.status
    );
  }

  if (parsed.error) {
    const code = parsed.error.code ?? "unknown";
    const message = parsed.error.message ?? "no message";
    throw new OxylabsError(`Oxylabs error ${code} for ${url}: ${message}`);
  }

  const result = parsed.results?.[0];

  if (!result) {
    throw new OxylabsError(`Oxylabs returned no results for ${url}`);
  }

  // This is the *target site's* status code, not the API's: a 403 here means
  // the publisher blocked the scrape, a 404 that the page is gone.
  const targetStatus = result.status_code;

  if (
    typeof targetStatus === "number" &&
    (targetStatus < 200 || targetStatus >= 300)
  ) {
    throw new OxylabsError(
      `Target site returned ${targetStatus} for ${url} ` +
        `(${targetStatus === 403 ? "blocked" : "not delivered"})`,
      targetStatus
    );
  }

  if (typeof result.content !== "string" || result.content.length === 0) {
    throw new OxylabsError(`Oxylabs returned empty content for ${url}`);
  }

  return result.content;
}

/**
 * Turns a non-2xx API status into a message. Never includes the credentials or
 * the raw body, which can be large.
 */
function apiErrorMessage(status: number, body: string): string {
  if (status === 401) {
    return (
      "Oxylabs rejected the credentials (401). Check OXY_WSA_USERNAME and " +
      "OXY_WSA_PASSWORD in .env.local."
    );
  }

  if (status === 429) {
    return "Oxylabs rate limit exceeded (429). Slow down or retry later.";
  }

  if (status === 400) {
    return `Oxylabs rejected the request (400): ${body.slice(0, 200)}`;
  }

  return `Oxylabs request failed with HTTP ${status}.`;
}
