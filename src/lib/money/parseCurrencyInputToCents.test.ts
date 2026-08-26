import { describe, expect, it } from "vitest";

import { parseCurrencyInputToCents } from "@/lib/money/parseCurrencyInputToCents";

describe("parseCurrencyInputToCents", () => {
  it("reads a whole number of shekels", () => {
    expect(parseCurrencyInputToCents("6500")).toBe(650000);
  });

  it("reads shekels and agorot", () => {
    expect(parseCurrencyInputToCents("6500.50")).toBe(650050);
  });

  it("reads a single decimal place as tens of agorot", () => {
    expect(parseCurrencyInputToCents("6500.1")).toBe(650010);
  });

  it("ignores the separators people write amounts with", () => {
    expect(parseCurrencyInputToCents("6,500.50")).toBe(650050);
    expect(parseCurrencyInputToCents(" 6 500 ")).toBe(650000);
  });

  /**
   * The reason this exists rather than multiplying by a hundred: 6500.10 * 100 is
   * 650009.9999999999 in floating point, and a ledger out by an agora is one a tenant can argue
   * with.
   */
  it("is exact for amounts floating point gets wrong", () => {
    expect(parseCurrencyInputToCents("6500.10")).toBe(650010);
    expect(parseCurrencyInputToCents("1.10")).toBe(110);
    expect(parseCurrencyInputToCents("0.29")).toBe(29);
  });

  it("reads zero", () => {
    expect(parseCurrencyInputToCents("0")).toBe(0);
  });

  it("reads a negative amount, leaving the rule about whether one is allowed to the schema", () => {
    expect(parseCurrencyInputToCents("-500")).toBe(-50000);
  });

  it("refuses more precision than money has", () => {
    expect(parseCurrencyInputToCents("1.005")).toBeNull();
  });

  it("refuses text that is not an amount", () => {
    expect(parseCurrencyInputToCents("abc")).toBeNull();
    expect(parseCurrencyInputToCents("")).toBeNull();
    expect(parseCurrencyInputToCents("6500ils")).toBeNull();
    expect(parseCurrencyInputToCents(".")).toBeNull();
  });

  it("refuses an amount too large to hold exactly", () => {
    expect(parseCurrencyInputToCents("999999999999999999")).toBeNull();
  });
});
