import type { Database } from "@/types/database";

export type MaintenanceStatus = Database["public"]["Enums"]["maintenance_status"];

/**
 * The only route a maintenance request may take through its statuses.
 *
 * One constant, read by both sides: the control renders exactly the transitions listed here, and
 * the server action refuses anything not listed here. That is what stops the buttons and the rules
 * drifting apart, which is the usual way a status machine ends up with a state nobody designed.
 *
 * Work can be skipped ahead of, because a landlord who fixes a tap the same hour should not have to
 * click through acknowledged and in progress to say so. It cannot be walked backwards to submitted,
 * because a request that has been seen cannot become unseen. Resolved reopens to in progress, since
 * a problem that comes back was never finished.
 */
export const ALLOWED_MAINTENANCE_STATUS_TRANSITIONS: Readonly<
  Record<MaintenanceStatus, readonly MaintenanceStatus[]>
> = {
  submitted: ["acknowledged", "in_progress", "resolved"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["in_progress"],
};

/**
 * Whether a request may move from one status to another. Moving to the status it already has is
 * refused: it is not a change, and treating it as one would write a new resolution date over an
 * existing one.
 */
export function isAllowedMaintenanceStatusTransition(
  currentStatus: MaintenanceStatus,
  nextStatus: MaintenanceStatus,
): boolean {
  return ALLOWED_MAINTENANCE_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

/** The transitions a landlord may be offered from where a request currently is. */
export function allowedNextStatuses(
  currentStatus: MaintenanceStatus,
): readonly MaintenanceStatus[] {
  return ALLOWED_MAINTENANCE_STATUS_TRANSITIONS[currentStatus];
}

/**
 * The resolution date that goes with a status, given the moment the change is being made.
 *
 * "Resolved" and "has a resolution date" are the same fact, and the database enforces that with a
 * check constraint. This is the same rule on the way in, so reopening a request clears the date
 * rather than leaving a resolution date on a request that is open again.
 */
export function resolvedAtForStatus(
  nextStatus: MaintenanceStatus,
  currentTimestamp: string,
): string | null {
  return nextStatus === "resolved" ? currentTimestamp : null;
}
