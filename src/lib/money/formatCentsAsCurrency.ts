/**
 * An amount of agorot as a person reads it: ₪6,500.50.
 *
 * The formatting is written out rather than handed to Intl.NumberFormat, because a rent statement is
 * a document that a landlord, a tenant and possibly an accountant look at, and it has to read the
 * same way on every machine. Intl's output depends on the locale the runtime happens to have.
 */
const SHEKEL_SIGN = "₪";

export function formatCentsAsCurrency(amountInAgorot: number): string {
  if (!Number.isInteger(amountInAgorot)) {
    throw new Error(`Money is held as whole agorot, and this amount is ${amountInAgorot}.`);
  }

  const isNegative = amountInAgorot < 0;
  const absolute = Math.abs(amountInAgorot);
  const shekels = Math.floor(absolute / 100);
  const agorot = absolute % 100;

  const grouped = String(shekels).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = `${SHEKEL_SIGN}${grouped}.${String(agorot).padStart(2, "0")}`;

  return isNegative ? `-${formatted}` : formatted;
}
