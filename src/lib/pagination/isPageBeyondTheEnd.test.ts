import { describe, expect, it } from "vitest";

import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";

/**
 * The one error every paged list has to recognise. PostgREST answers a range that starts past the
 * last row with PGRST103 rather than with an empty page, so a list that does not tell this apart
 * from "no rows" shows an empty state to a reader whose list is not empty.
 */
describe("isPageBeyondTheEnd", () => {
  it("recognises PostgREST's refusal of a range past the last row", () => {
    expect(isPageBeyondTheEnd({ code: "PGRST103" })).toBe(true);
  });

  it("says no when the query simply succeeded", () => {
    expect(isPageBeyondTheEnd(null)).toBe(false);
  });

  /**
   * Any other failure has to reach the page as a failure. Treating every error as "go back to page
   * one" would turn an unreachable database into a redirect loop.
   */
  it("does not mistake a different failure for a stale page number", () => {
    expect(isPageBeyondTheEnd({ code: "42501" })).toBe(false);
    expect(isPageBeyondTheEnd({ code: "PGRST301" })).toBe(false);
    expect(isPageBeyondTheEnd({})).toBe(false);
  });
});
