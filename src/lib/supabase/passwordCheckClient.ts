import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";

/**
 * A client that carries no session and writes no cookie, used for one job: asking Supabase whether a
 * password is the account's current one, by attempting a sign-in with it.
 *
 * It exists as its own client because of what it must not do. The server client in this project
 * carries the caller's session, and signing in through it would rotate that session as a side effect
 * of a check that is meant to be read-only. This one has `persistSession: false` and no cookie
 * handlers at all, so a successful attempt produces a session object that is discarded when the
 * function returns and is never written anywhere.
 *
 * The session it briefly creates is not signed out afterwards, deliberately: `signOut()` defaults to
 * revoking every refresh token the user holds, which would sign the person out of the browser they
 * are standing in. The unused token expires on its own.
 */
export function createSupabasePasswordCheckClient() {
  return createClient<Database>(readSupabaseUrl(), readSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
