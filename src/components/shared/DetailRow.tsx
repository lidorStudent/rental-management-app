import Link from "next/link";

import { cn } from "@/lib/classNames";

/**
 * One label-and-value line inside a detail panel's definition list.
 *
 * Four copies of this markup existed, in the lease terms panel, the two maintenance detail pages and
 * the tenant's lease page. They differed on two axes only: whether the value was a link, and whether
 * it carried `tabular-nums`. Both are properties of the value being shown rather than of the panel
 * showing it, so they are arguments here.
 *
 * `isNumeric` aligns figures in a column, which is worth having when a panel stacks amounts and
 * dates, and wrong for prose, where it makes the spacing look broken.
 */
export function DetailRow({
  label,
  value,
  href,
  isNumeric = false,
}: {
  label: string;
  value: string;
  href?: string;
  isNumeric?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", isNumeric && "tabular-nums")}>
        {href === undefined ? (
          value
        ) : (
          <Link href={href} className="underline">
            {value}
          </Link>
        )}
      </dd>
    </div>
  );
}
