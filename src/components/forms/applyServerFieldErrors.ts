import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Puts the field errors a server action returned back onto the form that produced them.
 *
 * The client and the server run the same Zod schema, so the client usually catches a bad field
 * first. The server run is the one that matters, and it can also refuse things the client cannot
 * see: a duplicate unit label, dates that collide with another tenancy. Those come back keyed by
 * field name, and this is where they land next to the right input.
 *
 * The cast is unavoidable: the action returns a plain record of strings, and only the form knows
 * which of its fields those names refer to. Doing it once here keeps it out of every form.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  fieldErrors: Record<string, string> | undefined,
): void {
  for (const [fieldName, message] of Object.entries(fieldErrors ?? {})) {
    setError(fieldName as Path<TFieldValues>, { message });
  }
}
