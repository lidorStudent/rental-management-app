import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase/environment";
import { hardenedSessionCookieOptions } from "@/lib/supabase/sessionCookieOptions";
import type { Database } from "@/types/database";

/**
 * The client used inside middleware, where refreshing the session is the whole point: a rotated
 * access token has to be written back onto the outgoing response or the browser keeps sending the
 * expired one.
 *
 * The response object is replaced whenever Supabase writes cookies, which is why it is handed back
 * as a function rather than as a value.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseClient = createServerClient<Database>(readSupabaseUrl(), readSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenedSessionCookieOptions(options));
        }
      },
    },
  });

  return { supabaseClient, getResponse: () => response };
}
