/**
 * The arithmetic behind a page of rows, kept in one pure function so that the numbers shown to the
 * reader and the range asked of the database cannot disagree.
 *
 * `rangeStartIndex` and `rangeEndIndex` are zero-based and inclusive, which is what Supabase's
 * `.range()` expects. The row numbers are one-based, which is what a person expects.
 */

export type PageDescription = {
  page: number;
  totalPages: number;
  firstRowNumber: number;
  lastRowNumber: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  rangeStartIndex: number;
  rangeEndIndex: number;
};

/**
 * The zero-based inclusive row range a page covers, which is what a query needs before anything is
 * known about how many rows there are in total.
 */
export function pageRange({ page, pageSize }: { page: number; pageSize: number }): {
  startIndex: number;
  endIndex: number;
} {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`A page number starts at 1, and this one is ${page}.`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`A page holds at least one row, and this one holds ${pageSize}.`);
  }

  const startIndex = (page - 1) * pageSize;
  return { startIndex, endIndex: startIndex + pageSize - 1 };
}

export function describePage({
  page,
  pageSize,
  totalCount,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
}): PageDescription {
  if (!Number.isInteger(totalCount) || totalCount < 0) {
    throw new Error(`A total cannot be negative, and this one is ${totalCount}.`);
  }

  const { startIndex: rangeStartIndex, endIndex: rangeEndIndex } = pageRange({ page, pageSize });
  // An empty list still has one page: the one saying there is nothing here.
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const rowsOnThisPage = Math.max(0, Math.min(pageSize, totalCount - rangeStartIndex));

  return {
    page,
    totalPages,
    firstRowNumber: rowsOnThisPage === 0 ? 0 : rangeStartIndex + 1,
    lastRowNumber: rangeStartIndex + rowsOnThisPage,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    rangeStartIndex,
    rangeEndIndex,
  };
}
