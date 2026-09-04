import "server-only";

import {
  PasswordChangeRequiredError,
  RoleMismatchError,
} from "@/lib/authentication/authenticationErrors";
import { getSignedInProfile, type SignedInProfile } from "@/lib/authentication/getSignedInProfile";

/**
 * The acting user, refused unless they are a landlord. Used by the landlord area and its actions.
 *
 * The password check below is defence in depth, and what it does and does not change was measured
 * rather than assumed.
 *
 * The proxy already routes a flagged account to the change-password page and nowhere else, and a
 * server action posted to any other route was found to be refused as well. That second refusal is
 * not this application's doing: Next re-enters the proxy against the route the action *belongs to*
 * rather than the one the request was posted to, so the routing rule catches it again. Measured on
 * Next 16.3.2 against both tenant actions, posted to every route they could be posted to.
 *
 * So this check closes no hole that is open today. What it changes is who owns the guarantee.
 * Nothing in this codebase asserted that framework behaviour, no test covered it, and Next's own
 * guidance is that an action is a POST reachable by anyone who can send it. With this check the rule
 * is the application's own and survives an upgrade that moves where middleware runs.
 *
 * It is deliberately not in `getSignedInProfile`: `changePassword` resolves identity there and has
 * to keep working for exactly the accounts this refuses.
 */
export async function requireLandlordProfile(): Promise<SignedInProfile> {
  const profile = await getSignedInProfile();
  if (profile.role !== "landlord") {
    throw new RoleMismatchError("landlord", profile.role);
  }
  if (profile.mustChangePassword) {
    throw new PasswordChangeRequiredError();
  }
  return profile;
}
