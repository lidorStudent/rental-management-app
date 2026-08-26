import { describe, expect, it } from "vitest";

import { describePage, pageRange } from "@/lib/pagination/describePage";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";

describe("pageRange", () => {
  it("asks for the first rows on the first page", () => {
    expect(pageRange({ page: 1, pageSize: 20 })).toEqual({ startIndex: 0, endIndex: 19 });
  });

  it("skips a whole page for each page passed", () => {
    expect(pageRange({ page: 3, pageSize: 20 })).toEqual({ startIndex: 40, endIndex: 59 });
  });

  it("refuses a page number below one", () => {
    expect(() => pageRange({ page: 0, pageSize: 20 })).toThrow(/starts at 1/);
  });

  it("refuses a page that holds no rows", () => {
    expect(() => pageRange({ page: 1, pageSize: 0 })).toThrow(/at least one row/);
  });
});

describe("describePage", () => {
  it("counts the rows a full first page shows", () => {
    const page = describePage({ page: 1, pageSize: 20, totalCount: 57 });

    expect(page.firstRowNumber).toBe(1);
    expect(page.lastRowNumber).toBe(20);
    expect(page.totalPages).toBe(3);
    expect(page.hasPreviousPage).toBe(false);
    expect(page.hasNextPage).toBe(true);
  });

  it("counts the rows a part filled last page shows", () => {
    const page = describePage({ page: 3, pageSize: 20, totalCount: 57 });

    expect(page.firstRowNumber).toBe(41);
    expect(page.lastRowNumber).toBe(57);
    expect(page.hasNextPage).toBe(false);
    expect(page.hasPreviousPage).toBe(true);
  });

  it("treats an empty list as one page with nothing on it", () => {
    const page = describePage({ page: 1, pageSize: 20, totalCount: 0 });

    expect(page.totalPages).toBe(1);
    expect(page.firstRowNumber).toBe(0);
    expect(page.lastRowNumber).toBe(0);
    expect(page.hasNextPage).toBe(false);
  });

  it("counts a list that fills exactly one page", () => {
    const page = describePage({ page: 1, pageSize: 20, totalCount: 20 });

    expect(page.totalPages).toBe(1);
    expect(page.lastRowNumber).toBe(20);
    expect(page.hasNextPage).toBe(false);
  });

  it("reports no rows for a page beyond the end rather than a negative count", () => {
    const page = describePage({ page: 9, pageSize: 20, totalCount: 57 });

    expect(page.firstRowNumber).toBe(0);
    expect(page.lastRowNumber).toBe(160);
  });

  it("refuses a negative total", () => {
    expect(() => describePage({ page: 1, pageSize: 20, totalCount: -1 })).toThrow(/negative/);
  });
});

describe("parsePageNumber", () => {
  it("reads a page number", () => {
    expect(parsePageNumber("3")).toBe(3);
  });

  it("treats a missing page as the first", () => {
    expect(parsePageNumber(undefined)).toBe(1);
  });

  // EDGE-16: the URL is user input.
  it("treats anything that is not a page number as the first page", () => {
    expect(parsePageNumber("abc")).toBe(1);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("-3")).toBe(1);
    expect(parsePageNumber("1.5")).toBe(1);
    expect(parsePageNumber("")).toBe(1);
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(parsePageNumber(["2", "5"])).toBe(2);
  });
});
