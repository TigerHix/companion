// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select";

describe("Select", () => {
  // Helper to render a minimal select composition for testing the trigger.
  function renderSelect(size?: "sm" | "default") {
    return render(
      <Select defaultValue="apple">
        <SelectTrigger size={size} aria-label="Fruit picker">
          <SelectValue placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
  }

  // Verifies the trigger button renders and is visible.
  it("renders the trigger", () => {
    renderSelect();
    // The trigger should be in the document as a combobox element
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeTruthy();
  });

  // Confirms the trigger has the correct data-slot attribute for styling hooks.
  it('has data-slot="select-trigger"', () => {
    const { container } = renderSelect();
    const trigger = container.querySelector('[data-slot="select-trigger"]');
    expect(trigger).toBeTruthy();
  });

  // Verifies the size variant prop is forwarded as a data-size attribute.
  it("size variants work", () => {
    const { container: containerDefault } = renderSelect("default");
    const triggerDefault = containerDefault.querySelector('[data-slot="select-trigger"]');
    expect(triggerDefault?.getAttribute("data-size")).toBe("default");

    const { container: containerSm } = renderSelect("sm");
    const triggerSm = containerSm.querySelector('[data-slot="select-trigger"]');
    expect(triggerSm?.getAttribute("data-size")).toBe("sm");
  });

  // Runs axe accessibility audit on the select trigger.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = renderSelect();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
