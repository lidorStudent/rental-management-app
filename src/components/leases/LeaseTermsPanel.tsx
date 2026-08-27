import Link from "next/link";

import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";

/**
 * What was agreed, as a plain list of facts. Both endpoint dates are labelled explicitly, because
 * the end date belonging to the tenant is the rule this product is most often asked about.
 */
export function LeaseTermsPanel({
  lease,
}: {
  lease: {
    startDate: string;
    endDate: string;
    rentAmountInAgorot: number;
    depositAmountInAgorot: number;
    rentDueDay: number;
    unitLabel: string;
    propertyId: string;
  };
}) {
  return (
    <dl className="bg-card divide-y rounded-md border text-sm">
      <Row label="Runs from" value={lease.startDate} />
      <Row label="Until, inclusive" value={lease.endDate} />
      <Row label="Monthly rent" value={formatCentsAsCurrency(lease.rentAmountInAgorot)} />
      <Row label="Rent due" value={`Day ${lease.rentDueDay} of each month`} />
      <Row
        label="Deposit"
        value={
          lease.depositAmountInAgorot === 0
            ? "None recorded"
            : formatCentsAsCurrency(lease.depositAmountInAgorot)
        }
      />
      <Row label="Unit" value={lease.unitLabel} href={`/landlord/properties/${lease.propertyId}`} />
    </dl>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">
        {href === undefined ? (
          value
        ) : (
          <Link href={href} className="underline">
            {value}
          </Link>
        )}
      </dd>
    </div>
  );
}
