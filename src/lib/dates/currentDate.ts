import "server-only";

import type { IsoDate } from "@/lib/dates/isoDate";

/**
 * The only place in the server code that asks what day it is.
 *
 * Every business rule takes the current date as an argument, so that it can be asked about any day
 * and so that a test run tomorrow gives the same answer as one today. That promise needs somewhere
 * for the real answer to come from, and this is it: the edge of the system, called by actions, never
 * by rules.
 *
 * UTC, deliberately. A lease and its ledger must read the same way for the landlord and the tenant
 * wherever either of them is, so there is exactly one definition of "today" in the product.
 */
export function currentIsoDateInUtc(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

/** The current instant, for the timestamp columns. Also UTC, for the same reason. */
export function currentTimestampInUtc(): string {
  return new Date().toISOString();
}
