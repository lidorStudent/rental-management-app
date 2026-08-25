import { redirect } from "next/navigation";

import { getSignedInProfile } from "@/lib/authentication/getSignedInProfile";
import { homePathForRole } from "@/lib/authentication/homePathForRole";

/**
 * There is no public landing page. Middleware sends a signed-out visitor to /login before this
 * renders; a signed-in one lands here only briefly, on the way to their own area.
 */
export default async function HomePage() {
  const profile = await getSignedInProfile();
  redirect(homePathForRole(profile.role));
}
