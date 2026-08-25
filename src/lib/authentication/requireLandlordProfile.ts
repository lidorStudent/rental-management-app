import "server-only";

import { RoleMismatchError } from "@/lib/authentication/authenticationErrors";
import { getSignedInProfile, type SignedInProfile } from "@/lib/authentication/getSignedInProfile";

/** The acting user, refused unless they are a landlord. Used by the landlord area and its actions. */
export async function requireLandlordProfile(): Promise<SignedInProfile> {
  const profile = await getSignedInProfile();
  if (profile.role !== "landlord") {
    throw new RoleMismatchError("landlord", profile.role);
  }
  return profile;
}
