"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { confirmMaintenanceRequestResolved } from "@/actions/maintenanceRequestActions";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";

/**
 * The tenant agreeing that a resolved problem really was fixed.
 *
 * It is the only write a tenant has besides reporting one in the first place, and it reaches a
 * single column on a single row. The database enforces that as well, through a policy and a trigger.
 */
export function ConfirmResolutionButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isConfirming, startConfirming] = useTransition();

  return (
    <div className="space-y-2">
      <FormErrorSummary message={failureMessage} />
      <Button
        type="button"
        disabled={isConfirming}
        onClick={() =>
          startConfirming(async () => {
            setFailureMessage(null);
            const result = await confirmMaintenanceRequestResolved({ requestId });
            if (result.status === "error") {
              setFailureMessage(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        {isConfirming ? "Confirming..." : "Yes, this was fixed"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Your landlord has marked this resolved. Confirming records that you agree; if it is not
        fixed, tell them and they can reopen it.
      </p>
    </div>
  );
}
