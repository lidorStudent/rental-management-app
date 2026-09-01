import { expect, test } from "@playwright/test";

import {
  adminClient,
  createLease,
  createMaintenanceRequest,
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
 * marked as the current one, what a destructive button says before it does anything, the two
 * tenancies that are perfectly ordinary but are not running today, how a long list is ordered and
 * paged, how two filters narrow one another, and what a page looks like on paper.
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

// CORE-20
test("a tenancy's payment history is newest first, ten to a page, with the page in the address", async ({
  page,
}) => {
  const tenant = await createTenantAccount(false);
  const lease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-12),
    endDate: endOfMonth(6),
  });

  // Twelve months of rent, one payment each, so the list runs to a second page. Each is received on
  // the fifteenth of its own month, so the order the page must produce is unambiguous.
  const periodMonths = Array.from({ length: 12 }, (unused, index) => monthsFromNow(index - 12));
  for (const periodMonth of periodMonths) {
    await recordPayment({
      leaseId: lease.id,
      landlordId: portfolio.landlord.id,
      periodMonth,
      amountInAgorot: 650000,
      receivedOn: `${periodMonth.slice(0, 7)}-15`,
    });
  }

  const newestReceivedOn = `${periodMonths[periodMonths.length - 1].slice(0, 7)}-15`;
  const oldestReceivedOn = `${periodMonths[0].slice(0, 7)}-15`;

  try {
    await signIn(page, portfolio.landlord.email);
    await page.goto(`/landlord/leases/${lease.id}`);

    // Scoped to the ledger by its caption: the rent schedule above it is also a table, and the
    // assertion is about the order of the payments, not of the months.
    const ledger = page.getByRole("table", { name: "Payments recorded against this tenancy" });

    await expect(ledger.locator("tbody tr").first().locator("td").first()).toHaveText(
      newestReceivedOn,
    );
    await expect(page.getByText("Showing 1 to 10 of 12")).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(ledger.locator("tbody tr")).toHaveCount(10);
    await expect(ledger.getByText(oldestReceivedOn)).toHaveCount(0);

    await page.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByText("Showing 11 to 12 of 12")).toBeVisible();
    await expect(ledger.locator("tbody tr")).toHaveCount(2);
    await expect(ledger.locator("tbody tr").last().locator("td").first()).toHaveText(
      oldestReceivedOn,
    );
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});

// CORE-27
test("the maintenance list filters by state and by urgency, both of them in the address", async ({
  page,
}) => {
  const tenant = await createTenantAccount(false);
  const lease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(11),
  });

  // One of each combination the two filters have to separate.
  const planted = [
    { title: "Urgent and still open", urgency: "urgent", status: "submitted" },
    { title: "Urgent and already resolved", urgency: "urgent", status: "resolved" },
    { title: "Normal and still open", urgency: "normal", status: "in_progress" },
    { title: "Low and already resolved", urgency: "low", status: "resolved" },
  ] as const;

  for (const request of planted) {
    await createMaintenanceRequest({
      leaseId: lease.id,
      landlordId: portfolio.landlord.id,
      tenantId: tenant.id,
      title: request.title,
      urgency: request.urgency,
      status: request.status,
    });
  }

  try {
    await signIn(page, portfolio.landlord.email);
    await page.goto("/landlord/maintenance");

    for (const request of planted) {
      await expect(page.getByRole("link", { name: request.title })).toBeVisible();
    }

    await page.getByRole("navigation", { name: "Filter by state" }).getByRole("link", { name: "Open" }).click();

    await expect(page).toHaveURL(/[?&]status=open/);
    await expect(page.getByRole("link", { name: "Urgent and still open" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Normal and still open" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Urgent and already resolved" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Low and already resolved" })).toHaveCount(0);

    // The second filter narrows the first rather than replacing it, which is the whole point of
    // "urgent and still open" being one question.
    await page
      .getByRole("navigation", { name: "Filter by urgency" })
      .getByRole("link", { name: "Urgent" })
      .click();

    await expect(page).toHaveURL(/[?&]status=open/);
    await expect(page).toHaveURL(/[?&]urgency=urgent/);
    await expect(page.getByRole("link", { name: "Urgent and still open" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Normal and still open" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Urgent and already resolved" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Low and already resolved" })).toHaveCount(0);
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});

// UI-11
test("print media hides the chrome around a statement and leaves the document", async ({ page }) => {
  const tenant = await createTenantAccount(false);
  const lease = await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-2),
    endDate: endOfMonth(9),
  });

  try {
    await signIn(page, portfolio.landlord.email);
    await page.goto(`/landlord/leases/${lease.id}/statement`);

    const navigation = page.getByRole("navigation", { name: "Landlord" });
    const backLink = page.getByRole("link", { name: "Back to the tenancy" });
    const printButton = page.getByRole("button", { name: /Print/ });
    const rangeForm = page.getByRole("button", { name: "Show this range" });
    const statementHeading = page.getByRole("heading", { name: "Rent statement" });

    await expect(navigation).toBeVisible();
    await expect(backLink).toBeVisible();
    await expect(printButton).toBeVisible();
    await expect(rangeForm).toBeVisible();
    await expect(statementHeading).toBeVisible();

    await page.emulateMedia({ media: "print" });

    await expect(navigation).toBeHidden();
    await expect(backLink).toBeHidden();
    await expect(printButton).toBeHidden();
    await expect(rangeForm).toBeHidden();
    // The point of the case: the chrome goes and the document stays.
    await expect(statementHeading).toBeVisible();
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});

// CORE-29
test("only a vacant unit offers a tenancy, and it carries the unit with it", async ({ page }) => {
  const client = adminClient();
  const tenant = await createTenantAccount(false);

  // Flat 1 is let today.
  await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });

  // Flat 2 stands empty.
  const { data: vacantUnit } = await client
    .from("units")
    .insert({ property_id: portfolio.propertyId, landlord_id: portfolio.landlord.id, label: "Flat 2" })
    .select("id")
    .single();

  // Flat 3 is free today but already reserved by a tenancy that has not started. This is the case
  // the rule was written for and the one most likely to be lost: it looks vacant on the surface.
  const { data: reservedUnit } = await client
    .from("units")
    .insert({ property_id: portfolio.propertyId, landlord_id: portfolio.landlord.id, label: "Flat 3" })
    .select("id")
    .single();
  await client.from("leases").insert({
    unit_id: reservedUnit?.id as string,
    landlord_id: portfolio.landlord.id,
    tenant_profile_id: null,
    rent_amount_cents: 500000,
    deposit_amount_cents: 0,
    start_date: monthsFromNow(2),
    end_date: endOfMonth(13),
    rent_due_day: 10,
  });

  try {
    await signIn(page, portfolio.landlord.email);
    await page.goto(`/landlord/properties/${portfolio.propertyId}`);

    // Scoped to the unit table by its caption rather than to the page, so a second table added
    // later cannot make these counts mean something else.
    const units = page.getByRole("table", { name: `Units in ${portfolio.propertyName}` });
    await expect(units.getByRole("cell", { name: "Flat 2", exact: true })).toBeVisible();

    const offered = units.getByRole("link", { name: /^Record a tenancy on / });
    await expect(offered).toHaveCount(1);

    await expect(
      units.getByRole("link", { name: "Record a tenancy on Flat 2", exact: true }),
    ).toBeVisible();
    await expect(
      units.getByRole("link", { name: "Record a tenancy on Flat 1", exact: true }),
    ).toHaveCount(0);
    await expect(
      units.getByRole("link", { name: "Record a tenancy on Flat 3", exact: true }),
    ).toHaveCount(0);

    // Every row keeps its own edit link, so the count above is a statement about the new link
    // rather than about the row having lost its actions.
    await expect(units.getByRole("link", { name: /^Edit Flat / })).toHaveCount(3);

    await units.getByRole("link", { name: "Record a tenancy on Flat 2", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/landlord/leases/new\\?unitId=${vacantUnit?.id}$`));
    // The form arrived with that unit chosen, not merely with the id in the address.
    await expect(page.getByLabel("Unit")).toHaveValue(vacantUnit?.id as string);
    await expect(page.getByTestId("unit-occupancy")).toHaveText("Currently: Vacant");
  } finally {
    await removeEverything(portfolio.landlord.id, [tenant.id]);
  }
});
