// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Switch } from "./switch";

describe("Switch", () => {
  // Verifies the switch renders with the data-slot attribute.
  it('has data-slot="switch"', () => {
    const { container } = render(<Switch aria-label="Toggle" />);
    expect(container.querySelector('[data-slot="switch"]')).toBeTruthy();
  });

  // Verifies default size variant renders via data-size attribute.
  it("supports default size variant", () => {
    const { container } = render(<Switch aria-label="Default" />);
    const el = container.querySelector('[data-slot="switch"]');
    expect(el?.getAttribute("data-size")).toBe("default");
  });

  // Verifies sm size variant renders via data-size attribute.
  it("supports sm size variant", () => {
    const { container } = render(<Switch size="sm" aria-label="Small" />);
    const el = container.querySelector('[data-slot="switch"]');
    expect(el?.getAttribute("data-size")).toBe("sm");
  });

  // Validates disabled state is forwarded.
  it("supports disabled state", () => {
    const { container } = render(<Switch disabled aria-label="Disabled" />);
    const el = container.querySelector('[data-slot="switch"]');
    expect(el?.getAttribute("data-disabled")).not.toBeNull();
  });

  // Runs axe accessibility audit. Uses aria-label for accessible name since
  // base-ui Switch renders a <span role="switch"> that doesn't auto-associate
  // with wrapping <label> like native inputs do.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<Switch aria-label="Toggle feature" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
