import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/queries/unwrap";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * Source reads. Scraping selects its targets from here and never hardcodes a
 * homepage URL (AGENTS.md section 8).
 */

/** Every active source, alphabetically. The default scrape set. */
export async function getActiveSources(): Promise<SourceRow[]> {
  const supabase = getServiceRoleClient();

  return unwrap(
    "getActiveSources",
    await supabase
      .from("sources")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })
  );
}

/**
 * The active sources matching the given names, case-insensitively - for
 * AGENTS.md section 8's "scrape these three sources" instruction. Names that
 * match nothing are simply absent from the result.
 */
export async function getActiveSourcesByNames(
  names: string[]
): Promise<SourceRow[]> {
  if (names.length === 0) return [];

  const wanted = new Set(names.map((name) => name.trim().toLowerCase()));
  const sources = await getActiveSources();

  return sources.filter((source) => wanted.has(source.name.toLowerCase()));
}
