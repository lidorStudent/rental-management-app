/**
 * Turns a `?page=` value into a page number.
 *
 * The value arrives from the URL, so it can be anything at all: absent, "0", "-3", "two", or an
 * array when the parameter is repeated. None of those is worth an error page, and all of them mean
 * the same thing to a reader, so they resolve to the first page.
 */
export function parsePageNumber(value: string | string[] | undefined): number {
  const single = Array.isArray(value) ? value[0] : value;
  if (single === undefined) {
    return 1;
  }

  const parsed = Number(single);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}
