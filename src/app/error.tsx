"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * The boundary for failures that are not part of the product: a database that cannot be reached, or
 * a guard that was bypassed.
 *
 * The reader gets one plain sentence and nothing else. No message, no stack, no digest: a Postgres
 * error names tables and constraints, and none of that is a browser's business. The digest is
 * written to the console so that a failure someone reports can be matched against the line the
 * server already logged.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Render failed", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-medium">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        That request could not be completed. Try again, and sign in again if the problem continues.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href="/login">Go to sign in</a>
        </Button>
      </div>
    </main>
  );
}
