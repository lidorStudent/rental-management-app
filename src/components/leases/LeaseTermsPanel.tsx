import { DetailRow } from "@/components/shared/DetailRow";

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
      <DetailRow isNumeric label="Runs from" value={lease.startDate} />
      <DetailRow isNumeric label="Until, inclusive" value={lease.endDate} />
      <DetailRow
        isNumeric
        label="Monthly rent"
        value={formatCentsAsCurrency(lease.rentAmountInAgorot)}
      />
      <DetailRow isNumeric label="Rent due" value={`Day ${lease.rentDueDay} of each month`} />
      <DetailRow
        isNumeric
        label="Deposit"
        value={
          lease.depositAmountInAgorot === 0
            ? "None recorded"
            : formatCentsAsCurrency(lease.depositAmountInAgorot)
        }
      />
      <DetailRow
        isNumeric
        label="Unit"
        value={lease.unitLabel}
        href={`/landlord/properties/${lease.propertyId}`}
      />
    </dl>
  );
}
