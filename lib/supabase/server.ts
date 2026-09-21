import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * The service-role Supabase client.
 *
 * Service role bypasses RLS, so this module must never reach browser code -
 * the `server-only` import above turns any import from a Client Component into
 * a build error rather than a runtime key leak (AGENTS.md section 21).
 *
 * biasly authenticates with Clerk, not Supabase Auth, so there is no browser
 * client and no user session: every read and write in the app goes through
 * here, from Server Components and route handlers.
 */

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local - see .env.example for the full list.`
    );
  }

  return value;
}

let client: SupabaseClient<Database> | null = null;

export function getServiceRoleClient(): SupabaseClient<Database> {
  if (client) return client;

  client = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      // This client is never a user session: nothing to persist, nothing to
      // refresh, and no storage to write to on the server.
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return client;
}
