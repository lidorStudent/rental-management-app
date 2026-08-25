import { homePathForRole } from "@/lib/authentication/homePathForRole";
import type { Database } from "@/types/database";

type UserRole = Database["public"]["Enums"]["user_role"];

export const PUBLIC_PATHS = ["/login", "/register"];
export const CHANGE_PASSWORD_PATH = "/change-password";

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path);
}

/**
 * Where a signed-in request should be sent instead of the path it asked for, or null when it may
 * carry on.
 *
 * It is a pure function of the path, the role and the password flag, with no request, cookies or
 * database in sight, so the routing rules can be read in one place and tested without a browser.
 */
export function redirectDestinationForSignedInUser(
  path: string,
  role: UserRole,
  mustChangePassword: boolean,
): string | null {
  // A tenant whose landlord created their account arrives with a temporary password. Until they
  // replace it, the only page they can reach is the one that replaces it.
  if (mustChangePassword) {
    return path === CHANGE_PASSWORD_PATH ? null : CHANGE_PASSWORD_PATH;
  }

  const homePath = homePathForRole(role);

  // There is no public landing page, and signing in again while already signed in is pointless.
  if (path === "/" || isPublicPath(path)) {
    return homePath;
  }

  const areaPrefix = role === "landlord" ? "/landlord" : "/tenant";
  const otherAreaPrefix = role === "landlord" ? "/tenant" : "/landlord";

  if (path.startsWith(otherAreaPrefix)) {
    return homePath;
  }
  if (path.startsWith(areaPrefix) || path === CHANGE_PASSWORD_PATH) {
    return null;
  }

  return null;
}
