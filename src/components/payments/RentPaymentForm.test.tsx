/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordRentPayment, correctRentPayment, push } = vi.hoisted(() => ({
  recordRentPayment: vi.fn(),
  correctRentPayment: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/rentPaymentActions", () => ({ recordRentPayment, correctRentPayment }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { RentPaymentForm } from "@/components/payments/RentPaymentForm";

const LEASE_ID = "33333333-3333-4333-8333-000000000001";
const PAYMENT_ID = "44444444-4444-4444-8444-000000000001";
const TODAY = "2026-08-25";
const PERIODS = [
  { periodMonth: "2026-07-01", label: "2026-07 - due 2026-07-10" },
  { periodMonth: "2026-08-01", label: "2026-08 - due 2026-08-10" },
];

function renderRecordForm() {
  return render(
    <RentPaymentForm
      mode="record"
      leaseId={LEASE_ID}
      periods={PERIODS}
      today={TODAY}
      defaultPeriodMonth="2026-07-01"
    />,
  );
}

describe("RentPaymentForm", () => {
  beforeEach(() => {
    recordRentPayment.mockReset();
    correctRentPayment.mockReset();
    push.mockReset();
    recordRentPayment.mockResolvedValue({ status: "success", value: { paymentId: PAYMENT_ID } });
    correctRentPayment.mockResolvedValue({ status: "success", value: { paymentId: PAYMENT_ID } });
  });

  // UI-01
  it("renders every field a payment needs, each with a label", () => {
    renderRecordForm();

    expect(screen.getByLabelText("For the month of")).toBeVisible();
    expect(screen.getByLabelText("Amount received")).toBeVisible();
    expect(screen.getByLabelText("Received on")).toBeVisible();
    expect(screen.getByLabelText("How it arrived")).toBeVisible();
    expect(screen.getByLabelText("Reference")).toBeVisible();
  });

  it("has no status field anywhere, because a landlord never types one", () => {
    renderRecordForm();

    expect(screen.queryByLabelText(/status/i)).toBeNull();
    for (const word of ["Paid", "Overdue", "Part paid"]) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });

  it("offers the oldest unsettled month first and today's date, which is the usual case", () => {
    renderRecordForm();

    expect(screen.getByLabelText("For the month of")).toHaveValue("2026-07-01");
    expect(screen.getByLabelText("Received on")).toHaveValue(TODAY);
  });

  it("says that part of a month's rent is a legitimate amount", () => {
    renderRecordForm();

    expect(screen.getByText(/Part of a month's rent is fine/)).toBeVisible();
  });

  // UI-02, INV-36
  it("refuses a payment of nothing without asking the server", async () => {
    const user = userEvent.setup();
    renderRecordForm();

    await user.type(screen.getByLabelText("Amount received"), "0");
    await user.click(screen.getByRole("button", { name: "Record this payment" }));

    expect(await screen.findByText("Enter an amount above zero.")).toBeVisible();
    expect(recordRentPayment).not.toHaveBeenCalled();
  });

  it("refuses an amount that is not money", async () => {
    const user = userEvent.setup();
    renderRecordForm();

    await user.type(screen.getByLabelText("Amount received"), "abc");
    await user.click(screen.getByRole("button", { name: "Record this payment" }));

    expect(await screen.findByText("Enter an amount such as 6500 or 6500.50.")).toBeVisible();
  });

  // INV-38: the schema is built with today, so this is decided without reading any clock.
  it("refuses money recorded as arriving in the future", async () => {
    const user = userEvent.setup();
    renderRecordForm();

    await user.type(screen.getByLabelText("Amount received"), "6500");
    await user.clear(screen.getByLabelText("Received on"));
    await user.type(screen.getByLabelText("Received on"), "2026-08-26");
    await user.click(screen.getByRole("button", { name: "Record this payment" }));

    expect(
      await screen.findByText("Record money that has arrived, not money you expect."),
    ).toBeVisible();
    expect(recordRentPayment).not.toHaveBeenCalled();
  });

  it("sends the amount as it was typed, and returns to the tenancy", async () => {
    const user = userEvent.setup();
    renderRecordForm();

    await user.type(screen.getByLabelText("Amount received"), "3,250.75");
    await user.selectOptions(screen.getByLabelText("How it arrived"), "cash");
    await user.click(screen.getByRole("button", { name: "Record this payment" }));

    await vi.waitFor(() => expect(recordRentPayment).toHaveBeenCalledTimes(1));
    expect(recordRentPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: LEASE_ID,
        periodMonth: "2026-07-01",
        amount: "3,250.75",
        receivedOn: TODAY,
        method: "cash",
      }),
    );
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/landlord/leases/${LEASE_ID}`));
  });

  it("shows a refusal from the server rather than navigating away", async () => {
    recordRentPayment.mockResolvedValue({
      status: "error",
      message: "That month is outside this tenancy.",
      fieldErrors: { periodMonth: "This lease runs from 2026-01-01 to 2026-06-30." },
    });

    const user = userEvent.setup();
    renderRecordForm();

    await user.type(screen.getByLabelText("Amount received"), "6500");
    await user.click(screen.getByRole("button", { name: "Record this payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That month is outside this tenancy.",
    );
    expect(screen.getByText("This lease runs from 2026-01-01 to 2026-06-30.")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });

  it("corrects an entry through the correction action, without naming a tenancy", async () => {
    const user = userEvent.setup();
    render(
      <RentPaymentForm
        mode="correct"
        paymentId={PAYMENT_ID}
        leaseId={LEASE_ID}
        periods={PERIODS}
        today={TODAY}
        defaultPeriodMonth="2026-07-01"
        initialValues={{
          leaseId: LEASE_ID,
          periodMonth: "2026-07-01",
          amount: "6500.00",
          receivedOn: "2026-07-10",
          method: "bank_transfer",
          reference: "Standing order 4471",
        }}
      />,
    );

    expect(screen.getByLabelText("Amount received")).toHaveValue("6500.00");

    await user.clear(screen.getByLabelText("Amount received"));
    await user.type(screen.getByLabelText("Amount received"), "2000");
    await user.click(screen.getByRole("button", { name: "Save the correction" }));

    await vi.waitFor(() => expect(correctRentPayment).toHaveBeenCalledTimes(1));
    const [sent] = correctRentPayment.mock.calls[0] as [Record<string, unknown>];
    expect(sent.paymentId).toBe(PAYMENT_ID);
    expect(sent.amount).toBe("2000");
    expect(sent).not.toHaveProperty("leaseId");
    expect(recordRentPayment).not.toHaveBeenCalled();
  });
});
