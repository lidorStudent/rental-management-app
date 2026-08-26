/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitMaintenanceRequest, push } = vi.hoisted(() => ({
  submitMaintenanceRequest: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/maintenanceRequestActions", () => ({ submitMaintenanceRequest }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { MaintenanceRequestForm } from "@/components/maintenance/MaintenanceRequestForm";

const REQUEST_ID = "55555555-5555-4555-8555-000000000001";

describe("MaintenanceRequestForm", () => {
  beforeEach(() => {
    submitMaintenanceRequest.mockReset();
    push.mockReset();
    submitMaintenanceRequest.mockResolvedValue({
      status: "success",
      value: { requestId: REQUEST_ID },
    });
  });

  // UI-01
  it("asks for a title, a description and an urgency, and nothing else", () => {
    render(<MaintenanceRequestForm />);

    expect(screen.getByLabelText("What is wrong")).toBeVisible();
    expect(screen.getByLabelText("Describe it")).toBeVisible();
    expect(screen.getByLabelText("How urgent is it")).toBeVisible();
    expect(screen.queryByLabelText(/lease|unit|landlord/i)).toBeNull();
  });

  // INV-45
  it("refuses a title too short to recognise in a list", async () => {
    const user = userEvent.setup();
    render(<MaintenanceRequestForm />);

    await user.type(screen.getByLabelText("What is wrong"), "Ta");
    await user.type(screen.getByLabelText("Describe it"), "The tap in the kitchen drips all day.");
    await user.click(screen.getByRole("button", { name: "Report this problem" }));

    expect(await screen.findByText("Give the problem a short title.")).toBeVisible();
    expect(submitMaintenanceRequest).not.toHaveBeenCalled();
  });

  // INV-46: a request nobody can act on is the failure this product exists to remove.
  it("refuses a description too short to act on", async () => {
    const user = userEvent.setup();
    render(<MaintenanceRequestForm />);

    await user.type(screen.getByLabelText("What is wrong"), "Kitchen tap");
    await user.type(screen.getByLabelText("Describe it"), "broken");
    await user.click(screen.getByRole("button", { name: "Report this problem" }));

    expect(
      await screen.findByText("Describe the problem in a sentence, so it can be acted on."),
    ).toBeVisible();
    expect(submitMaintenanceRequest).not.toHaveBeenCalled();
  });

  it("reports a problem and opens it, so the tenant can follow what happens", async () => {
    const user = userEvent.setup();
    render(<MaintenanceRequestForm />);

    await user.type(screen.getByLabelText("What is wrong"), "Kitchen tap drips");
    await user.type(
      screen.getByLabelText("Describe it"),
      "The mixer tap drips even when closed tightly, and it is getting worse.",
    );
    await user.selectOptions(screen.getByLabelText("How urgent is it"), "urgent");
    await user.click(screen.getByRole("button", { name: "Report this problem" }));

    await vi.waitFor(() => expect(submitMaintenanceRequest).toHaveBeenCalledTimes(1));
    expect(submitMaintenanceRequest).toHaveBeenCalledWith({
      title: "Kitchen tap drips",
      description: "The mixer tap drips even when closed tightly, and it is getting worse.",
      urgency: "urgent",
    });
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/tenant/maintenance/${REQUEST_ID}`));
  });

  /**
   * A tenancy that has ended is refused by the server, because only the server knows the dates.
   * The tenant is told which of the reasons applies rather than shown an error.
   */
  it("shows the reason when there is no tenancy to report against", async () => {
    submitMaintenanceRequest.mockResolvedValue({
      status: "error",
      message: "Your tenancy ended on 2026-06-30. Your rent history stays here.",
    });

    const user = userEvent.setup();
    render(<MaintenanceRequestForm />);

    await user.type(screen.getByLabelText("What is wrong"), "Kitchen tap drips");
    await user.type(
      screen.getByLabelText("Describe it"),
      "The mixer tap drips even when closed tightly, and it is getting worse.",
    );
    await user.click(screen.getByRole("button", { name: "Report this problem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your tenancy ended on 2026-06-30.");
    expect(push).not.toHaveBeenCalled();
  });
});
