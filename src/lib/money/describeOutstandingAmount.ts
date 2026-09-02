import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";

/**
 * An outstanding balance in words, including the case where it is negative.
 *
 * A tenant who has paid more than was charged has a negative outstanding, and rendering that as a
 * minus sign in front of an amount reads as a debt rather than as the opposite of one. It is called
 * a credit instead, with the sign removed, because that is the word a landlord and a tenant would
 * both use for it.
 *
 * Three copies of this rule existed, two of them identical. Whether a zero balance is shown as an
 * amount or left blank is a display decision that differs by screen, so it stays at the call site:
 * the rent schedule leaves it blank to keep a dense table quiet, and the summaries show the zero.
 */
export function describeOutstandingAmount(outstandingInAgorot: number): string {
  if (outstandingInAgorot < 0) {
    return `${formatCentsAsCurrency(-outstandingInAgorot)} in credit`;
  }
  return formatCentsAsCurrency(outstandingInAgorot);
}
