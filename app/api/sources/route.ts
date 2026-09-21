import { NextResponse } from "next/server";

import { getActiveSources } from "@/lib/supabase/queries/sources";

/**
 * GET /api/sources - the active scrape targets (AGENTS.md section 14).
 *
 * A read/status route: it mutates nothing, so section 15's admin secret does
 * not apply. It returns only source metadata and never a credential.
 */

export async function GET() {
  try {
    const sources = await getActiveSources();

    return NextResponse.json({
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        listing_url: source.listing_url,
        parser_strategy: source.parser_strategy,
        is_active: source.is_active,
        logo_url: source.logo_url,
      })),
    });
  } catch (error) {
    console.error("GET /api/sources failed:", error);

    return NextResponse.json(
      { error: "Could not load sources." },
      { status: 500 }
    );
  }
}
