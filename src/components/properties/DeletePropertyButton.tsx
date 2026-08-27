"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProperty } from "@/actions/propertyActions";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";

/**
 * Deleting a building, in two steps, with the consequence written out before the second one.
 *
 * The consequence is real and specific rather than a general warning: how many units go with it. A
 * building whose units have ever been let cannot be deleted at all, and the action says so by
 * naming the number of tenancies in the way.
 */
export function DeletePropertyButton({
  propertyId,
  unitCount,
}: {
  propertyId: string;
  unitCount: number;
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
          Delete this property
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card space-y-3 rounded-md border border-destructive/40 p-4">
      <FormErrorSummary message={failureMessage} />
      <p className="text-sm">
        Deleting this property also deletes {describeUnits(unitCount)}. If any of them has ever been
        let, nothing is deleted: the rent history belongs to those tenancies.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={() =>
            startDeleting(async () => {
              const result = await deleteProperty({ propertyId });
              if (result.status === "error") {
                setFailureMessage(result.message);
                setIsConfirming(false);
                return;
              }
              router.push("/landlord/properties");
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

function describeUnits(unitCount: number): string {
  if (unitCount === 0) {
    return "no units, because it has none";
  }
  return unitCount === 1 ? "its 1 unit" : `all ${unitCount} of its units`;
}
