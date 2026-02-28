// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea", () => {
  // Verifies scroll area renders children.
  it("renders children", () => {
    render(<ScrollArea>Scrollable content</ScrollArea>);
    expect(screen.getByText("Scrollable content")).toBeTruthy();
  });

  // Confirms data-slot attribute is set.
  it('has data-slot="scroll-area"', () => {
    const { container } = render(<ScrollArea>Content</ScrollArea>);
    expect(
      container.querySelector('[data-slot="scroll-area"]'),
    ).toBeTruthy();
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<ScrollArea>Content</ScrollArea>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
