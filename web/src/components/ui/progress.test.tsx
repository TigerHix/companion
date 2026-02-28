// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress, ProgressLabel, ProgressValue } from "./progress";

describe("Progress", () => {
  // Verifies progress renders with a value.
  it("renders with value", () => {
    const { container } = render(<Progress value={50} />);
    expect(container.querySelector('[data-slot="progress"]')).toBeTruthy();
  });

  // Confirms data-slot attribute is set.
  it('has data-slot="progress"', () => {
    const { container } = render(<Progress value={75} />);
    expect(container.querySelector('[data-slot="progress"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="progress-track"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="progress-indicator"]'),
    ).toBeTruthy();
  });

  // Verifies label and value sub-components render.
  it("renders label and value", () => {
    const { container } = render(
      <Progress value={60}>
        <ProgressLabel>Usage</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );
    expect(container.textContent).toContain("Usage");
    expect(
      container.querySelector('[data-slot="progress-label"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="progress-value"]'),
    ).toBeTruthy();
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <Progress value={50}>
        <ProgressLabel>Loading</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
