import "server-only";

import {
  AuthenticationRequiredError,
  ProfileMissingError,
} from "@/lib/authentication/authenticationErrors";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type SignedInProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
};

/**
 * The single place in this codebase where the acting user is decided.
 *
 * The identity comes from the session cookie by way of supabase.auth.getUser(), which verifies the
 * token with the Auth service rather than trusting whatever the cookie claims. The role comes from
 * the profiles table, never from the token: a signed-in user can edit their own token metadata
 * through the Auth API, and cannot edit their profile row, because profiles_role_is_immutable
 * refuses it.
 *
 * It throws rather than returning null, so that a caller cannot forget to handle the empty case.
 * Middleware redirects an unauthenticated request long before it reaches an action, which makes
 * these throws the assertion that the guard held rather than an expected path.
 */
export async function getSignedInProfile(): Promise<SignedInProfile> {
  const supabaseClient = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError !== null || userData.user === null) {
    throw new AuthenticationRequiredError();
  }

  const { data: profileRow, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, must_change_password")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError !== null) {
    throw new Error(`Could not read the profile of the signed-in user: ${profileError.message}`);
  }
  if (profileRow === null) {
    throw new ProfileMissingError(userData.user.id);
  }

  return {
    id: profileRow.id,
    email: profileRow.email,
    fullName: profileRow.full_name,
    role: profileRow.role,
    mustChangePassword: profileRow.must_change_password,
  };
}
