"use client";

import { Button } from "@/components/ui/button";

/**
 * The browser's own print dialogue, which is also how this document becomes a PDF. There is no PDF
 * library in this project: the browser already renders and paginates this page, and asking it to
 * print produces the same document the reader is looking at.
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
