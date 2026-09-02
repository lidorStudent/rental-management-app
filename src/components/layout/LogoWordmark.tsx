import Link from "next/link";

/**
 * The mark and the product name as one link back to the signed-in user's own home.
 *
 * The mark here is one of the artwork's two shapes, not the whole of it. The artwork is two
 * separate closed forms, and this is the upper one, taken whole. The whole artwork is portrait, so a
 * header 24 pixels tall leaves it 14 pixels of width and its busiest scanline crosses five strokes
 * inside those 14 pixels; they merge into a smudge. The upper form alone gets 21 pixels of width for
 * two strokes. Carrying the whole artwork here instead would mean a 40 pixel header row, costing 12
 * pixels of height at 390, and it would still read worse than this does.
 *
 * One link, so it is one focus stop with one accessible name. The mark is decorative: the name it
 * would carry is the text sitting next to it, and a screen reader announcing "Rentbook"
 * twice is worse than a picture nobody mentions.
 *
 * No print rule, unlike `LogoMark`. Both headers carry `print:hidden`, so this never reaches paper.
 */
const HEADER_MASK: React.CSSProperties = {
  WebkitMaskImage: "url(/logo-header-mark.png)",
  maskImage: "url(/logo-header-mark.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

export function LogoWordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <span
        aria-hidden="true"
        style={HEADER_MASK}
        className="bg-foreground block h-6 flex-none aspect-[221/256]"
      />
      Rentbook
    </Link>
  );
}
