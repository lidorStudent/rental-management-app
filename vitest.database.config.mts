import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The suite that runs against a real Postgres, because policies and constraints cannot be proved
 * anywhere else. It is a separate configuration from the unit suite on purpose: `npm test` stays
 * offline and fast, and this one is asked for by name.
 *
 * The connection details come from .env.test and from nowhere else. Vite only exposes variables it
 * recognises, so the file is read here and handed to the tests explicitly.
 */
function readEnvironmentFile(path: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `${path} was not found. The database tests need the test Supabase project's details; copy .env.example and fill them in.`,
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

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: readEnvironmentFile(".env.test"),
    // Each file signs several users in and writes rows; running them one at a time keeps one
    // file's cleanup from colliding with another's setup.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // See tests/support/serverOnlyStub.ts: there is no client bundle in a node test process.
      "server-only": fileURLToPath(new URL("./tests/support/serverOnlyStub.ts", import.meta.url)),
    },
  },
});
