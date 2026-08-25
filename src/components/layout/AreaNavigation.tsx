import Link from "next/link";

import { SignOutButton } from "@/components/layout/SignOutButton";

/** The bar at the top of both signed-in areas. Identical in structure so both read the same. */
export function AreaNavigation({
  areaLabel,
  signedInAs,
}: {
  areaLabel: string;
  signedInAs: string;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-medium">
          Rental Management
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {areaLabel}: {signedInAs}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
