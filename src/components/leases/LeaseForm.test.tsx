/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createLease, push } = vi.hoisted(() => ({ createLease: vi.fn(), push: vi.fn() }));

vi.mock("@/actions/leaseActions", () => ({ createLease }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LeaseForm, type UnitChoice } from "@/components/leases/LeaseForm";

const UNITS: UnitChoice[] = [
  {
    unitId: "11111111-1111-4111-8111-000000000001",
    label: "Flat 1",
    propertyName: "Rothschild 12",
    occupancy: "Maya Levi, until 2026-12-31",
  },
  {
    unitId: "22222222-2222-4222-8222-000000000002",
    label: "Flat 2",
    propertyName: "Rothschild 12",
    occupancy: "Vacant",
  },
];

async function fillInAValidTenancy(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Starts on"), "2027-01-01");
  await user.type(screen.getByLabelText("Ends on"), "2027-12-31");
  await user.type(screen.getByLabelText("Monthly rent"), "6500");
  await user.clear(screen.getByLabelText("Rent due on day"));
  await user.type(screen.getByLabelText("Rent due on day"), "10");
}

describe("LeaseForm", () => {
  beforeEach(() => {
    createLease.mockReset();
    push.mockReset();
    createLease.mockResolvedValue({ status: "success", value: { leaseId: "the-new-lease" } });
  });

  // UI-01
  it("renders every field a tenancy needs, each with a label", () => {
    render(<LeaseForm units={UNITS} />);

    expect(screen.getByLabelText("Unit")).toBeVisible();
    expect(screen.getByLabelText("Starts on")).toBeVisible();
    expect(screen.getByLabelText("Ends on")).toBeVisible();
    expect(screen.getByLabelText("Monthly rent")).toBeVisible();
    expect(screen.getByLabelText("Deposit")).toBeVisible();
    expect(screen.getByLabelText("Rent due on day")).toBeVisible();
    expect(screen.getByRole("button", { name: "Record tenancy" })).toBeVisible();
  });

  it("says the end date belongs to the tenant, which is the rule landlords get wrong", () => {
    render(<LeaseForm units={UNITS} />);

    expect(screen.getByText(/That day belongs to this tenant/)).toBeVisible();
  });

  it("shows what the chosen unit is currently doing", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    expect(screen.getByTestId("unit-occupancy")).toHaveTextContent("Maya Levi, until 2026-12-31");

    await user.selectOptions(screen.getByLabelText("Unit"), "22222222-2222-4222-8222-000000000002");

    expect(screen.getByTestId("unit-occupancy")).toHaveTextContent("Vacant");
  });

  it("starts on the unit the landlord arrived with", () => {
    render(<LeaseForm units={UNITS} preselectedUnitId="22222222-2222-4222-8222-000000000002" />);

    expect(screen.getByLabelText("Unit")).toHaveValue("22222222-2222-4222-8222-000000000002");
    expect(screen.getByTestId("unit-occupancy")).toHaveTextContent("Vacant");
  });

  // UI-02
  it("refuses an empty form without asking the server", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    // Both date fields are empty, so both say so.
    expect(await screen.findAllByText("Enter a date as YYYY-MM-DD.")).toHaveLength(2);
    expect(createLease).not.toHaveBeenCalled();
  });

  // INV-23
  it("refuses a tenancy that ends before it starts, against the end date", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    await user.type(screen.getByLabelText("Starts on"), "2027-06-01");
    await user.type(screen.getByLabelText("Ends on"), "2027-01-01");
    await user.type(screen.getByLabelText("Monthly rent"), "6500");
    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    expect(await screen.findByText("The end date must be after the start date.")).toBeVisible();
    expect(createLease).not.toHaveBeenCalled();
  });

  // INV-31
  it("refuses a rent due day that some months do not have", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    await fillInAValidTenancy(user);
    await user.clear(screen.getByLabelText("Rent due on day"));
    await user.type(screen.getByLabelText("Rent due on day"), "31");
    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    expect(
      await screen.findByText("Choose a day between 1 and 28, so that every month has one."),
    ).toBeVisible();
    expect(createLease).not.toHaveBeenCalled();
  });

  it("refuses a rent of nothing", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    await user.type(screen.getByLabelText("Starts on"), "2027-01-01");
    await user.type(screen.getByLabelText("Ends on"), "2027-12-31");
    await user.type(screen.getByLabelText("Monthly rent"), "0");
    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    expect(await screen.findByText("Enter an amount above zero.")).toBeVisible();
  });

  /**
   * The amount is sent as it was typed. The server parses it with the same schema, and that run is
   * the one that decides; sending it a number would hand it something it does not expect.
   */
  it("sends what the landlord typed, and goes to the new tenancy", async () => {
    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} preselectedUnitId="22222222-2222-4222-8222-000000000002" />);

    await fillInAValidTenancy(user);
    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    await vi.waitFor(() => expect(createLease).toHaveBeenCalledTimes(1));
    expect(createLease).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "22222222-2222-4222-8222-000000000002",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        rentAmount: "6500",
        rentDueDay: 10,
      }),
    );
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/landlord/leases/the-new-lease"));
  });

  // UI-03, at the level where the message is rendered.
  it("shows a refusal from the server, and puts the dates message on the start date", async () => {
    createLease.mockResolvedValue({
      status: "error",
      message:
        "This unit is already let from 2025-12-01 to 2026-12-31. Both of those days belong to that tenancy, so a new one can start on 2027-01-01 at the earliest.",
      fieldErrors: { startDate: "Occupied until 2026-12-31. Free from 2027-01-01." },
    });

    const user = userEvent.setup();
    render(<LeaseForm units={UNITS} />);

    await fillInAValidTenancy(user);
    await user.click(screen.getByRole("button", { name: "Record tenancy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already let from 2025-12-01/);
    expect(screen.getByText("Occupied until 2026-12-31. Free from 2027-01-01.")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });
});
