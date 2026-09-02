import Link from "next/link";

import { LogoMark } from "@/components/shared/LogoMark";

/**
 * The mark and the product name as one link back to the signed-in user's own home.
 *
 * The whole artwork, at 32 pixels, and not a crop of it. The header carried a cropped fragment for
 * a while, because the artwork is portrait and a 24 pixel row leaves it only 14 pixels of width.
 * The fragment had clean strokes and still failed: the artwork encloses no space anywhere - every
 * stroke is an open outline, and the building is a gestalt of two overlapping open forms - so every
 * crop of it reads as an unfinished outline rather than as a mark. Only the whole artwork reads as
 * finished, and it needs 32 pixels, which costs four pixels of header height at 768 and at 390.
 *
 * One link, so it is one focus stop with one accessible name. The mark is decorative: the name it
 * would carry is the text sitting beside it, and announcing "Rentbook" twice helps nobody.
 */
export function LogoWordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <LogoMark className="h-8 flex-none" decorative />
      Rentbook
    </Link>
  );
}
