"use client";

import { Button } from "@/components/ui/button";

/**
 * The boundary for failures that are not part of the product: a database that cannot be reached, or
 * a guard that was bypassed. It shows one plain sentence and nothing internal, because the details
 * belong in the server log, not in the browser.
 */
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-medium">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
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
