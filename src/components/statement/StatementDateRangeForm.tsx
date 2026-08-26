import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { monthInputValue } from "@/lib/rent/statementPeriodRange";
import type { StatementRange } from "@/lib/rent/statementPeriodRange";

/**
 * An ordinary GET form, so the chosen range lands in the URL and the server renders the statement
 * for it. No client component, no state, and a statement for a particular range can be linked to or
 * bookmarked.
 */
export function StatementDateRangeForm({
  action,
  range,
}: {
  action: string;
  range: StatementRange;
}) {
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-md border p-4 print:hidden"
    >
      <div className="space-y-1.5">
        <Label htmlFor="from">From month</Label>
        <input
          id="from"
          name="from"
          type="month"
          defaultValue={monthInputValue(range.fromMonth)}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="to">To month</Label>
        <input
          id="to"
          name="to"
          type="month"
          defaultValue={monthInputValue(range.toMonth)}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        />
      </div>

      <Button type="submit" variant="outline">
        Show this range
      </Button>
    </form>
  );
}
