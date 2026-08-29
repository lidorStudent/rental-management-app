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
  type Portfolio,
} from "./support/portfolio";

/**
 * States the interface has to get right that are neither a golden path nor an attack: which link is
 * marked as the current one, what a destructive button says before it does anything, and the two
 * tenancies that are perfectly ordinary but are not running today.
 */
let portfolio: Portfolio;

test.beforeEach(async () => {
  portfolio = await createPortfolio();
});

// UI-07
test("the navigation marks the page you are on, and only that one", async ({ page }) => {
  try {
    await signIn(page, portfolio.landlord.email);
    const navigation = page.getByRole("navigation", { name: "Landlord" });

    await page.goto("/landlord/rent");
    await expect(navigation.getByRole("link", { name: "Rent", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      navigation.getByRole("link", { name: "Properties", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");

    await page.goto("/landlord/properties");
    await expect(navigation.getByRole("link", { name: "Properties", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.getByRole("link", { name: "Rent", exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  } finally {
    await removeEverything(portfolio.landlord.id);
  }
});

// UI-10, CORE-08
test("deleting a flat states the consequence first, and refuses when there is history", async ({
  page,
}) => {
  const tenant = await createTenantAccount(false);
  await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });

  const { data: emptyUnit } = await adminClient()
    .from("units")
    .insert({
      property_id: portfolio.propertyId,
      landlord_id: portfolio.landlord.id,
      label: "Flat 9",
    })
    .select("id")
    .single();

  try {
    await signIn(page, portfolio.landlord.email);

    // A flat that has never been let: the panel says so, and the button is offered.
    await page.goto(`/landlord/units/${emptyUnit?.id}/edit`);
    await page.getByRole("button", { name: "Delete this unit" }).click();
    await expect(page.getByText("This unit has never been let")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, delete it" })).toBeEnabled();

    // A flat with a tenancy: the panel names what is in the way and the button cannot be pressed.
    await page.goto(`/landlord/units/${portfolio.unitId}/edit`);
    await page.getByRole("button", { name: "Delete this unit" }).click();
    await expect(page.getByText(/1 tenancy recorded against it/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, delete it" })).toBeDisabled();
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});

// EDGE-07, EDGE-09
test("a tenant whose tenancy has ended keeps their history and is told where new problems go", async ({
  page,
}) => {
  const tenant = await createTenantAccount(false);
  const endedLease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-14),
    endDate: endOfMonth(-2),
  });
  await recordPayment({
    leaseId: endedLease.id,
    landlordId: portfolio.landlord.id,
    periodMonth: monthsFromNow(-3),
    amountInAgorot: 650000,
    receivedOn: monthsFromNow(-3),
  });

  try {
    await signIn(page, tenant.email);

    await expect(page.getByText(`Your tenancy ended on ${endedLease.endDate}`)).toBeVisible();

    await page.goto("/tenant/payments");
    await expect(page.getByRole("cell", { name: "₪6,500.00" }).first()).toBeVisible();

    await page.goto("/tenant/maintenance/new");
    await expect(page.getByText(`Your tenancy ended on ${endedLease.endDate}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Report this problem" })).toBeHidden();
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});

// EDGE-08
test("a tenant whose tenancy has not started is told when it does", async ({ page }) => {
  const tenant = await createTenantAccount(false);
  const upcomingLease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(2),
    endDate: endOfMonth(14),
  });

  try {
    await signIn(page, tenant.email);

    await expect(page.getByText(`Your tenancy starts on ${upcomingLease.startDate}`)).toBeVisible();

    await page.goto("/tenant/maintenance/new");
    await expect(page.getByText(`Your tenancy starts on ${upcomingLease.startDate}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Report this problem" })).toBeHidden();
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});
