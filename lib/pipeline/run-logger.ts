import "server-only";

import { writeLog } from "@/lib/supabase/queries/logs";
import type { Json, LogLevel } from "@/lib/supabase/types";

/**
 * Run logging (AGENTS.md section 9).
 *
 * The console is primary - section 17 tells the user to watch the dev server
 * terminal - and every line is mirrored to `public.logs` under one `run_id`,
 * which is what that table exists for.
 *
 * Mirroring is fire-and-forget: `writeLog` already swallows its own failures,
 * and a run must never fail because its logging did.
 */

export type RunLogger = {
  /** Groups every line emitted by this run. */
  runId: string;
  info: (message: string, context?: Json) => void;
  warn: (message: string, context?: Json) => void;
  error: (message: string, context?: Json) => void;
  /** The final summary object: printed whole, and stored as log context. */
  summary: (summary: Json) => void;
};

export function createRunLogger(scope: string): RunLogger {
  const runId = crypto.randomUUID();
  const short = runId.slice(0, 8);
  const prefix = `[${scope} ${short}]`;

  function emit(level: LogLevel, message: string, context?: Json): void {
    const line = `${prefix} ${message}`;

    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    void writeLog({ level, scope, message, context, runId });
  }

  return {
    runId,
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
    summary: (summary) => {
      console.log(`${prefix} Summary:`);
      console.log(summary);

      void writeLog({
        level: "info",
        scope,
        message: "Run summary",
        context: summary,
        runId,
      });
    },
  };
}
