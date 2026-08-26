"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/classNames";

/** The same shape as TextField, for the one input that needs several lines: a problem description. */
type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, error, hint, id, name, className, ...textAreaProps }, ref) {
    const fieldId = id ?? name;
    const hintId = hint === undefined ? undefined : `${fieldId}-hint`;
    const errorId = error === undefined ? undefined : `${fieldId}-error`;
    // Both, when both are there: a reader hears the hint and then what is wrong with what they typed.
    const describedBy = [hintId, errorId].filter((id) => id !== undefined).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        <textarea
          id={fieldId}
          name={name}
          ref={ref}
          rows={4}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...textAreaProps}
        />
        {hint === undefined ? null : (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <FieldError id={errorId} message={error} />
      </div>
    );
  },
);
