import { expect, test } from "@playwright/test";

import {
  adminClient,
  createLease,
  createPortfolio,
  createTenantAccount,
  endOfMonth,
  monthsFromNow,
  recordPayment,
  removeEverything,
  signIn,
  signOut,
  today,
  type CreatedAccount,
  type CreatedLease,
  type Portfolio,
} from "./support/portfolio";

/**
 * A tenant's whole experience: arriving with a password their landlord handed them, replacing it,
 * finding what they rent and what they have paid, reporting a problem, and watching it change when
 * their landlord acts.
 *
 * The portfolio is built through the admin API so the test is about the tenant's screens. What the
 * tenant is given is a temporary password and nothing else, which is exactly what the product gives
 * them.
 */
const TEMPORARY_PASSWORD = "HandedOverOnce1";
const CHOSEN_PASSWORD = "ChosenByTheTenant1";

let portfolio: Portfolio;
let tenant: CreatedAccount;
let lease: CreatedLease;

test.beforeEach(async () => {
  portfolio = await createPortfolio();
  tenant = await createTenantAccount(true);
  await adminClient().auth.admin.updateUserById(tenant.id, { password: TEMPORARY_PASSWORD });

  lease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });

  await recordPayment({
    leaseId: lease.id,
    landlordId: portfolio.landlord.id,
    periodMonth: monthsFromNow(-1),
    amountInAgorot: 650000,
    receivedOn: today(),
  });
});

test.afterEach(async () => {
  await removeEverything(portfolio.landlord.id, [tenant.id]);
});

// PROC-16, and the steps below carry the cases each one discharges
test("a tenant arrives with a temporary password and ends up following a repair", async ({
  page,
}) => {
  // PROC-02
  await test.step("must choose their own password before anything else", async () => {
    await signIn(page, tenant.email, TEMPORARY_PASSWORD);
    await expect(page).toHaveURL(/\/change-password/);
    await expect(
      page.getByText("Your landlord created this account with a temporary password"),
    ).toBeVisible();

    // The forced change cannot be walked around by typing another address.
    await page.goto("/tenant/payments");
    await expect(page).toHaveURL(/\/change-password/);

    // The temporary password they signed in with a moment ago is the current one.
    await page.getByLabel("Current password").fill(TEMPORARY_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(CHOSEN_PASSWORD);
    await page.getByLabel("Repeat new password").fill(CHOSEN_PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page).toHaveURL(/\/tenant$/);
  });

  // PROC-14, UI-09
  await test.step("sees their own tenancy and what it costs", async () => {
    await expect(page.getByRole("heading", { name: "Your tenancy" })).toBeVisible();
    await expect(page.getByText("This month")).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Tenant" });
    await navigation.getByRole("link", { name: "Lease" }).click();
    await expect(page.getByRole("heading", { name: "Your lease" })).toBeVisible();
    await expect(page.getByText(portfolio.unitLabel)).toBeVisible();
    await expect(page.getByText("Ben Yehuda Street 40, Tel Aviv-Yafo")).toBeVisible();
    await expect(page.getByText("₪6,500.00")).toBeVisible();
    await expect(page.getByText("Test Landlord")).toBeVisible();
  });

  // PROC-14, UI-05
  await test.step("sees the payment their landlord recorded", async () => {
    await page
      .getByRole("navigation", { name: "Tenant" })
      .getByRole("link", { name: "Payments" })
      .click();

    await expect(page.getByRole("columnheader", { name: "Amount" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "₪6,500.00" })).toBeVisible();
    await expect(page.getByText("Showing 1 to 1 of 1")).toBeVisible();
  });

  // CORE-23
  await test.step("reports a problem", async () => {
    await page
      .getByRole("navigation", { name: "Tenant" })
      .getByRole("link", { name: "Problems" })
      .click();
    await expect(page.getByText("Nothing reported")).toBeVisible();

    await page.getByRole("link", { name: "Report a problem" }).first().click();
    await page.getByLabel("What is wrong").fill("No hot water");
    await page
      .getByLabel("Describe it")
      .fill("The boiler stopped heating on Friday and there has been no hot water since.");
    await page.getByRole("button", { name: "Report this problem" }).click();

    await expect(page.getByRole("heading", { name: "No hot water" })).toBeVisible();
    await expect(
      page.getByText("Reported. Your landlord has not marked it seen yet"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, this was fixed" })).toHaveCount(0);
  });

  // CORE-26, PROC-16
  await test.step("sees the status change once the landlord has acted", async () => {
    const requestUrl = page.url();

    await signOut(page);
    await signIn(page, portfolio.landlord.email);
    await page.goto("/landlord/maintenance");
    await page.getByRole("link", { name: "No hot water" }).click();
    await page.getByRole("button", { name: "Mark it resolved" }).click();
    await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();

    await signOut(page);
    await signIn(page, tenant.email, CHOSEN_PASSWORD);
    await page.goto(requestUrl);

    await expect(page.getByText("Your landlord has marked it fixed")).toBeVisible();
    await page.getByRole("button", { name: "Yes, this was fixed" }).click();
    await expect(page.getByText(/You confirmed this was fixed on/)).toBeVisible();
  });
});
