/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/EmptyState";

describe("EmptyState", () => {
  it("says what is missing and what to do about it", () => {
    render(
      <EmptyState
        title="No properties yet"
        description="Add the first building, then the units inside it."
        action={{ label: "Add a property", href: "/landlord/properties/new" }}
      />,
    );

    expect(screen.getByText("No properties yet")).toBeVisible();
    expect(screen.getByText(/Add the first building/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Add a property" })).toHaveAttribute(
      "href",
      "/landlord/properties/new",
    );
  });

  it("leaves out the action when there is nothing the reader can do next", () => {
    render(
      <EmptyState
        title="No tenancy recorded yet"
        description="Your landlord adds your tenancy when your lease begins."
      />,
    );

    expect(screen.getByText("No tenancy recorded yet")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
