/** The message under a single field. Rendered by every form, in the same position each time. */
export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}
