import "server-only";

import { RoleMismatchError } from "@/lib/authentication/authenticationErrors";
import { getSignedInProfile, type SignedInProfile } from "@/lib/authentication/getSignedInProfile";

/** The acting user, refused unless they are a tenant. Used by the tenant portal and its actions. */
export async function requireTenantProfile(): Promise<SignedInProfile> {
  const profile = await getSignedInProfile();
  if (profile.role !== "tenant") {
    throw new RoleMismatchError("tenant", profile.role);
  }
  return profile;
}
