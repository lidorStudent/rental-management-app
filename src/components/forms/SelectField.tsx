"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/classNames";

/**
 * A native select, on purpose. The options here are short, closed lists that come from database
 * enums: how rent arrived, how urgent a problem is. The browser's own control is denser, works with
 * a keyboard and a phone without any help, and needs no JavaScript to open.
 */
type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, options, id, name, className, ...selectProps },
  ref,
) {
  const fieldId = id ?? name;
  const hintId = hint === undefined ? undefined : `${fieldId}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <select
        id={fieldId}
        name={name}
        ref={ref}
        aria-invalid={error !== undefined}
        aria-describedby={hintId}
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint === undefined ? null : (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError message={error} />
    </div>
  );
});
