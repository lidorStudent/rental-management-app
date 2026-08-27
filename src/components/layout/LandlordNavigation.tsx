"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/layout/SignOutButton";
import { cn } from "@/lib/classNames";

/**
 * The landlord's four places: what needs attention, the buildings, the tenancies, the problems.
 *
 * A client component only because it reads the current path to mark where the reader is. It fetches
 * nothing; the name it shows is passed in by the layout, which read it on the server.
 */
const LANDLORD_LINKS = [
  { href: "/landlord", label: "Dashboard" },
  { href: "/landlord/properties", label: "Properties" },
  { href: "/landlord/leases", label: "Leases" },
  { href: "/landlord/rent", label: "Rent" },
  { href: "/landlord/maintenance", label: "Maintenance" },
];

export function LandlordNavigation({ signedInAs }: { signedInAs: string }) {
  const currentPath = usePathname();

  return (
    <header className="bg-card border-b print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/landlord" className="text-sm font-semibold tracking-tight">
          Rental Management
        </Link>

        <nav aria-label="Landlord" className="flex min-w-0 flex-wrap items-center gap-1">
          {LANDLORD_LINKS.map((link) => (
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
          <span className="text-sm text-muted-foreground">{signedInAs}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

/** The dashboard is only current on the dashboard; the others cover everything beneath them. */
function isCurrent(currentPath: string, href: string): boolean {
  if (href === "/landlord") {
    return currentPath === "/landlord";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
