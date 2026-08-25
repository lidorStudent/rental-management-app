import { RentStatusBadge } from "@/components/leases/RentStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/classNames";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import type { RentPeriodWithStatus } from "@/lib/rent/buildRentSchedule";

/**
 * One row per rent period of a tenancy: what was charged, what arrived, what is left, and the status
 * that follows from those three and today's date.
 *
 * The outstanding amount is shown as a figure rather than only as a word, because "part paid" tells
 * a landlord nothing they can chase. A period in credit shows the surplus.
 *
 * Nothing here decides anything. The periods and their statuses are computed before they arrive.
 */
export function RentScheduleTable({ periods }: { periods: readonly RentPeriodWithStatus[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <caption className="sr-only">Rent periods for this tenancy</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Rent</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.map((period) => (
            <TableRow
              key={period.periodMonth}
              className={cn(period.status === "overdue" && "bg-red-50/60")}
            >
              <TableCell className="font-medium">{period.periodMonth.slice(0, 7)}</TableCell>
              <TableCell>{period.dueDate}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCentsAsCurrency(period.amountDueInAgorot)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCentsAsCurrency(period.amountPaidInAgorot)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {describeOutstanding(period.outstandingInAgorot)}
              </TableCell>
              <TableCell>
                <RentStatusBadge status={period.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function describeOutstanding(outstandingInAgorot: number): string {
  if (outstandingInAgorot === 0) {
    return "";
  }
  if (outstandingInAgorot < 0) {
    return `${formatCentsAsCurrency(-outstandingInAgorot)} in credit`;
  }
  return formatCentsAsCurrency(outstandingInAgorot);
}
