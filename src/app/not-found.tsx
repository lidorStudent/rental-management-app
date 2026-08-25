import Link from "next/link";

/**
 * Shown both for a page that does not exist and for a row the signed-in user may not see. The two
 * are deliberately indistinguishable: a different message would confirm that someone else's lease
 * exists.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-medium">Not found</h1>
      <p className="text-sm text-muted-foreground">
        That page does not exist, or it is not yours to view.
      </p>
      <Link href="/" className="text-sm underline">
        Back to your own pages
      </Link>
    </main>
  );
}
