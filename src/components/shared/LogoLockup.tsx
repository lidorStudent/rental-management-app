import { LogoMark } from "@/components/shared/LogoMark";

/**
 * The mark above the product name, for the three pages that have no navigation around them.
 *
 * The name is set at the size the headers use for the same words rather than at the page-title size,
 * so it reads as part of the mark rather than as a second heading arguing with the real one below
 * it. The mark is decorative here for the same reason it is decorative in the header: the name is
 * sitting underneath it in text, and announcing it twice helps nobody.
 */
export function LogoLockup() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 pb-2">
      <LogoMark className="h-12" decorative />
      <span className="text-sm font-semibold tracking-tight">Rentbook</span>
    </div>
  );
}
