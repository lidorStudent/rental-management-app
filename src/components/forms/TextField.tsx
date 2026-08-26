"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { FieldError } from "@/components/shared/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One text input with its label, hint and error, in the same order every time.
 *
 * It takes the props `react-hook-form`'s `register` returns and forwards them to the input, so the
 * call site reads as one line and no field state is duplicated:
 *
 *   <TextField label="City" error={formState.errors.city?.message} {...register("city")} />
 *
 * The rule behind the field is not here. It is in the Zod schema the form and the server action
 * both use, which is the only place any validation rule is written down.
 */
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, name, ...inputProps },
  ref,
) {
  const fieldId = id ?? name;
  const hintId = hint === undefined ? undefined : `${fieldId}-hint`;
  const errorId = error === undefined ? undefined : `${fieldId}-error`;
  // Both, when both are there: a reader hears the hint and then what is wrong with what they typed.
  const describedBy = [hintId, errorId].filter((id) => id !== undefined).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        name={name}
        ref={ref}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint === undefined ? null : (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
});
