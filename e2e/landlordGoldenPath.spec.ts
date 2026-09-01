import { expect, test } from "@playwright/test";

import {
  TEST_PASSWORD,
  adminClient,
  createLandlordAccount,
  endOfMonth,
  monthsFromNow,
  removeEverything,
  signIn,
  signOut,
  uniqueName,
  type CreatedAccount,
} from "./support/portfolio";

/**
 * A landlord's whole first day, through the interface, with nothing set up in advance beyond the
 * account itself: add a building, add a unit, record a tenancy, give the tenant a way in, record
 * rent, watch the dashboard change, and take a reported problem to resolved.
 *
 * The tenant reports the problem, because a landlord cannot report one on their behalf. So the test
 * signs out and back in, which is also the only way to prove that what one party writes the other
 * party sees.
 */
let landlord: CreatedAccount;
let tenantEmail: string;

test.beforeEach(async () => {
  landlord = await createLandlordAccount();
  tenantEmail = `${uniqueName("e2e-tenant")}@example.co.il`;
});

test.afterEach(async () => {
  const { data } = await adminClient().from("profiles").select("id").eq("email", tenantEmail);
  await removeEverything(
    landlord.id,
    (data ?? []).map((row) => row.id),
  );
});

// PROC-01, and the steps below carry the cases each one discharges
test("a landlord sets up a portfolio, records rent, and closes a reported problem", async ({
  page,
}) => {
  const buildingName = uniqueName("Building");
  // The tenancy starts this month, so exactly one period is chargeable and paying it settles the
  // portfolio. A tenancy starting earlier would leave the earlier months owing, which is a
  // different test.
  const startDate = monthsFromNow(0);
  const endDate = endOfMonth(11);

  await signIn(page, landlord.email);
  await expect(page).toHaveURL(/\/landlord$/);
  await expect(page.getByText("Nothing to show yet")).toBeVisible();

  // CORE-01, EDGE-10
  await test.step("adds the first building", async () => {
    await page.getByRole("link", { name: "Add a property" }).click();
    await page.getByLabel("Name").fill(buildingName);
    await page.getByLabel("Street and number").fill("Ben Yehuda Street 40");
    await page.getByLabel("City").fill("Tel Aviv-Yafo");
    await page.getByRole("button", { name: "Add property" }).click();

    await expect(page.getByRole("heading", { name: buildingName })).toBeVisible();
    await expect(page.getByText("No units yet")).toBeVisible();
  });

  // CORE-05, CORE-06
  await test.step("adds a unit, which starts out vacant", async () => {
    await page.getByRole("link", { name: "Add a unit" }).first().click();
    await page.getByLabel("Label").fill("Flat 1");
    await page.getByLabel("Bedrooms").fill("2");
    await page.getByRole("button", { name: "Add unit" }).click();

    await expect(page.getByRole("cell", { name: "Flat 1", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Vacant", exact: true })).toBeVisible();
  });

  // CORE-09
  await test.step("records a tenancy on it", async () => {
    await page.getByRole("link", { name: "Leases" }).click();
    // The header offers this and so does the empty state; either will do.
    await page.getByRole("link", { name: "Record a tenancy" }).first().click();

    await expect(page.getByTestId("unit-occupancy")).toHaveText("Currently: Vacant");
    await page.getByLabel("Starts on").fill(startDate);
    await page.getByLabel("Ends on").fill(endDate);
    await page.getByLabel("Monthly rent").fill("6500");
    await page.getByLabel("Rent due on day").fill("10");
    await page.getByRole("button", { name: "Record tenancy" }).click();

    await expect(page.getByRole("heading", { name: `Flat 1 - ${buildingName}` })).toBeVisible();
    await expect(page.getByText("₪6,500.00").first()).toBeVisible();
  });

  let temporaryPassword = "";

  // CORE-12, CORE-13
  await test.step("creates the tenant's account and is given one password", async () => {
    await page.getByLabel("Tenant name").fill("Maya Test");
    await page.getByLabel("Tenant email").fill(tenantEmail);
    await page.getByRole("button", { name: "Create the tenant account" }).click();

    await expect(page.getByText("Give this password to your tenant now")).toBeVisible();
    temporaryPassword = (await page.getByTestId("temporary-password").innerText()).trim();
    expect(temporaryPassword).toHaveLength(14);

    await page.getByRole("button", { name: "I have given it to them" }).click();
    await expect(page.getByText("Maya Test")).toBeVisible();
    await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  });

  // CORE-17, PROC-13
  await test.step("records the rent that has arrived", async () => {
    await page.getByRole("link", { name: "Record a payment" }).first().click();
    await page.getByLabel("Amount received").fill("6500");
    await page.getByRole("button", { name: "Record this payment" }).click();

    await expect(page.getByRole("cell", { name: "Bank transfer" })).toBeVisible();
    // Exact, because getByText matches substrings: "Paid" alone also matches a "Part paid" badge,
    // so the loose form passed whether the month settled or only half did.
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });

  // PROC-12
  await test.step("sees the dashboard reflect it", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();

    await expect(page.getByRole("link", { name: /Rent collected this month/ })).toContainText(
      "₪6,500.00",
    );
    await expect(page.getByRole("link", { name: /Occupancy/ })).toContainText("1 of 1");
  });

  // PROC-02, CORE-23
  await test.step("the tenant reports a problem", async () => {
    await signOut(page);
    await signIn(page, tenantEmail, temporaryPassword);

    await expect(page).toHaveURL(/\/change-password/);
    // The temporary password the landlord issued is what the tenant proves they hold.
    await page.getByLabel("Current password").fill(temporaryPassword);
    await page.getByLabel("New password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Repeat new password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page).toHaveURL(/\/tenant$/);

    await page.goto("/tenant/maintenance/new");
    await page.getByLabel("What is wrong").fill("Kitchen tap drips");
    await page
      .getByLabel("Describe it")
      .fill("The mixer tap drips even when closed tightly, and it is getting worse.");
    await page.getByLabel("How urgent is it").selectOption("urgent");
    await page.getByRole("button", { name: "Report this problem" }).click();

    await expect(page.getByRole("heading", { name: "Kitchen tap drips" })).toBeVisible();
    await expect(
      page.getByText("Reported. Your landlord has not marked it seen yet"),
    ).toBeVisible();
  });

  // CORE-25, PROC-16
  await test.step("the landlord takes it to resolved", async () => {
    await signOut(page);
    await signIn(page, landlord.email);

    await page.getByRole("link", { name: "Maintenance" }).click();
    await expect(page.getByRole("cell", { name: "Urgent" })).toBeVisible();
    await page.getByRole("link", { name: "Kitchen tap drips" }).click();

    await page.getByRole("button", { name: "Acknowledge it" }).click();
    await expect(page.getByText("Acknowledged").first()).toBeVisible();

    await page.getByRole("button", { name: "Start work" }).click();
    await expect(page.getByText("In progress").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark it resolved" }).click();
    await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark it resolved" })).toHaveCount(0);
  });

  // PROC-13
  await test.step("and the dashboard has nothing left to chase", async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();

    await expect(page.getByRole("link", { name: /Open problems/ })).toContainText("0");
    await expect(page.getByRole("link", { name: /Outstanding/ })).toContainText("₪0.00");
  });
});
