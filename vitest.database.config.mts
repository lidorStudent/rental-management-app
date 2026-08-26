import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { readEnvironmentFile } from "./tests/support/environmentFile";

/**
 * The suite that runs against a real Postgres, because policies and constraints cannot be proved
 * anywhere else. It is a separate configuration from the unit suite on purpose: `npm test` stays
 * offline and fast, and this one is asked for by name.
 *
 * The connection details come from .env.test and from nowhere else. Vite only exposes variables it
 * recognises, so the file is read here and handed to the tests explicitly.
 */
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
