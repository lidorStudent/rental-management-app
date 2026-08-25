import type { ZodError } from "zod";

/**
 * What every server action returns. A discriminated union rather than a thrown error, because a
 * refused write is an ordinary part of the product: the form has to render the reason next to the
 * field that caused it.
 *
 * Unexpected failures are not represented here. Those are logged on the server and turned into a
 * generic error result, so that nothing internal reaches the browser.
 */
export type ActionResult<TValue = undefined> =
  | { status: "success"; value: TValue }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export function successResult(): ActionResult;
export function successResult<TValue>(value: TValue): ActionResult<TValue>;
export function successResult<TValue>(value?: TValue): ActionResult<TValue | undefined> {
  return { status: "success", value };
}

export function errorResult(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { status: "error", message, fieldErrors };
}

/** Turns a failed Zod parse into one message per field, keeping the first problem for each. */
export function validationErrorResult(parseError: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of parseError.issues) {
    const fieldName = issue.path.join(".");
    if (fieldName !== "" && fieldErrors[fieldName] === undefined) {
      fieldErrors[fieldName] = issue.message;
    }
  }

  return errorResult("Some of the details need correcting.", fieldErrors);
}
