import { cn } from "@/lib/classNames";

/**
 * The logo, painted in the ink token rather than the pure black the artwork carries.
 *
 * It is a CSS mask over a background colour rather than an image element, because that is the only
 * way to recolour a black-on-transparent bitmap to a token: an `<img>` paints its own pixels and
 * nothing shows through it. Pure black appears nowhere else in this application, so shipping the
 * artwork as-is would put the one true black on the page next to text that is not.
 *
 * The mask reads `logo-mark.png`, a 150 by 256 copy of the 5000 by 8538 original. A mask `url()`
 * cannot go through next/image's optimiser - that only serves through an image element's srcset -
 * and the full-size original decodes to 163 MB of bitmap however small it is drawn. The copy decodes
 * to 150 KB and is sharp past 64 CSS pixels on a four-times display.
 *
 * A CSS mask is blocked over `file://`, so a page opened straight from disk renders this blank. That
 * is the protocol refusing to load the mask, not a fault in the mark. Serve it over http to see it.
 *
 * The artwork bleeds to both side edges with no margin of its own, so the padding on the wrapper at
 * each call site is doing real work rather than decorating.
 *
 * The measured legibility floor is about 40 pixels tall, so nothing here draws it smaller than 48.
 */
const MASK: React.CSSProperties = {
  WebkitMaskImage: "url(/logo-mark.png)",
  maskImage: "url(/logo-mark.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  // The mark is painted as a background colour, and browsers drop background graphics from print by
  // default. Without this the statement would print with a blank gap where the logo is.
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      // A masked span has no content of its own, so the accessible name has to be given. It reads
      // as the product rather than as "logo", because that is what the mark stands for on a page
      // where no wordmark sits beside it.
      role="img"
      aria-label="Rental Management"
      style={MASK}
      className={cn("bg-foreground block aspect-[150/256] print:bg-black", className)}
    />
  );
}
