import { createBrowserClient } from "@supabase/ssr";

import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";

/**
 * The client for code running in the browser. It exists for client components that need to react
 * to the session itself, and it is deliberately not used to read or write application data: every
 * read in this product happens in a server component and every write in a server action.
 *
 * It can only ever use the anonymous key, which grants nothing on its own because every table is
 * behind Row Level Security.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(readSupabaseUrl(), readSupabaseAnonKey());
}
