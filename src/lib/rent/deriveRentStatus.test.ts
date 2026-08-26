import { describe, expect, it } from "vitest";

import { deriveRentStatus } from "@/lib/rent/deriveRentStatus";

/**
 * Domain invariant 2. The order the four statuses are decided in is the rule, so each is asked for
 * on the days either side of the one that decides it.
 */
const RENT = 650000;
const DUE_DATE = "2026-03-10";

function statusOn(currentDate: string, amountPaidInAgorot: number) {
  return deriveRentStatus({
    amountDueInAgorot: RENT,
    amountPaidInAgorot,
    dueDate: DUE_DATE,
    currentDate,
  });
}

describe("deriveRentStatus", () => {
  // PROC-06
  it("reads as due when nothing has been paid and the due date is still ahead", () => {
    expect(statusOn("2026-03-01", 0)).toBe("due");
  });

  it("still reads as due on the due date itself", () => {
    expect(statusOn("2026-03-10", 0)).toBe("due");
  });

  // PROC-09: the day the product exists for.
  it("reads as overdue on the day after the due date", () => {
    expect(statusOn("2026-03-11", 0)).toBe("overdue");
  });

  // PROC-07, EDGE-04
  it("reads as part paid when something has arrived and the due date is still ahead", () => {
    expect(statusOn("2026-03-01", 250000)).toBe("partial");
  });

  it("still reads as part paid on the due date itself", () => {
    expect(statusOn("2026-03-10", 250000)).toBe("partial");
  });

  /**
   * PROC-10. A part paid month that is past its due date belongs in the chase list, so overdue
   * wins. How much is left is shown next to it, which is why the amount is not thrown away.
   */
  it("reads as overdue rather than part paid once the due date has passed", () => {
    expect(statusOn("2026-03-11", 250000)).toBe("overdue");
  });

  // PROC-08
  it("reads as paid when the payments cover the rent exactly", () => {
    expect(statusOn("2026-03-01", RENT)).toBe("paid");
  });

  it("still reads as paid long after the due date", () => {
    expect(statusOn("2027-01-01", RENT)).toBe("paid");
  });

  // PROC-15
  it("reads as paid when more than the rent has arrived", () => {
    expect(statusOn("2027-01-01", RENT + 100000)).toBe("paid");
  });

  it("reads as paid when one agora more than the rent has arrived", () => {
    expect(statusOn("2026-03-11", RENT + 1)).toBe("paid");
  });

  it("reads as overdue when one agora short after the due date", () => {
    expect(statusOn("2026-03-11", RENT - 1)).toBe("overdue");
  });

  it("refuses a period that charges nothing", () => {
    expect(() =>
      deriveRentStatus({
        amountDueInAgorot: 0,
        amountPaidInAgorot: 0,
        dueDate: DUE_DATE,
        currentDate: "2026-03-01",
      }),
    ).toThrow(/positive amount/);
  });

  it("refuses payments that total a negative amount", () => {
    expect(() => statusOn("2026-03-01", -1)).toThrow(/negative/);
  });

  it("refuses a due date that is not a real date", () => {
    expect(() =>
      deriveRentStatus({
        amountDueInAgorot: RENT,
        amountPaidInAgorot: 0,
        dueDate: "2026-02-30",
        currentDate: "2026-03-01",
      }),
    ).toThrow(/calendar date/);
  });
});
