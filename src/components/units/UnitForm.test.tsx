/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUnit, updateUnit, push } = vi.hoisted(() => ({
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/unitActions", () => ({ createUnit, updateUnit }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { UnitForm } from "@/components/units/UnitForm";

const PROPERTY_ID = "11111111-1111-4111-8111-000000000001";
const UNIT_ID = "22222222-2222-4222-8222-000000000001";

describe("UnitForm", () => {
  beforeEach(() => {
    createUnit.mockReset();
    updateUnit.mockReset();
    push.mockReset();
    createUnit.mockResolvedValue({ status: "success", value: { unitId: UNIT_ID } });
    updateUnit.mockResolvedValue({ status: "success", value: { unitId: UNIT_ID } });
  });

  // UI-01
  it("renders a label field and an optional bedroom count", () => {
    render(<UnitForm mode="create" propertyId={PROPERTY_ID} />);

    expect(screen.getByLabelText("Label")).toBeVisible();
    expect(screen.getByLabelText("Bedrooms")).toBeVisible();
    expect(screen.getByText(/Flat 2, Ground floor, Studio/)).toBeVisible();
  });

  // INV-17
  it("refuses a unit with no label", async () => {
    const user = userEvent.setup();
    render(<UnitForm mode="create" propertyId={PROPERTY_ID} />);

    await user.click(screen.getByRole("button", { name: "Add unit" }));

    expect(await screen.findByText("Give the unit a label, such as Flat 2.")).toBeVisible();
    expect(createUnit).not.toHaveBeenCalled();
  });

  // INV-21: an empty box means not recorded, which is not zero bedrooms.
  it("sends no bedroom count when the box was left empty", async () => {
    const user = userEvent.setup();
    render(<UnitForm mode="create" propertyId={PROPERTY_ID} />);

    await user.type(screen.getByLabelText("Label"), "Flat 2");
    await user.click(screen.getByRole("button", { name: "Add unit" }));

    await vi.waitFor(() => expect(createUnit).toHaveBeenCalledTimes(1));
    const [sent] = createUnit.mock.calls[0] as [Record<string, unknown>];
    expect(sent.label).toBe("Flat 2");
    expect(sent.bedroomCount).toBeUndefined();
    expect(sent.propertyId).toBe(PROPERTY_ID);
  });

  it("sends a bedroom count as a number when one was given", async () => {
    const user = userEvent.setup();
    render(<UnitForm mode="create" propertyId={PROPERTY_ID} />);

    await user.type(screen.getByLabelText("Label"), "Flat 2");
    await user.type(screen.getByLabelText("Bedrooms"), "3");
    await user.click(screen.getByRole("button", { name: "Add unit" }));

    await vi.waitFor(() => expect(createUnit).toHaveBeenCalledTimes(1));
    expect(createUnit).toHaveBeenCalledWith(expect.objectContaining({ bedroomCount: 3 }));
  });

  // INV-18: the duplicate label rule lives in the database, so the refusal arrives from the server.
  it("puts a duplicate label refusal on the label field", async () => {
    createUnit.mockResolvedValue({
      status: "error",
      message: "This property already has a unit with that label.",
      fieldErrors: { label: "This property already has a unit with that label." },
    });

    const user = userEvent.setup();
    render(<UnitForm mode="create" propertyId={PROPERTY_ID} />);

    await user.type(screen.getByLabelText("Label"), "Flat 1");
    await user.click(screen.getByRole("button", { name: "Add unit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This property already has a unit with that label.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("saves an edit through the edit action, returning to the building", async () => {
    const user = userEvent.setup();
    render(
      <UnitForm
        mode="edit"
        unitId={UNIT_ID}
        propertyId={PROPERTY_ID}
        initialValues={{ label: "Flat 1", bedroomCount: 3 }}
      />,
    );

    expect(screen.getByLabelText("Label")).toHaveValue("Flat 1");

    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Flat 1A");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    expect(updateUnit).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: UNIT_ID, label: "Flat 1A" }),
    );
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/landlord/properties/${PROPERTY_ID}`),
    );
  });
});
