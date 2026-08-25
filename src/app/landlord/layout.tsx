import type { ReactNode } from "react";

import { AreaNavigation } from "@/components/layout/AreaNavigation";
import { requireLandlordProfile } from "@/lib/authentication/requireLandlordProfile";

/**
 * The role check for everything under /landlord, on the server. Middleware has already routed a
 * tenant away from here; this is the assertion that it did, and it runs even if middleware is ever
 * misconfigured.
 */
export default async function LandlordLayout({ children }: { children: ReactNode }) {
  const profile = await requireLandlordProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AreaNavigation areaLabel="Landlord" signedInAs={profile.fullName} />
      <div className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</div>
    </div>
  );
}
