"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteUnit } from "@/actions/unitActions";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";

/** Deleting a unit, in the same two steps as deleting a property. */
export function DeleteUnitButton({
  unitId,
  propertyId,
  leaseCount,
}: {
  unitId: string;
  propertyId: string;
  leaseCount: number;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  if (!isConfirming) {
    return (
      <div className="space-y-2">
        <FormErrorSummary message={failureMessage} />
        <Button type="button" variant="outline" onClick={() => setIsConfirming(true)}>
          Delete this unit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-destructive/40 p-4">
      <FormErrorSummary message={failureMessage} />
      <p className="text-sm">
        {leaseCount === 0
          ? "This unit has never been let, so deleting it removes nothing else."
          : `This unit has ${leaseCount === 1 ? "1 tenancy" : `${leaseCount} tenancies`} recorded against it, so it cannot be deleted. The rent history and the reported problems belong to them.`}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting || leaseCount > 0}
          onClick={() =>
            startDeleting(async () => {
              const result = await deleteUnit({ unitId });
              if (result.status === "error") {
                setFailureMessage(result.message);
                setIsConfirming(false);
                return;
              }
              router.push(`/landlord/properties/${propertyId}`);
            })
          }
        >
          {isDeleting ? "Deleting..." : "Yes, delete it"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIsConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
