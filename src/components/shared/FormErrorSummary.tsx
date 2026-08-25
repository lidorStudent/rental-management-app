/**
 * The one place a failed submission is announced. Every form renders it, so a refused write is
 * never silent.
 */
export function FormErrorSummary({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
