import { expect, test } from "@playwright/test";

import {
  adminClient,
  createLease,
  createPortfolio,
  createTenantAccount,
  endOfMonth,
  monthsFromNow,
  removeEverything,
  signIn,
  TEST_PASSWORD,
  uniqueName,
  type CreatedAccount,
  type CreatedLease,
  type Portfolio,
} from "./support/portfolio";

/**
 * The paths that must not work.
 *
 * These matter at least as much as the golden ones: a product that does the right thing when asked
 * nicely and the wrong thing when asked rudely is not finished. Each test sets up its own landlord
 * and tenants and removes them afterwards, so nothing here depends on what the others did.
 */
let portfolio: Portfolio;
let firstTenant: CreatedAccount;
let secondTenant: CreatedAccount;
let firstLease: CreatedLease;
let secondUnitId: string;

test.beforeEach(async () => {
  portfolio = await createPortfolio();
  firstTenant = await createTenantAccount(false);
  secondTenant = await createTenantAccount(false);

  firstLease = await createLease({
    portfolio,
    tenantId: firstTenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });

  const { data: secondUnit } = await adminClient()
    .from("units")
    .insert({
      property_id: portfolio.propertyId,
      landlord_id: portfolio.landlord.id,
      label: "Flat 2",
    })
    .select("id")
    .single();
  secondUnitId = secondUnit?.id ?? "";

  await adminClient()
    .from("leases")
    .insert({
      unit_id: secondUnitId,
      landlord_id: portfolio.landlord.id,
      tenant_profile_id: secondTenant.id,
      rent_amount_cents: 580000,
      start_date: monthsFromNow(-1),
      end_date: endOfMonth(10),
      rent_due_day: 28,
    });
});

test.afterEach(async () => {
  await removeEverything(portfolio.landlord.id, [firstTenant.id, secondTenant.id]);
});

test("an overlapping tenancy is refused, naming the tenancy in the way and the first free day", async ({
  page,
}) => {
  await signIn(page, portfolio.landlord.email);
  await page.goto("/landlord/leases/new");

  await page.getByLabel("Unit").selectOption({ label: `Flat 1 - ${portfolio.propertyName}` });
  await expect(page.getByTestId("unit-occupancy")).toContainText(firstLease.endDate);

  // The existing tenancy owns its last day, so a new one starting on it must be refused.
  await page.getByLabel("Starts on").fill(firstLease.endDate);
  await page.getByLabel("Ends on").fill(endOfMonth(22));
  await page.getByLabel("Monthly rent").fill("7000");
  await page.getByLabel("Rent due on day").fill("1");
  await page.getByRole("button", { name: "Record tenancy" }).click();

  const summary = page.locator("form").getByRole("alert");
  await expect(summary).toContainText(
    `This unit is already let from ${firstLease.startDate} to ${firstLease.endDate}`,
  );
  await expect(summary).toContainText("at the earliest");
  await expect(page).toHaveURL(/\/landlord\/leases\/new/);

  const { count } = await adminClient()
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", portfolio.unitId);
  expect(count).toBe(1);
});

// PERM-26
test("a tenant sent to a landlord route is put back in their own portal", async ({ page }) => {
  await signIn(page, firstTenant.email);

  for (const path of [
    "/landlord",
    "/landlord/rent",
    "/landlord/properties",
    "/landlord/maintenance",
    `/landlord/leases/${firstLease.id}`,
    `/landlord/leases/${firstLease.id}/statement`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/tenant$/);
  }
});

// PERM-15
test("a tenant naming another tenant's record is answered as if it does not exist", async ({
  page,
}) => {
  const { data: theirRequest } = await adminClient()
    .from("maintenance_requests")
    .insert({
      lease_id: (
        await adminClient()
          .from("leases")
          .select("id")
          .eq("tenant_profile_id", secondTenant.id)
          .single()
      ).data?.id as string,
      landlord_id: portfolio.landlord.id,
      submitted_by: secondTenant.id,
      title: "Reported by the other tenant",
      description: "This belongs to somebody else and must never be readable here.",
    })
    .select("id")
    .single();

  await signIn(page, firstTenant.email);

  // Both pages are read only once they have finished rendering. The tenant area streams a skeleton
  // first, so reading before the heading is visible would compare one page against a half-drawn one.
  await page.goto(`/tenant/maintenance/${theirRequest?.id}`);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  const theirsBody = await page.getByRole("main").innerText();

  await page.goto("/tenant/maintenance/11111111-2222-4333-8444-555555555555");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  const nobodysBody = await page.getByRole("main").innerText();

  // Identical, so the page cannot be used to find out which records exist.
  expect(theirsBody).toBe(nobodysBody);

  // And their own list still shows only their own, which is nothing.
  await page.goto("/tenant/maintenance");
  await expect(page.getByText("Nothing reported")).toBeVisible();
});

// PERM-11
test("a landlord opening another landlord's statement is answered as if it does not exist", async ({
  page,
}) => {
  const otherPortfolio = await createPortfolio();
  const otherLease = await createLease({
    portfolio: otherPortfolio,
    tenantId: null,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });

  try {
    await signIn(page, portfolio.landlord.email);

    await page.goto(`/landlord/leases/${otherLease.id}/statement`);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    const theirsBody = await page.getByRole("main").innerText();

    await page.goto("/landlord/leases/11111111-2222-4333-8444-555555555555/statement");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();

    // The same page for a lease that belongs to somebody else and one that never existed.
    expect(theirsBody).toBe(await page.getByRole("main").innerText());
  } finally {
    await removeEverything(otherPortfolio.landlord.id);
  }
});

// PERM-27
test("no tenant page offers a link into the landlord area", async ({ page }) => {
  await signIn(page, firstTenant.email);

  for (const path of [
    "/tenant",
    "/tenant/lease",
    "/tenant/payments",
    "/tenant/maintenance",
    "/tenant/maintenance/new",
    "/tenant/statement",
  ]) {
    await page.goto(path);
    const destinations = await page
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.filter((destination) => destination.startsWith("/landlord"))).toEqual([]);
  }
});

// PERM-31
test("an account whose profile row is missing is signed out again", async ({ page }) => {
  const strandedTenant = await createTenantAccount(false);
  // Removing the profile leaves the Auth account behind, which is the state this test is about:
  // somebody who can authenticate but has no role, and therefore no area to be sent to.
  await adminClient().from("profiles").delete().eq("id", strandedTenant.id);

  try {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(strandedTenant.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/not set up correctly/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // And the session it briefly had is gone: a protected route still sends them back here.
    await page.goto("/tenant");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await adminClient().auth.admin.deleteUser(strandedTenant.id);
  }
});

// PERM-28, PERM-29
test("an unauthenticated visitor is sent to sign in from every protected route", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/landlord",
    "/landlord/properties",
    "/landlord/rent",
    "/tenant",
    "/tenant/payments",
    "/tenant/statement",
    `/landlord/leases/${firstLease.id}`,
    "/change-password",
    "/a-path-that-does-not-exist",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }

  for (const publicPath of ["/login", "/register"]) {
    await page.goto(publicPath);
    await expect(page).toHaveURL(new RegExp(`${publicPath}$`));
  }
});

test("a property form submitted with nothing in it shows errors and writes nothing", async ({
  page,
}) => {
  await signIn(page, portfolio.landlord.email);
  await page.goto("/landlord/properties/new");

  await page.getByRole("button", { name: "Add property" }).click();

  await expect(page.getByText("Give the building a name you will recognise.")).toBeVisible();
  await expect(page.getByText("Enter the street and number.")).toBeVisible();
  await expect(page.getByText("Enter the city.")).toBeVisible();
  await expect(page).toHaveURL(/\/landlord\/properties\/new/);

  const { count } = await adminClient()
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("landlord_id", portfolio.landlord.id);
  expect(count).toBe(1);
});

test("a unit form with a label that is already used shows the reason against the field", async ({
  page,
}) => {
  await signIn(page, portfolio.landlord.email);
  await page.goto(`/landlord/properties/${portfolio.propertyId}/units/new`);

  await page.getByLabel("Label").fill("Flat 1");
  await page.getByRole("button", { name: "Add unit" }).click();

  await expect(page.locator("form").getByRole("alert")).toContainText(
    "This property already has a unit with that label",
  );

  const { count } = await adminClient()
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("property_id", portfolio.propertyId);
  expect(count).toBe(2);
});

test("a lease form with impossible dates and amounts shows errors and writes nothing", async ({
  page,
}) => {
  await signIn(page, portfolio.landlord.email);
  await page.goto("/landlord/leases/new");

  await page.getByLabel("Unit").selectOption({ label: `Flat 2 - ${portfolio.propertyName}` });
  await page.getByLabel("Starts on").fill("2027-06-01");
  await page.getByLabel("Ends on").fill("2027-01-01");
  await page.getByLabel("Monthly rent").fill("0");
  await page.getByLabel("Rent due on day").fill("31");
  await page.getByRole("button", { name: "Record tenancy" }).click();

  await expect(page.getByText("The end date must be after the start date.")).toBeVisible();
  await expect(page.getByText("Enter an amount above zero.")).toBeVisible();
  await expect(
    page.getByText("Choose a day between 1 and 28, so that every month has one."),
  ).toBeVisible();

  const { count } = await adminClient()
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", secondUnitId);
  expect(count).toBe(1);
});

test("a payment form with a future date and no amount shows errors and writes nothing", async ({
  page,
}) => {
  await signIn(page, portfolio.landlord.email);
  await page.goto(`/landlord/leases/${firstLease.id}/payments/new`);

  await page.getByRole("button", { name: "Record this payment" }).click();
  await expect(page.getByText("Enter an amount such as 6500 or 6500.50.")).toBeVisible();

  await page.getByLabel("Amount received").fill("6500");
  await page.getByLabel("Received on").fill("2099-01-01");
  await page.getByRole("button", { name: "Record this payment" }).click();
  await expect(
    page.getByText("Record money that has arrived, not money you expect."),
  ).toBeVisible();

  const { count } = await adminClient()
    .from("rent_payments")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", firstLease.id);
  expect(count).toBe(0);
});

test("a maintenance form with too little to act on shows errors and writes nothing", async ({
  page,
}) => {
  await signIn(page, firstTenant.email);
  await page.goto("/tenant/maintenance/new");

  await page.getByLabel("What is wrong").fill("Ta");
  await page.getByLabel("Describe it").fill("broken");
  await page.getByRole("button", { name: "Report this problem" }).click();

  await expect(page.getByText("Give the problem a short title.")).toBeVisible();
  await expect(
    page.getByText("Describe the problem in a sentence, so it can be acted on."),
  ).toBeVisible();

  const { count } = await adminClient()
    .from("maintenance_requests")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", firstLease.id);
  expect(count).toBe(0);
});

test("a registration form with a mismatched password shows the error and creates no account", async ({
  page,
}) => {
  const email = `${uniqueName("e2e-never-created")}@example.co.il`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Never Created");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("GoodPassword1");
  await page.getByLabel("Repeat password").fill("SomethingElse1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("The two passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  const { data } = await adminClient().from("profiles").select("id").eq("email", email);
  expect(data).toEqual([]);
});

/**
 * INV-08 and INV-09. The sign-in form must not be an account-existence oracle.
 *
 * A wrong password against a real account and any password against an address that has never been
 * registered have to be answered identically, or the form tells an attacker which addresses are
 * worth attacking. `docs/05-security.md` argues this at length; until now nothing held it.
 *
 * Asserted on what a person actually sees - the text on the page and the address bar - rather than
 * on the action's return value, because the property is about what the browser is told. A future
 * change that leaked the difference through a redirect, a status, or a second message would pass a
 * test that only compared the action's `message` field.
 */
test("a wrong password and an unknown address are refused in exactly the same words", async ({
  page,
}) => {
  async function refusalFor(email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Scoped inside main: Next renders its own empty role="alert" route announcer on every page,
    // and an empty alert would make two refusals look identical for the wrong reason.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toHaveText(/\S/);
    return {
      text: ((await alert.textContent()) ?? "").trim(),
      path: new URL(page.url()).pathname,
      // Everything the page says, so a difference anywhere in the response is caught, not just in
      // the sentence the form chose to show.
      body: ((await page.locator("main").textContent()) ?? "").replace(/\s+/g, " ").trim(),
    };
  }

  const wrongPassword = await refusalFor(portfolio.landlord.email, "not-the-right-password");
  const unknownAddress = await refusalFor(
    `${uniqueName("never-registered")}@example.co.il`,
    TEST_PASSWORD,
  );

  expect(wrongPassword.text).toBe("That email address and password do not match an account.");
  expect(unknownAddress.text).toBe(wrongPassword.text);
  expect(unknownAddress.path).toBe(wrongPassword.path);
  expect(unknownAddress.body).toBe(wrongPassword.body);
});
