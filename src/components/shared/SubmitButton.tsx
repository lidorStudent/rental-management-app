"use client";

import { Button } from "@/components/ui/button";

/**
 * The submit control for every form. It takes the pending state as a prop rather than reading it
 * from a form context, because the forms in this product submit through a transition rather than
 * through a form action.
 */
export function SubmitButton({
  isSubmitting,
  children,
}: {
  isSubmitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={isSubmitting} className="w-full">
      {isSubmitting ? "Working..." : children}
    </Button>
  );
}
