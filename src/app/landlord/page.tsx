import { PageHeader } from "@/components/shared/PageHeader";
import { requireLandlordProfile } from "@/lib/authentication/requireLandlordProfile";

export default async function LandlordDashboardPage() {
  const profile = await requireLandlordProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${profile.email}. The attention panel, properties, leases and the rent ledger arrive in the phases that follow.`}
      />
    </div>
  );
}
