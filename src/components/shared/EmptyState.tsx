import Link from "next/link";
import type { ReactNode } from "react";

/**
 * What a list shows when it has no rows. There is exactly one of these in the product, so no list
 * can end up as a blank area that leaves the reader wondering whether it is broken or empty.
 *
 * Every empty state names the next action, because the first hour with this product is a sequence
 * of them: no properties yet, then a property with no units, then a unit with no tenancy. That
 * action carries the accent, because on an empty screen it is the only thing to do and an outline
 * button reads as one option among several that are not there.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}): ReactNode {
  return (
    <div className="rounded-md border border-dashed px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action === undefined ? null : (
        <Link
          href={action.href}
          className="bg-primary text-primary-foreground hover:bg-primary/80 mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
