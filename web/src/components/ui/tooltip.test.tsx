// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

describe("Tooltip", () => {
  // Verifies the trigger renders visibly.
  it("renders trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByText("Hover me")).toBeTruthy();
  });

  // Confirms the trigger has the data-slot attribute.
  it("trigger has data-slot attribute", () => {
    const { container } = render(
      <Tooltip>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent>Info</TooltipContent>
      </Tooltip>,
    );
    expect(
      container.querySelector('[data-slot="tooltip-trigger"]'),
    ).toBeTruthy();
  });

  // Runs axe accessibility audit on the trigger (content is in a portal).
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <Tooltip>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent>Info</TooltipContent>
      </Tooltip>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
