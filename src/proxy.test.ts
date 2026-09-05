import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the proxy does when the profiles read does not come back.
 *
 * Two states look identical if the error is discarded: an account that genuinely has no profile row,
 * which cannot be given a role and has to be signed out, and a database that did not answer just
 * now, which says nothing about the account. Conflating them means a momentary PostgREST failure
 * revokes every refresh token the user holds, on every device, and tells them their account is
 * broken.
 *
 * That is not hypothetical for this deployment. The Supabase project is on the free tier, cold
 * starts are expected, and there is a scheduled workflow whose only job is keeping the database
 * awake.
 */
const { getUser, signOut, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/middlewareClient", () => ({
  createSupabaseMiddlewareClient: (request: NextRequest) => ({
    supabaseClient: {
      auth: { getUser, signOut },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    },
    getResponse: () => NextResponse.next({ request }),
  }),
}));

const { proxy } = await import("@/proxy");

const SIGNED_IN_USER = { id: "11111111-1111-4111-8111-000000000001" };

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://example.test"));
}

/** A redirect carries the destination in its location header; a pass-through does not redirect. */
function destinationOf(response: NextResponse): string | null {
  return response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
}

beforeEach(() => {
  getUser.mockReset();
  signOut.mockReset();
  maybeSingle.mockReset();
  getUser.mockResolvedValue({ data: { user: SIGNED_IN_USER }, error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("when the profiles read fails", () => {
  /**
   * The request carries on untouched. Whatever is wrong with the database is still wrong when the
   * layout reads the same row a moment later, and that path already renders the error boundary, so
   * nothing here needs to decide anything. What matters is that the session survives.
   */
  it("does not sign the user out", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "JWT expired or the service did not answer" },
    });

    const response = await proxy(requestFor("/landlord"));

    expect(signOut).not.toHaveBeenCalled();
    expect(destinationOf(response)).toBeNull();
  });

  /**
   * A statement timeout is the shape a cold start takes. The request is allowed to carry on to the
   * page it asked for rather than being answered with the sentence that tells somebody their account
   * was never set up properly.
   */
  it("lets the request carry on instead of answering it with the profile-missing page", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });

    const response = await proxy(requestFor("/tenant/payments"));

    expect(response.status).toBe(200);
    expect(destinationOf(response)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("when the account genuinely has no profile row", () => {
  /**
   * Unchanged behaviour, and the reason it has to stay: an account with no profile has no role, so
   * there is no area of the product it belongs in.
   */
  it("still signs the user out and says so", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await proxy(requestFor("/landlord"));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(destinationOf(response)).toContain("/login?problem=profile-missing");
  });
});

describe("when the profile reads back normally", () => {
  it("routes on the role, without signing anybody out", async () => {
    maybeSingle.mockResolvedValue({
      data: { role: "tenant", must_change_password: false },
      error: null,
    });

    const insideOwnArea = await proxy(requestFor("/tenant"));
    expect(destinationOf(insideOwnArea)).toBeNull();

    const insideTheOtherArea = await proxy(requestFor("/landlord/rent"));
    expect(destinationOf(insideTheOtherArea)).toContain("/tenant");

    expect(signOut).not.toHaveBeenCalled();
  });
});
