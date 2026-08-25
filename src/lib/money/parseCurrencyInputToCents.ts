/**
 * Turns what a landlord types into the integer minor units the database stores.
 *
 * Amounts are never held as floating point. `6500.10 * 100` is 650009.9999999999 in JavaScript, and
 * a ledger that is out by an agora is a ledger nobody trusts. Parsing the digits as text and
 * assembling an integer avoids the question entirely.
 *
 * The parser only parses. Whether an amount is allowed to be zero or negative is a rule, and rules
 * live in the schemas that call this.
 */

const CURRENCY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** Returns the amount in minor units, or null when the text is not an amount. */
export function parseCurrencyInputToCents(input: string): number | null {
  // Thousands separators and spaces are how people write amounts; they carry no meaning.
  const withoutSeparators = input.trim().replace(/[\s,]/g, "");

  if (!CURRENCY_PATTERN.test(withoutSeparators)) {
    return null;
  }

  const isNegative = withoutSeparators.startsWith("-");
  const unsigned = isNegative ? withoutSeparators.slice(1) : withoutSeparators;
  const [wholePart, fractionPart = ""] = unsigned.split(".");

  const cents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return isNegative ? -cents : cents;
}
