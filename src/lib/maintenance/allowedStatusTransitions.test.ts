import { describe, expect, it } from "vitest";

import {
  ALLOWED_MAINTENANCE_STATUS_TRANSITIONS,
  allowedNextStatuses,
  isAllowedMaintenanceStatusTransition,
  resolvedAtForStatus,
  type MaintenanceStatus,
} from "@/lib/maintenance/allowedStatusTransitions";

const EVERY_STATUS: MaintenanceStatus[] = ["submitted", "acknowledged", "in_progress", "resolved"];

const LEGAL_MOVES: [MaintenanceStatus, MaintenanceStatus][] = [
  ["submitted", "acknowledged"],
  ["submitted", "in_progress"],
  ["submitted", "resolved"],
  ["acknowledged", "in_progress"],
  ["acknowledged", "resolved"],
  ["in_progress", "resolved"],
  ["resolved", "in_progress"],
];

describe("isAllowedMaintenanceStatusTransition", () => {
  it.each(LEGAL_MOVES)("allows a request to move from %s to %s", (from, to) => {
    expect(isAllowedMaintenanceStatusTransition(from, to)).toBe(true);
  });

  /**
   * PROC-18. Every pair of statuses is asked about, so a move that is legal by accident cannot hide:
   * anything not in the list above must be refused.
   */
  it("refuses every move that is not one of the seven allowed", () => {
    const refused: string[] = [];

    for (const from of EVERY_STATUS) {
      for (const to of EVERY_STATUS) {
        const isListed = LEGAL_MOVES.some(
          ([legalFrom, legalTo]) => legalFrom === from && legalTo === to,
        );
        if (!isListed && isAllowedMaintenanceStatusTransition(from, to)) {
          refused.push(`${from} to ${to}`);
        }
      }
    }

    expect(refused).toEqual([]);
  });

  it("refuses a move to the status a request already has", () => {
    for (const status of EVERY_STATUS) {
      expect(isAllowedMaintenanceStatusTransition(status, status)).toBe(false);
    }
  });

  it("refuses a move back to reported, because a request that has been seen cannot become unseen", () => {
    expect(isAllowedMaintenanceStatusTransition("acknowledged", "submitted")).toBe(false);
    expect(isAllowedMaintenanceStatusTransition("in_progress", "submitted")).toBe(false);
    expect(isAllowedMaintenanceStatusTransition("resolved", "submitted")).toBe(false);
  });

  it("refuses a resolved request going back to acknowledged rather than to work", () => {
    expect(isAllowedMaintenanceStatusTransition("resolved", "acknowledged")).toBe(false);
  });
});

describe("allowedNextStatuses", () => {
  it("offers exactly what the transition map allows, so the buttons cannot disagree with the rule", () => {
    for (const status of EVERY_STATUS) {
      expect(allowedNextStatuses(status)).toEqual(ALLOWED_MAINTENANCE_STATUS_TRANSITIONS[status]);
    }
  });

  it("offers only resolving once work has started", () => {
    expect(allowedNextStatuses("in_progress")).toEqual(["resolved"]);
  });

  it("offers only reopening once a request is resolved", () => {
    expect(allowedNextStatuses("resolved")).toEqual(["in_progress"]);
  });
});

describe("resolvedAtForStatus", () => {
  const moment = "2026-03-10T09:00:00.000Z";

  it("stamps the moment a request is resolved", () => {
    expect(resolvedAtForStatus("resolved", moment)).toBe(moment);
  });

  it("clears the resolution date for every other status, so reopening leaves none behind", () => {
    expect(resolvedAtForStatus("in_progress", moment)).toBeNull();
    expect(resolvedAtForStatus("acknowledged", moment)).toBeNull();
    expect(resolvedAtForStatus("submitted", moment)).toBeNull();
  });
});
