import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end suite runs a real browser against the running application and the **test** Supabase
 * project. It signs users in, creates portfolios and writes rows, so the same guard the database
 * suite uses applies here: the configuration refuses to build if it is pointed at production.
 *
 * The dev server is started by Playwright with these values in its environment. Next.js does not
 * override variables that are already set, so .env.local, which points at production, is ignored.
 */
const PRODUCTION_PROJECT_REFERENCE = "jarkqjrfuzvvrbietxve";

function readEnvironmentFile(path: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `${path} was not found. The end-to-end tests need the test Supabase project's details; copy .env.example and fill them in.`,
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

const testEnvironment = readEnvironmentFile(".env.test");
const projectUrl = testEnvironment.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (new URL(projectUrl).hostname.split(".")[0] === PRODUCTION_PROJECT_REFERENCE) {
  throw new Error(
    `REFUSING TO RUN: the end-to-end tests are pointed at the production project. They sign users in and write rows. Point .env.test at the test project and run them again.`,
  );
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/support/**"],
  fullyParallel: false,
  // One at a time: every test creates and removes its own landlord, and a single worker keeps a
  // failure readable rather than interleaved with three others.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: testEnvironment,
  },
});
