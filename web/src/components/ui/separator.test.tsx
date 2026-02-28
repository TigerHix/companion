// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "./separator";

describe("Separator", () => {
  // Verifies horizontal separator renders with data-slot.
  it("renders horizontal separator", () => {
    const { container } = render(<Separator />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toBeTruthy();
    expect(el?.className).toContain("h-px");
    expect(el?.className).toContain("w-full");
  });

  // Verifies vertical separator renders with correct classes.
  it("renders vertical separator", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el?.className).toContain("h-full");
    expect(el?.className).toContain("w-px");
  });

  // Decorative mode should have role="none".
  it('decorative mode has role="none"', () => {
    const { container } = render(<Separator decorative />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el?.getAttribute("role")).toBe("none");
  });

  // Non-decorative mode should have role="separator".
  it('non-decorative mode has role="separator"', () => {
    const { container } = render(<Separator decorative={false} />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el?.getAttribute("role")).toBe("separator");
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<Separator />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
