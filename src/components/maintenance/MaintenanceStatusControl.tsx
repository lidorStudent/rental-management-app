"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateMaintenanceRequestStatus } from "@/actions/maintenanceRequestActions";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";
import {
  allowedNextStatuses,
  type MaintenanceStatus,
} from "@/lib/maintenance/allowedStatusTransitions";

/**
 * Moving a reported problem along.
 *
 * The buttons are built from allowedStatusTransitions, the same constant the server action checks
 * against, so an illegal move is not something the interface can express: there is no control for
 * it. The action refuses it as well, because a control that is not rendered is not a rule.
 */
const STATUS_ACTIONS: Record<MaintenanceStatus, string> = {
  submitted: "Move back to reported",
  acknowledged: "Acknowledge it",
  in_progress: "Start work",
  resolved: "Mark it resolved",
};

export function MaintenanceStatusControl({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: MaintenanceStatus;
}) {
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const nextStatuses = allowedNextStatuses(currentStatus);

  return (
    <div className="space-y-3">
      <FormErrorSummary message={failureMessage} />

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((nextStatus) => (
          <Button
            key={nextStatus}
            type="button"
            variant={nextStatus === "resolved" ? "default" : "outline"}
            disabled={isSaving}
            onClick={() =>
              startSaving(async () => {
                setFailureMessage(null);
                const result = await updateMaintenanceRequestStatus({ requestId, nextStatus });
                if (result.status === "error") {
                  setFailureMessage(result.message);
                  return;
                }
                router.refresh();
              })
            }
          >
            {STATUS_ACTIONS[nextStatus]}
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        {currentStatus === "resolved"
          ? "A resolved request can be reopened if the problem comes back. It cannot go back to reported: it has already been seen."
          : "Work can be skipped ahead of, but nothing goes back to reported."}
      </p>
    </div>
  );
}
