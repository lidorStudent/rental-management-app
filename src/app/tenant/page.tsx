import { PageHeader } from "@/components/shared/PageHeader";
import { requireTenantProfile } from "@/lib/authentication/requireTenantProfile";

export default async function TenantPortalPage() {
  const profile = await requireTenantProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your tenancy"
        description={`Signed in as ${profile.email}. Your rent status, lease terms and maintenance requests arrive in the phases that follow.`}
      />
    </div>
  );
}
