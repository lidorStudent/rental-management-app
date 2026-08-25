import type { ReactNode } from "react";

import { AreaNavigation } from "@/components/layout/AreaNavigation";
import { requireTenantProfile } from "@/lib/authentication/requireTenantProfile";

/** The role check for everything under /tenant, on the server. See the landlord layout. */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const profile = await requireTenantProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AreaNavigation areaLabel="Tenant" signedInAs={profile.fullName} />
      <div className="mx-auto w-full max-w-3xl flex-1 p-6">{children}</div>
    </div>
  );
}
