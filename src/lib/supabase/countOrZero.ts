/**
 * A Supabase count, as a number.
 *
 * `select("id", { count: "exact", head: true })` returns `number | null`, and an aggregate column
 * read through a view can come back undefined when the view has no row for that key at all - a
 * landlord with no payments this month has no row in `rent_collected_by_month`. Both mean the same
 * thing here, which is that nothing was counted, and nothing counted is zero.
 *
 * This existed twice, as `countOrZero` in the lease actions and `orZero` on the dashboard.
 */
export function countOrZero(count: number | null | undefined): number {
  return count ?? 0;
}
