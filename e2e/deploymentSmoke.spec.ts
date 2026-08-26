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

  // Scoped to the navigation: "Rent" would otherwise also match the "Rental Management" brand link.
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
