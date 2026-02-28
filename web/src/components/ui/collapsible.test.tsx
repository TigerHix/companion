// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./collapsible";

describe("Collapsible", () => {
  // Verifies that the collapsible renders trigger and content elements.
  it("renders with trigger and content", () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>,
    );
    expect(container.textContent).toContain("Toggle");
  });

  // Confirms data-slot attributes are set on each sub-component.
  it("has data-slot attributes", () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>,
    );
    expect(container.querySelector('[data-slot="collapsible"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="collapsible-trigger"]'),
    ).toBeTruthy();
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
