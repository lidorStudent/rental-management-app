import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase/environment";
import { hardenedSessionCookieOptions } from "@/lib/supabase/sessionCookieOptions";
import type { Database } from "@/types/database";

/**
 * The client for server components, server actions, and route handlers. It carries the signed-in
 * user's session, so every query it makes runs as that user and every Row Level Security policy
 * applies. This is the only client the application uses to read or write its own data.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(readSupabaseUrl(), readSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenedSessionCookieOptions(options));
          }
        } catch {
          // A server component is not allowed to write cookies, and Next.js throws when it tries.
          // Nothing is lost: the middleware refreshes the session on every request before the page
          // renders, so a refreshed token has already been written by then.
        }
      },
    },
  });
}
