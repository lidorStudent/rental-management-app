/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SelectField } from "@/components/forms/SelectField";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { TextField } from "@/components/forms/TextField";

/**
 * A field's error has to be announced with the field, not merely rendered under it. Somebody
 * navigating by keyboard hears the label, then that the value is invalid, then why; without the
 * association they hear the first two and are left to guess.
 */
describe("a field with an error", () => {
  it("points the input at its own message, so a screen reader reads them together", () => {
    render(<TextField label="City" name="city" error="Enter the city." />);

    const input = screen.getByLabelText("City");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter the city.");
  });

  it("reads the hint and the error together when a field has both", () => {
    render(
      <TextField
        label="Monthly rent"
        name="rentAmount"
        hint="In shekels."
        error="Enter an amount above zero."
      />,
    );

    expect(screen.getByLabelText("Monthly rent")).toHaveAccessibleDescription(
      "In shekels. Enter an amount above zero.",
    );
  });

  it("describes a field by its hint alone when nothing is wrong", () => {
    render(<TextField label="Postal code" name="postalCode" hint="Optional." />);

    const input = screen.getByLabelText("Postal code");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAccessibleDescription("Optional.");
  });

  it("does the same for a description box", () => {
    render(
      <TextAreaField
        label="Describe it"
        name="description"
        error="Describe the problem in a sentence, so it can be acted on."
      />,
    );

    expect(screen.getByLabelText("Describe it")).toHaveAccessibleDescription(
      "Describe the problem in a sentence, so it can be acted on.",
    );
  });

  it("does the same for a select", () => {
    render(
      <SelectField
        label="How it arrived"
        name="method"
        options={[{ value: "cash", label: "Cash" }]}
        error="Choose how the money arrived."
      />,
    );

    expect(screen.getByLabelText("How it arrived")).toHaveAccessibleDescription(
      "Choose how the money arrived.",
    );
  });
});
