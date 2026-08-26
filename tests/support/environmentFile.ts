import { readFileSync } from "node:fs";

/**
 * Reads a `.env`-shaped file into a plain object.
 *
 * Three things need this and none of them can use Next.js's own loader: the database test
 * configuration, the Playwright configuration, and the browser tests' set-up, all of which read
 * `.env.test` before any framework is running. It lived in all three as a copy until the audit
 * found it.
 */
export function readEnvironmentFile(path: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `${path} was not found. The tests need the test Supabase project's details; copy .env.example and fill them in.`,
    );
  }

  const values: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [name, ...rest] = trimmed.split("=");
    values[name] = rest.join("=");
  }
  return values;
}
