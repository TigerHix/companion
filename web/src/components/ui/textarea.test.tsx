// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  // Verifies that the component mounts and renders a textarea with the given placeholder text.
  it("renders with placeholder", () => {
    render(
      <label>
        Description
        <Textarea placeholder="Enter description..." />
      </label>,
    );
    expect(screen.getByPlaceholderText("Enter description...")).toBeTruthy();
  });

  // Confirms that the data-slot attribute is set to "textarea" for styling/selection hooks.
  it('has data-slot="textarea"', () => {
    render(
      <label>
        Note
        <Textarea placeholder="note" />
      </label>,
    );
    const el = screen.getByPlaceholderText("note");
    expect(el.getAttribute("data-slot")).toBe("textarea");
  });

  // Ensures the base CSS class "input-moku" is applied, which is needed for shared styling.
  it("has input-moku class", () => {
    render(
      <label>
        Input
        <Textarea placeholder="text" />
      </label>,
    );
    const el = screen.getByPlaceholderText("text");
    expect(el.className).toContain("input-moku");
  });

  // Validates that the disabled HTML attribute is forwarded correctly to the native textarea.
  it("supports disabled state", () => {
    render(
      <label>
        Disabled
        <Textarea placeholder="disabled" disabled />
      </label>,
    );
    const el = screen.getByPlaceholderText("disabled") as HTMLTextAreaElement;
    expect(el.disabled).toBe(true);
  });

  // Runs axe accessibility audit to ensure the component has no a11y violations when wrapped in a label.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <label>
        Message
        <Textarea placeholder="Type a message..." />
      </label>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
