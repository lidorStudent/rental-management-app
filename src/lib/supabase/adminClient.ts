import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readSupabaseUrl } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";

/**
 * The service role client. It bypasses Row Level Security entirely, so it is the one piece of this
 * codebase that could read or write anybody's data.
 *
 * It exists for the writes a user's own session may not make. There are two callers.
 * src/actions/tenantAccountActions.ts creates a tenant's account and reissues its password, both
 * of which need the Auth admin API, and checks that the acting user owns the lease before it gets
 * anywhere near this client. src/actions/authenticationActions.ts clears must_change_password once
 * the password really has been replaced, against the id getSignedInProfile resolved from the
 * verified session; profiles_self_service_columns_are_pinned refuses that column to the account
 * itself, so the tenant's own client cannot do it.
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
