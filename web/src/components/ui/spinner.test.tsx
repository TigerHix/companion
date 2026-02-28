// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  // Verifies spinner renders with data-slot.
  it('has data-slot="spinner"', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('[data-slot="spinner"]')).toBeTruthy();
  });

  // Confirms the animate-spin class is applied for rotation animation.
  it("has animate-spin class", () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector('[data-slot="spinner"]');
    // SVG elements have SVGAnimatedString for className, use getAttribute instead
    expect(el?.getAttribute("class")).toContain("animate-spin");
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<Spinner />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
