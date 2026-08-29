/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createProperty, updateProperty, push } = vi.hoisted(() => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/propertyActions", () => ({ createProperty, updateProperty }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { PropertyForm } from "@/components/properties/PropertyForm";

const PROPERTY_ID = "11111111-1111-4111-8111-000000000001";

describe("PropertyForm", () => {
  beforeEach(() => {
    createProperty.mockReset();
    updateProperty.mockReset();
    push.mockReset();
    createProperty.mockResolvedValue({ status: "success", value: { propertyId: PROPERTY_ID } });
    updateProperty.mockResolvedValue({ status: "success", value: { propertyId: PROPERTY_ID } });
  });

  // UI-01
  it("renders every field with a label, and says the postal code is optional", () => {
    render(<PropertyForm mode="create" />);

    expect(screen.getByLabelText("Name")).toBeVisible();
    expect(screen.getByLabelText("Street and number")).toBeVisible();
    expect(screen.getByLabelText("City")).toBeVisible();
    expect(screen.getByLabelText("Postal code")).toBeVisible();
    expect(screen.getByText("Optional.")).toBeVisible();
  });

  // INV-11, UI-02
  it("refuses a name that is only spaces", async () => {
    const user = userEvent.setup();
    render(<PropertyForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "   ");
    await user.type(screen.getByLabelText("Street and number"), "Rothschild Boulevard 12");
    await user.type(screen.getByLabelText("City"), "Tel Aviv-Yafo");
    await user.click(screen.getByRole("button", { name: "Add property" }));

    expect(await screen.findByText("Give the building a name you will recognise.")).toBeVisible();
    expect(createProperty).not.toHaveBeenCalled();
  });

  it("adds a building and opens it", async () => {
    const user = userEvent.setup();
    render(<PropertyForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Rothschild 12");
    await user.type(screen.getByLabelText("Street and number"), "Rothschild Boulevard 12");
    await user.type(screen.getByLabelText("City"), "Tel Aviv-Yafo");
    await user.click(screen.getByRole("button", { name: "Add property" }));

    await vi.waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/landlord/properties/${PROPERTY_ID}`),
    );
  });

  // CORE-03
  it("starts an edit from the values already recorded, and saves through the edit action", async () => {
    const user = userEvent.setup();
    render(
      <PropertyForm
        mode="edit"
        propertyId={PROPERTY_ID}
        initialValues={{
          name: "Rothschild 12",
          addressLine: "Rothschild Boulevard 12",
          city: "Tel Aviv-Yafo",
          postalCode: "6688212",
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Rothschild 12");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Rothschild 12, north");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(1));
    expect(updateProperty).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: PROPERTY_ID, name: "Rothschild 12, north" }),
    );
    expect(createProperty).not.toHaveBeenCalled();
  });
});
