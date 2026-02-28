// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";

describe("InputGroup", () => {
  // Verifies that a full InputGroup composition renders correctly with all sub-components.
  it("renders a full input group composition", () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>Prefix</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="search" aria-label="Search" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    );
    expect(screen.getByPlaceholderText("search")).toBeTruthy();
    expect(screen.getByText("Prefix")).toBeTruthy();
    expect(screen.getByText("Go")).toBeTruthy();
  });

  // Confirms the root InputGroup element has the correct data-slot attribute.
  it('has data-slot="input-group"', () => {
    const { container } = render(
      <InputGroup>
        <InputGroupInput placeholder="test" aria-label="Test" />
      </InputGroup>,
    );
    const el = container.querySelector('[data-slot="input-group"]');
    expect(el).toBeTruthy();
  });

  // Ensures the base "input-moku-group" CSS class is present on the group wrapper.
  it("has input-moku-group class", () => {
    const { container } = render(
      <InputGroup>
        <InputGroupInput placeholder="test" aria-label="Test" />
      </InputGroup>,
    );
    const el = container.querySelector('[data-slot="input-group"]');
    expect(el?.className).toContain("input-moku-group");
  });

  // Verifies that InputGroupTextarea renders a textarea inside the group.
  it("renders InputGroupTextarea", () => {
    render(
      <InputGroup>
        <InputGroupTextarea placeholder="notes" aria-label="Notes" />
      </InputGroup>,
    );
    expect(screen.getByPlaceholderText("notes")).toBeTruthy();
  });

  // Runs axe accessibility audit on a full composition to catch a11y issues.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>Label</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="value" aria-label="Value" />
      </InputGroup>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
