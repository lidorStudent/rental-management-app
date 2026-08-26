import Link from "next/link";

import type { LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";

/**
 * The three things a landlord can do to a tenancy. Ending it is not offered once it has ended, and
 * a tenancy is never edited: it is ended or renewed.
 */
export function LeaseActionLinks({
  leaseId,
  lifecycle,
}: {
  leaseId: string;
  lifecycle: LeaseLifecycle;
}) {
  return (
    <>
      {lifecycle === "ended" ? null : (
        <ActionLink href={`/landlord/leases/${leaseId}/end`} label="End early" />
      )}
      <ActionLink href={`/landlord/leases/${leaseId}/statement`} label="Statement" />
      <ActionLink href={`/landlord/leases/${leaseId}/renew`} label="Renew" />
    </>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
    >
      {label}
    </Link>
  );
}
