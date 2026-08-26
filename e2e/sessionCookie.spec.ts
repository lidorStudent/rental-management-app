import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  createLease,
  createPortfolio,
  createTenantAccount,
  endOfMonth,
  monthsFromNow,
  removeEverything,
  signIn,
  signOut,
  type CreatedAccount,
  type Portfolio,
} from "./support/portfolio";

/**
 * The session cookie itself, rather than what it lets somebody reach.
 *
 * @supabase/ssr writes that cookie without the HTTP-only flag, so that its browser client can read
 * the session back out of document.cookie. This project has no browser client and overrides the
 * flags in src/lib/supabase/sessionCookieOptions.ts, which is a deliberate departure from a
 * library default and therefore worth a test that fails if somebody puts the default back.
 *
 * The cookie holds the refresh token as well as the access token, so a script that could read it
 * could keep the session alive long after the page was closed.
 */
type SessionCookie = Awaited<ReturnType<BrowserContext["cookies"]>>[number];

/** Only production gets the secure flag, and the dev server this suite drives is plain HTTP. */
const addressUnderTest = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
const expectedSecureFlag = addressUnderTest.protocol === "https:";

let portfolio: Portfolio;
let tenant: CreatedAccount;

test.beforeEach(async () => {
  portfolio = await createPortfolio();
  tenant = await createTenantAccount(false);
  await createLease({
    portfolio,
    tenantId: tenant.id,
    startDate: monthsFromNow(-1),
    endDate: endOfMonth(10),
  });
});

test.afterEach(async () => {
  await removeEverything(portfolio.landlord.id, [tenant.id]);
});

function sessionCookies(cookies: SessionCookie[]): SessionCookie[] {
  return cookies.filter((cookie) => cookie.name.includes("auth-token"));
}

async function expectTheSessionToBeHardenedAndUnreadable(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  const cookies = sessionCookies(await context.cookies());
  expect(cookies.length).toBeGreaterThan(0);

  for (const cookie of cookies) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(expectedSecureFlag);
    expect(cookie.sameSite).toBe("Lax");
  }

  const readableByScript = await page.evaluate(() => document.cookie);
  expect(readableByScript).not.toContain("auth-token");
  expect(readableByScript).not.toContain("access_token");
  expect(readableByScript).not.toContain("refresh_token");
}

// PERM-32
test("a landlord's session cannot be read by script, and signing out ends it", async ({
  page,
  context,
}) => {
  await signIn(page, portfolio.landlord.email);
  await expect(page).toHaveURL(/\/landlord$/);

  await expectTheSessionToBeHardenedAndUnreadable(page, context);

  // The server still reads what the page cannot, or this would be a broken session rather than a
  // protected one.
  await page.goto("/landlord/properties");
  await expect(page.getByRole("cell", { name: portfolio.propertyName })).toBeVisible();

  await signOut(page);
  expect(sessionCookies(await context.cookies())).toHaveLength(0);

  await page.goto("/landlord");
  await expect(page).toHaveURL(/\/login/);
});

// PERM-33
test("a tenant's session cannot be read by script, and signing out ends it", async ({
  page,
  context,
}) => {
  await signIn(page, tenant.email);
  await expect(page).toHaveURL(/\/tenant$/);

  await expectTheSessionToBeHardenedAndUnreadable(page, context);

  await page.goto("/tenant/lease");
  await expect(page.getByText(portfolio.unitLabel)).toBeVisible();

  await signOut(page);
  expect(sessionCookies(await context.cookies())).toHaveLength(0);

  await page.goto("/tenant");
  await expect(page).toHaveURL(/\/login/);
});

// PERM-34
test("an expired access token is refreshed rather than signing the tenant out", async ({
  page,
  context,
}) => {
  await signIn(page, tenant.email);

  const cookies = sessionCookies(await context.cookies());
  // A session too large for one cookie is written in numbered chunks, which this test would have to
  // reassemble. It has never been chunked here; failing says so rather than testing the wrong value.
  expect(cookies).toHaveLength(1);
  const [original] = cookies;

  await context.addCookies([{ ...original, value: withAnExpiredAccessToken(original.value) }]);
  const planted = sessionCookies(await context.cookies())[0];
  expect(planted.value).not.toBe(original.value);

  await page.goto("/tenant");

  // The proxy noticed the session was stale, exchanged the refresh token and wrote the new session
  // back onto the response, so the page rendered signed in instead of redirecting to the login form.
  await expect(page).toHaveURL(/\/tenant$/);
  await expect(page.getByRole("heading", { name: "Your tenancy" })).toBeVisible();
  expect(sessionCookies(await context.cookies())[0].value).not.toBe(planted.value);
});

/**
 * Rewinds the expiry the session claims, leaving the refresh token untouched. Waiting for a real
 * access token to age out would mean waiting an hour.
 */
function withAnExpiredAccessToken(cookieValue: string): string {
  const encoded = cookieValue.replace(/^base64-/, "");
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The session cookie did not contain a session object.");
  }

  const expired = { ...parsed, expires_at: Math.floor(Date.now() / 1000) - 60, expires_in: 0 };
  return `base64-${Buffer.from(JSON.stringify(expired)).toString("base64url")}`;
}
