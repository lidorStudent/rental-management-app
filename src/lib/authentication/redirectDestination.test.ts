import { describe, expect, it } from "vitest";

import {
  isPublicPath,
  redirectDestinationForSignedInUser,
} from "@/lib/authentication/redirectDestination";

/**
 * The routing rules the proxy applies on every request, tested without a request.
 *
 * The proxy itself is thin on purpose: it reads the session, reads the role, and asks this function
 * where the request may go. Everything worth getting right is here, so this is where it is checked.
 * The end-to-end suite proves the same rules through a browser; these tests are what say which rule
 * is wrong when one of those fails.
 */
describe("which paths are public", () => {
  // PERM-29
  it("lets exactly two paths through without a session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
  });

  // PERM-28
  it("treats everything else as protected, including the root and unknown paths", () => {
    for (const path of ["/", "/landlord", "/tenant", "/change-password", "/nothing-here"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("does not treat a path that merely begins with a public one as public", () => {
    expect(isPublicPath("/login/extra")).toBe(false);
    expect(isPublicPath("/registered")).toBe(false);
  });
});

describe("a user who must change their password", () => {
  it("is sent to the change-password page from anywhere else", () => {
    for (const path of ["/", "/tenant", "/tenant/payments", "/landlord", "/login"]) {
      expect(redirectDestinationForSignedInUser(path, "tenant", true)).toBe("/change-password");
    }
  });

  it("is left alone once they are on it", () => {
    expect(redirectDestinationForSignedInUser("/change-password", "tenant", true)).toBeNull();
  });

  it("is held there whichever role they have", () => {
    expect(redirectDestinationForSignedInUser("/landlord", "landlord", true)).toBe(
      "/change-password",
    );
  });
});

describe("a signed-in landlord", () => {
  it("is sent home from the root and from the two public pages", () => {
    for (const path of ["/", "/login", "/register"]) {
      expect(redirectDestinationForSignedInUser(path, "landlord", false)).toBe("/landlord");
    }
  });

  // PERM-26, in the direction the tenant test does not cover
  it("is sent home from the tenant area", () => {
    for (const path of ["/tenant", "/tenant/payments", "/tenant/maintenance/anything"]) {
      expect(redirectDestinationForSignedInUser(path, "landlord", false)).toBe("/landlord");
    }
  });

  it("is left alone inside their own area and on the change-password page", () => {
    for (const path of ["/landlord", "/landlord/rent", "/change-password"]) {
      expect(redirectDestinationForSignedInUser(path, "landlord", false)).toBeNull();
    }
  });
});

describe("a signed-in tenant", () => {
  it("is sent home from the root and from the two public pages", () => {
    for (const path of ["/", "/login", "/register"]) {
      expect(redirectDestinationForSignedInUser(path, "tenant", false)).toBe("/tenant");
    }
  });

  // PERM-26
  it("is sent home from the landlord area, however deep the path", () => {
    for (const path of ["/landlord", "/landlord/rent", "/landlord/leases/any-id/statement"]) {
      expect(redirectDestinationForSignedInUser(path, "tenant", false)).toBe("/tenant");
    }
  });

  it("is left alone inside their own area", () => {
    for (const path of ["/tenant", "/tenant/lease", "/tenant/statement"]) {
      expect(redirectDestinationForSignedInUser(path, "tenant", false)).toBeNull();
    }
  });
});

describe("a path in neither area", () => {
  /**
   * Nothing is redirected: an unknown path belongs to Next.js, which answers it with the not-found
   * page. Sending it home instead would hide a broken link behind a silent redirect.
   */
  it("is left to the framework to answer", () => {
    expect(redirectDestinationForSignedInUser("/nothing-here", "landlord", false)).toBeNull();
    expect(redirectDestinationForSignedInUser("/nothing-here", "tenant", false)).toBeNull();
  });
});
