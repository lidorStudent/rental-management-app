import { describe, expect, it } from "vitest";

import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";

describe("formatCentsAsCurrency", () => {
  it("writes an amount the way a person reads it", () => {
    expect(formatCentsAsCurrency(650050)).toBe("₪6,500.50");
  });

  it("always shows both agora digits", () => {
    expect(formatCentsAsCurrency(650000)).toBe("₪6,500.00");
    expect(formatCentsAsCurrency(650005)).toBe("₪6,500.05");
  });

  it("groups thousands", () => {
    expect(formatCentsAsCurrency(123456789)).toBe("₪1,234,567.89");
  });

  it("writes small amounts without a group separator", () => {
    expect(formatCentsAsCurrency(500)).toBe("₪5.00");
    expect(formatCentsAsCurrency(0)).toBe("₪0.00");
  });

  it("writes a negative amount with the sign in front", () => {
    expect(formatCentsAsCurrency(-650050)).toBe("-₪6,500.50");
  });

  it("refuses an amount that is not whole agorot", () => {
    expect(() => formatCentsAsCurrency(650050.5)).toThrow(/whole agorot/);
  });
});
