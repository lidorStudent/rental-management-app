/**
 * PostgREST refuses a range that starts past the last row, rather than returning nothing, and the
 * refusal carries no count with it. A reader who edits `?page=` in the address bar, or follows a
 * bookmark to a page that has since shrunk, would otherwise be told their list is empty when it is
 * not.
 *
 * The pages that use this send that reader back to the first page instead.
 */
const RANGE_NOT_SATISFIABLE = "PGRST103";

export function isPageBeyondTheEnd(error: { code?: string } | null): boolean {
  return error?.code === RANGE_NOT_SATISFIABLE;
}
