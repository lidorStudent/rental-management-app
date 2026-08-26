import { describe, expect, it } from "vitest";

import { addDays, isFirstDayOfMonth, isValidIsoDate, nextDay } from "@/lib/dates/isoDate";

describe("isValidIsoDate", () => {
  it("accepts an ordinary date", () => {
    expect(isValidIsoDate("2026-03-15")).toBe(true);
  });

  it("accepts the 29th of February in a leap year", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });

  it("refuses the 29th of February in a year that has none", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
  });

  it("refuses a day the calendar does not have", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-04-31")).toBe(false);
  });

  it("refuses a month the calendar does not have", () => {
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-01")).toBe(false);
  });

  it("refuses anything that is not written as YYYY-MM-DD", () => {
    expect(isValidIsoDate("15/03/2026")).toBe(false);
    expect(isValidIsoDate("2026-3-15")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("tomorrow")).toBe(false);
  });
});

describe("isFirstDayOfMonth", () => {
  it("accepts the first of a month", () => {
    expect(isFirstDayOfMonth("2026-03-01")).toBe(true);
  });

  it("refuses any other day", () => {
    expect(isFirstDayOfMonth("2026-03-02")).toBe(false);
  });

  it("refuses a first that is not a real date", () => {
    expect(isFirstDayOfMonth("2026-13-01")).toBe(false);
  });
});

describe("nextDay", () => {
  it("moves to the next day", () => {
    expect(nextDay("2026-03-15")).toBe("2026-03-16");
  });

  it("crosses a month boundary", () => {
    expect(nextDay("2026-05-31")).toBe("2026-06-01");
  });

  it("crosses a year boundary", () => {
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("knows February has 29 days in a leap year", () => {
    expect(nextDay("2024-02-28")).toBe("2024-02-29");
  });

  it("knows February has 28 days otherwise", () => {
    expect(nextDay("2026-02-28")).toBe("2026-03-01");
  });
});

describe("addDays", () => {
  it("counts forward across months", () => {
    expect(addDays("2026-08-25", 60)).toBe("2026-10-24");
  });

  it("counts backward", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("stays put when asked for no days", () => {
    expect(addDays("2026-03-15", 0)).toBe("2026-03-15");
  });

  it("refuses a fraction of a day", () => {
    expect(() => addDays("2026-03-15", 1.5)).toThrow(/whole/);
  });
});
