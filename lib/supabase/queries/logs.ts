import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/queries/unwrap";
import type { Json, LogLevel, LogRow } from "@/lib/supabase/types";

/** Pipeline run logging (AGENTS.md section 9, "Run logging"). */

export type LogEntry = {
  level?: LogLevel;
  /** 'scrape' | 'analyze' | 'scheduler' | 'cron', or a later stage's own. */
  scope: string;
  message: string;
  context?: Json;
  /** Groups every line emitted by one pipeline run. */
  runId?: string;
};

/**
 * Writes one log row. Never throws: a run must not fail because its logging
 * did. Failures are reported on the server console instead, which is where
 * AGENTS.md section 17 tells the user to watch anyway.
 */
export async function writeLog(entry: LogEntry): Promise<void> {
  try {
    const supabase = getServiceRoleClient();

    const { error } = await supabase.from("logs").insert({
      level: entry.level ?? "info",
      scope: entry.scope,
      message: entry.message,
      context: entry.context ?? null,
      run_id: entry.runId ?? null,
    });

    if (error) {
      console.error(`writeLog failed: ${error.message}`);
    }
  } catch (error) {
    console.error("writeLog failed:", error);
  }
}

/** The newest log lines, optionally for one scope. Backs `GET /api/logs`. */
export async function getRecentLogs(
  limit = 100,
  scope?: string
): Promise<LogRow[]> {
  const supabase = getServiceRoleClient();

  const query = supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return unwrap(
    "getRecentLogs",
    await (scope ? query.eq("scope", scope) : query)
  );
}
