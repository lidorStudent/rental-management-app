"use client";

import { Button } from "@/components/ui/button";

/**
 * The submit control for every form. It takes the pending state as a prop rather than reading it
 * from a form context, because the forms in this product submit through a transition rather than
 * through a form action.
 *
 * The variant exists for one case. A form that is the reason the reader opened the page carries the
 * accent; a form sitting in a section of a page whose main work is elsewhere does not, so it stops
 * competing with the action the reader actually came for.
 */
export function SubmitButton({
  isSubmitting,
  variant = "default",
  children,
}: {
  isSubmitting: boolean;
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" variant={variant} disabled={isSubmitting} className="w-full">
      {isSubmitting ? "Working..." : children}
    </Button>
  );
}
