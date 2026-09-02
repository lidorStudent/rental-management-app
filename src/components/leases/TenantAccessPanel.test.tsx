/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTenantAccountForLease, regenerateTenantPassword, refresh } = vi.hoisted(() => ({
  createTenantAccountForLease: vi.fn(),
  regenerateTenantPassword: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/actions/tenantAccountActions", () => ({
  createTenantAccountForLease,
  regenerateTenantPassword,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

import { TenantAccessPanel } from "@/components/leases/TenantAccessPanel";

const LEASE_ID = "33333333-3333-4333-8333-000000000001";

describe("TenantAccessPanel", () => {
  beforeEach(() => {
    createTenantAccountForLease.mockReset();
    regenerateTenantPassword.mockReset();
    refresh.mockReset();
    createTenantAccountForLease.mockResolvedValue({
      status: "success",
      value: { temporaryPassword: "Kp7mRt3xQw9zBn", tenantEmail: "maya.levi@example.co.il" },
    });
  });

  it("asks for the tenant's name and email when the lease has no account yet", () => {
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    expect(screen.getByLabelText("Tenant name")).toBeVisible();
    expect(screen.getByLabelText("Tenant email")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create the tenant account" })).toBeVisible();
  });

  // INV-51
  it("refuses a tenant name of one character", async () => {
    const user = userEvent.setup();
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    await user.type(screen.getByLabelText("Tenant name"), "A");
    await user.type(screen.getByLabelText("Tenant email"), "maya.levi@example.co.il");
    await user.click(screen.getByRole("button", { name: "Create the tenant account" }));

    expect(await screen.findByText("Enter a full name.")).toBeVisible();
    expect(createTenantAccountForLease).not.toHaveBeenCalled();
  });

  it("refuses an address that is not an email address", async () => {
    const user = userEvent.setup();
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    await user.type(screen.getByLabelText("Tenant name"), "Maya Levi");
    await user.type(screen.getByLabelText("Tenant email"), "not-an-address");
    await user.click(screen.getByRole("button", { name: "Create the tenant account" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
  });

  /**
   * CORE-12 and CORE-13, at the level where the wording lives. There is no email service in this
   * product, so the landlord is handed the password once and told plainly that nothing stores it.
   */
  it("shows the temporary password once, and says it cannot be shown again", async () => {
    const user = userEvent.setup();
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    await user.type(screen.getByLabelText("Tenant name"), "Maya Levi");
    await user.type(screen.getByLabelText("Tenant email"), "maya.levi@example.co.il");
    await user.click(screen.getByRole("button", { name: "Create the tenant account" }));

    expect(await screen.findByTestId("temporary-password")).toHaveTextContent("Kp7mRt3xQw9zBn");
    expect(screen.getByText(/It is shown once and cannot be shown again/)).toBeVisible();
    expect(screen.getByText(/maya.levi@example.co.il/)).toBeVisible();
    expect(screen.getByText(/must choose their own password the first time/)).toBeVisible();
  });

  it("puts the password away when the landlord says they have passed it on", async () => {
    const user = userEvent.setup();
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    await user.type(screen.getByLabelText("Tenant name"), "Maya Levi");
    await user.type(screen.getByLabelText("Tenant email"), "maya.levi@example.co.il");
    await user.click(screen.getByRole("button", { name: "Create the tenant account" }));
    await screen.findByTestId("temporary-password");

    await user.click(screen.getByRole("button", { name: "I have given it to them" }));

    expect(screen.queryByTestId("temporary-password")).toBeNull();
  });

  // INV-50
  it("shows a refusal that does not say whether the address already has an account", async () => {
    createTenantAccountForLease.mockResolvedValue({
      status: "error",
      message: "That email address cannot be used for a tenant account.",
      fieldErrors: { tenantEmail: "That email address cannot be used for a tenant account." },
    });

    const user = userEvent.setup();
    render(<TenantAccessPanel leaseId={LEASE_ID} tenant={null} />);

    await user.type(screen.getByLabelText("Tenant name"), "Maya Levi");
    await user.type(screen.getByLabelText("Tenant email"), "taken@example.co.il");
    await user.click(screen.getByRole("button", { name: "Create the tenant account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email address cannot be used for a tenant account.",
    );
    expect(screen.queryByTestId("temporary-password")).toBeNull();
  });

  it("shows who the tenant is once an account exists, and offers a reset rather than a reveal", () => {
    render(
      <TenantAccessPanel
        leaseId={LEASE_ID}
        tenant={{
          fullName: "Maya Levi",
          email: "maya.levi@example.co.il",
          mustChangePassword: true,
        }}
      />,
    );

    expect(screen.getByText("Maya Levi")).toBeVisible();
    expect(screen.getByText("Temporary, not yet changed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Issue a new temporary password" })).toBeVisible();
    expect(screen.queryByTestId("temporary-password")).toBeNull();
  });

  // CORE-14: with no email service, the landlord is the reset mechanism.
  it("shows a fresh password once when one is reissued", async () => {
    regenerateTenantPassword.mockResolvedValue({
      status: "success",
      value: { temporaryPassword: "Zq4vLm8nHt2cWk", tenantEmail: "maya.levi@example.co.il" },
    });

    const user = userEvent.setup();
    render(
      <TenantAccessPanel
        leaseId={LEASE_ID}
        tenant={{
          fullName: "Maya Levi",
          email: "maya.levi@example.co.il",
          mustChangePassword: false,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Issue a new temporary password" }));

    expect(await screen.findByTestId("temporary-password")).toHaveTextContent("Zq4vLm8nHt2cWk");
  });
});
