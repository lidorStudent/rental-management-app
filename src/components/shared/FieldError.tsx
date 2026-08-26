/**
 * The message under a single field, in the same position on every form.
 *
 * It carries an id so the input can point at it with aria-describedby. Without that the message is
 * a loose paragraph a screen reader may reach eventually and will not announce with the field, so
 * somebody navigating by keyboard hears "invalid data" and is not told what is wrong.
 */
export function FieldError({ id, message }: { id?: string; message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}
