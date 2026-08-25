import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readSupabaseUrl } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";

/**
 * The service role client. It bypasses Row Level Security entirely, so it is the one piece of this
 * codebase that could read or write anybody's data.
 *
 * It exists for a single job: creating and resetting a tenant's account, which needs the Auth
 * admin API. The only caller is src/actions/tenantAccountActions.ts, and that action checks that
 * the acting user owns the lease before it gets anywhere near this client.
 *
 * The `server-only` import above turns any attempt to pull this file into a client component into
 * a build error, and the key it reads has no NEXT_PUBLIC_ prefix, so it is never sent to a browser.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey === undefined || serviceRoleKey === "") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required to create tenant accounts.",
    );
  }

  return createClient<Database>(readSupabaseUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
