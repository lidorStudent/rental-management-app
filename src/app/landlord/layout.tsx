import type { ReactNode } from "react";

import { LandlordNavigation } from "@/components/layout/LandlordNavigation";
import { requireLandlordProfile } from "@/lib/authentication/requireLandlordProfile";

/**
 * The role check for everything under /landlord, on the server. The proxy has already routed a
 * tenant away from here; this is the assertion that it did, and it runs even if the routing rules
 * are ever changed.
 *
 * The profile is read here once and handed to the navigation as a prop, so nothing below has to
 * fetch it again and nothing in the browser has to ask who is signed in.
 */
export default async function LandlordLayout({ children }: { children: ReactNode }) {
  const profile = await requireLandlordProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandlordNavigation signedInAs={profile.fullName} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
