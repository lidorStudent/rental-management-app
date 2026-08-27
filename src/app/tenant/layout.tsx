import type { ReactNode } from "react";

import { TenantNavigation } from "@/components/layout/TenantNavigation";
import { requireTenantProfile } from "@/lib/authentication/requireTenantProfile";

/** The role check for everything under /tenant, on the server. See the landlord layout. */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const profile = await requireTenantProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TenantNavigation signedInAs={profile.fullName} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
