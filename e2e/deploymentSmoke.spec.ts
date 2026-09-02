import { expect, test } from "@playwright/test";

/**
 * The check to run after a deployment, against the deployed address:
 *
 *   PLAYWRIGHT_BASE_URL=https://rental-management-app-wine.vercel.app npx playwright test e2e/deploymentSmoke.spec.ts
 *
 * It is read only. It signs in as the seeded landlord and the seeded tenant and looks at pages;
 * nothing here writes a row, because the project it runs against is the one people are shown.
 *
 * Without PLAYWRIGHT_BASE_URL it is skipped, so it does not run as part of the ordinary suite: the
 * rest of that suite creates and deletes data, and this one deliberately does not.
 */
const SEEDED_PASSWORD = "Demo-Rental-2026!";

test.skip(
  process.env.PLAYWRIGHT_BASE_URL === undefined,
  "Set PLAYWRIGHT_BASE_URL to the deployed address to run the deployment smoke check.",
);

test("the health endpoint reports the database as reachable", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", database: "reachable" });
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

// PERM-35
test("the deployed site's session cookie cannot be read by page JavaScript", async ({
  page,
  context,
}) => {
  // Checked here as well as in sessionCookie.spec.ts because the secure flag only turns on in a
  // production build, so this address is the only place its real value can be seen.
  for (const email of ["noa.bendavid@example.co.il", "maya.levi@example.co.il"]) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(SEEDED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.includes("auth-token"),
    );
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.secure).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
    }

    expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/login");
  }
});

test("a seeded landlord can sign in and reach every part of their portfolio", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("noa.bendavid@example.co.il");
  await page.getByLabel("Password").fill(SEEDED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/landlord$/);

  await expect(page.getByRole("link", { name: /Occupancy/ })).not.toContainText("0 of 0");
  await expect(page.getByRole("link", { name: /Rent collected this month/ })).toBeVisible();

  // Scoped to the navigation: "Rent" would otherwise also match the "Rentbook" brand link.
  const navigation = page.getByRole("navigation", { name: "Landlord" });

  await navigation.getByRole("link", { name: "Properties" }).click();
  await expect(page.getByRole("cell", { name: "Rothschild 12" })).toBeVisible();

  await navigation.getByRole("link", { name: "Leases" }).click();
  await page
    .getByRole("link", { name: /Flat 1/ })
    .first()
    .click();
  await expect(page.getByText("Runs from")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Outstanding" })).toBeVisible();

  await page.getByRole("link", { name: "Statement" }).click();
  await expect(page.getByRole("heading", { name: "Rent statement" })).toBeVisible();
  await expect(page.getByText("Total charged")).toBeVisible();

  await navigation.getByRole("link", { name: "Rent" }).click();
  await expect(page.getByText("Outstanding across the portfolio")).toBeVisible();

  await navigation.getByRole("link", { name: "Maintenance" }).click();
  await expect(page.getByRole("columnheader", { name: "Problem" })).toBeVisible();
});

test("a seeded tenant can sign in and see their own tenancy", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("maya.levi@example.co.il");
  await page.getByLabel("Password").fill(SEEDED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tenant$/);

  await expect(page.getByRole("heading", { name: "Your tenancy" })).toBeVisible();
  await expect(page.getByText("This month")).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Tenant" });
  await navigation.getByRole("link", { name: "Lease" }).click();
  await expect(page.getByText("Rothschild Boulevard 12, Tel Aviv-Yafo, 6688212")).toBeVisible();

  await navigation.getByRole("link", { name: "Payments" }).click();
  await expect(page.getByRole("columnheader", { name: "Amount" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₪6,500.00" }).first()).toBeVisible();

  // A tenant reaches nothing of the landlord's, on the deployed address as anywhere else.
  await page.goto("/landlord/rent");
  await expect(page).toHaveURL(/\/tenant$/);
});

/**
 * The response headers, on the deployed address, because that is the only place they are real: the
 * platform serves them and no local build proves what the edge actually sends.
 *
 * The content security policy is asserted directive by directive rather than as one string, so a
 * later edit that loosens one of them fails here with the name of the directive it loosened rather
 * than with an unreadable diff of the whole header.
 */
// SEC-01
test("the deployed site sends the security headers it is supposed to", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();

  const policy = headers["content-security-policy"];
  expect(policy, "there is a content security policy at all").toBeDefined();

  for (const directive of [
    "default-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ]) {
    expect(policy, `the policy still carries ${directive}`).toContain(directive);
  }

  // script-src allows inline because Next streams its payload into two inline script blocks. It
  // must not also allow another origin: that is the half of the policy still doing real work.
  expect(policy).toContain("script-src 'self' 'unsafe-inline'");
  expect(policy, "no origin wildcard has crept in").not.toContain("*");

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
  expect(headers["strict-transport-security"], "HSTS, which the platform sets").toContain(
    "max-age=",
  );
});

/**
 * A policy that blocks the application's own scripts is worse than no policy, so this asserts the
 * page still works rather than only that the header is present: a landlord signs in, which is a
 * form submitting through a server action, and lands on a page that has hydrated.
 */
// SEC-02
test("the policy does not stop the deployed pages working", async ({ page }) => {
  const refusals: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute|apply|connect)/i.test(message.text())) {
      refusals.push(message.text());
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email address").fill("noa.bendavid@example.co.il");
  await page.getByLabel("Password").fill(SEEDED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/landlord$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/landlord/properties/new");
  await expect(page.getByRole("heading", { name: "Add a property" })).toBeVisible();
  // react-hook-form marking the fields is proof the client bundle ran under the policy.
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.locator("[aria-invalid=true]").first()).toBeVisible();

  expect(refusals, `the browser refused something: ${refusals.join(" | ")}`).toHaveLength(0);
});
