import "server-only";

import {
  PasswordChangeRequiredError,
  RoleMismatchError,
} from "@/lib/authentication/authenticationErrors";
import { getSignedInProfile, type SignedInProfile } from "@/lib/authentication/getSignedInProfile";

/**
 * The acting user, refused unless they are a tenant. Used by the tenant portal and its actions.
 *
 * The password check is defence in depth rather than a fix for something reachable; see
 * requireLandlordProfile for what was measured and why the guarantee is worth owning here.
 *
 * It matters most for this role. A tenant's account is created by their landlord, who reads the
 * temporary password before handing it over, so the landlord is the one party who could act as the
 * tenant before the tenant has replaced it — including confirming a repair was fixed, which is the
 * one piece of evidence the tenant holds in a dispute.
 */
export async function requireTenantProfile(): Promise<SignedInProfile> {
  const profile = await getSignedInProfile();
  if (profile.role !== "tenant") {
    throw new RoleMismatchError("tenant", profile.role);
  }
  if (profile.mustChangePassword) {
    throw new PasswordChangeRequiredError();
  }
  return profile;
}
