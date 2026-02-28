// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Kbd } from "./kbd";

describe("Kbd", () => {
  // Verifies kbd renders with text content.
  it("renders with text content", () => {
    render(<Kbd>Ctrl+C</Kbd>);
    expect(screen.getByText("Ctrl+C")).toBeTruthy();
  });

  // Confirms data-slot attribute is set.
  it('has data-slot="kbd"', () => {
    render(<Kbd>K</Kbd>);
    const el = screen.getByText("K");
    expect(el.getAttribute("data-slot")).toBe("kbd");
  });

  // Verifies it renders as a <kbd> element.
  it("renders as a kbd element", () => {
    render(<Kbd>Enter</Kbd>);
    const el = screen.getByText("Enter");
    expect(el.tagName).toBe("KBD");
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<Kbd>Escape</Kbd>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
