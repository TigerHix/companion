// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  // Verifies the input renders with a placeholder.
  it("renders with placeholder", () => {
    render(
      <label>
        Name
        <Input placeholder="Enter name" />
      </label>,
    );
    expect(screen.getByPlaceholderText("Enter name")).toBeTruthy();
  });

  // Confirms data-slot is set to "input".
  it('has data-slot="input"', () => {
    render(
      <label>
        Email
        <Input placeholder="email" />
      </label>,
    );
    const el = screen.getByPlaceholderText("email");
    expect(el.getAttribute("data-slot")).toBe("input");
  });

  // Ensures the input-moku CSS class is present for glassmorphism styling.
  it("has input-moku class", () => {
    render(
      <label>
        Search
        <Input placeholder="search" />
      </label>,
    );
    const el = screen.getByPlaceholderText("search");
    expect(el.className).toContain("input-moku");
  });

  // Validates disabled state is forwarded to the native input.
  it("supports disabled state", () => {
    render(
      <label>
        Disabled
        <Input placeholder="disabled" disabled />
      </label>,
    );
    const el = screen.getByPlaceholderText("disabled") as HTMLInputElement;
    expect(el.disabled).toBe(true);
  });

  // Runs axe accessibility audit with a label wrapper for a11y compliance.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <label>
        Username
        <Input placeholder="username" />
      </label>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
