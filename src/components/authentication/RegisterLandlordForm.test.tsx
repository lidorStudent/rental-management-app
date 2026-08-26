/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerLandlordAccount } = vi.hoisted(() => ({ registerLandlordAccount: vi.fn() }));

vi.mock("@/actions/authenticationActions", () => ({ registerLandlordAccount }));

import { RegisterLandlordForm } from "@/components/authentication/RegisterLandlordForm";

describe("RegisterLandlordForm", () => {
  beforeEach(() => {
    registerLandlordAccount.mockReset();
    registerLandlordAccount.mockResolvedValue({ status: "success", value: undefined });
  });

  // UI-01
  it("renders every field with a label and says what a password must contain", () => {
    render(<RegisterLandlordForm />);

    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
    expect(screen.getByLabelText("Password", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("Repeat password")).toBeVisible();
    expect(
      screen.getByText(
        "At least 10 characters, with an uppercase letter, a lowercase letter and a digit.",
      ),
    ).toBeVisible();
  });

  // INV-01
  it("refuses a name of one character", async () => {
    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Full name"), "A");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter a full name.")).toBeVisible();
    expect(registerLandlordAccount).not.toHaveBeenCalled();
  });

  // INV-03
  it("refuses an address that is not an email address", async () => {
    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Email address"), "not-an-address");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
  });

  // INV-05
  it("refuses a password shorter than the policy allows", async () => {
    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Password", { exact: true }), "Short1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Use at least 10 characters.")).toBeVisible();
  });

  // INV-07
  it("refuses two passwords that do not match, against the second one", async () => {
    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Full name"), "Noa Ben-David");
    await user.type(screen.getByLabelText("Email address"), "noa@example.co.il");
    await user.type(screen.getByLabelText("Password", { exact: true }), "GoodPassword1");
    await user.type(screen.getByLabelText("Repeat password"), "SomethingElse1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("The two passwords do not match.")).toBeVisible();
    expect(registerLandlordAccount).not.toHaveBeenCalled();
  });

  it("sends a complete registration to the server", async () => {
    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Full name"), "Noa Ben-David");
    await user.type(screen.getByLabelText("Email address"), "noa@example.co.il");
    await user.type(screen.getByLabelText("Password", { exact: true }), "GoodPassword1");
    await user.type(screen.getByLabelText("Repeat password"), "GoodPassword1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await vi.waitFor(() => expect(registerLandlordAccount).toHaveBeenCalledTimes(1));
  });

  /**
   * INV-10. The message must not confirm whether an address already has an account, so the form
   * shows whatever the server said and nothing more helpful.
   */
  it("shows a refusal that does not say whether the address is already registered", async () => {
    registerLandlordAccount.mockResolvedValue({
      status: "error",
      message:
        "That email address cannot be used to register. If you already have an account, sign in instead.",
    });

    const user = userEvent.setup();
    render(<RegisterLandlordForm />);

    await user.type(screen.getByLabelText("Full name"), "Noa Ben-David");
    await user.type(screen.getByLabelText("Email address"), "taken@example.co.il");
    await user.type(screen.getByLabelText("Password", { exact: true }), "GoodPassword1");
    await user.type(screen.getByLabelText("Repeat password"), "GoodPassword1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email address cannot be used to register.",
    );
  });
});
