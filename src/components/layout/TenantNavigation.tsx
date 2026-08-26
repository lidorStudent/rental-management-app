"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/layout/SignOutButton";
import { cn } from "@/lib/classNames";

/**
 * The tenant's navigation is deliberately not the landlord's.
 *
 * Somebody who opens this three or four times a year, and has forgotten it exists in between, is
 * served by fewer words and a single row: their tenancy, what they have paid, and problems. There is
 * nothing to configure, so there is no settings link.
 */
const TENANT_LINKS = [
  { href: "/tenant", label: "Overview" },
  { href: "/tenant/lease", label: "Lease" },
  { href: "/tenant/payments", label: "Payments" },
  { href: "/tenant/maintenance", label: "Problems" },
];

export function TenantNavigation({ signedInAs }: { signedInAs: string }) {
  const currentPath = usePathname();

  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-2.5">
        <nav aria-label="Tenant" className="flex min-w-0 flex-wrap items-center gap-1">
          {TENANT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(currentPath, link.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                isCurrent(currentPath, link.href) && "bg-accent font-medium text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{signedInAs}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function isCurrent(currentPath: string, href: string): boolean {
  if (href === "/tenant") {
    return currentPath === "/tenant";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
