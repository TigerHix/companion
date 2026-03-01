// @vitest-environment jsdom
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SafariTintProbe } from "./SafariTintProbe.js";

describe("SafariTintProbe", () => {
  it("renders fixed top and bottom tint probes", () => {
    // Documents the Safari tinting workaround geometry: fixed, edge-adjacent strips near the viewport bounds.
    const { container } = render(<SafariTintProbe />);
    const probes = Array.from(container.querySelectorAll("div"));

    expect(probes).toHaveLength(2);
    expect(probes[0]).toHaveAttribute("aria-hidden", "true");
    expect(probes[0].className).toContain("fixed");
    expect(probes[0].className).toContain("top-0");
    expect(probes[0].className).toContain("left-[5%]");
    expect(probes[0].className).toContain("right-[5%]");
    expect(probes[0].className).toContain("h-1");
    expect(probes[0].className).toContain("bg-background");

    expect(probes[1]).toHaveAttribute("aria-hidden", "true");
    expect(probes[1].className).toContain("fixed");
    expect(probes[1].className).toContain("bottom-0");
    expect(probes[1].className).toContain("left-[5%]");
    expect(probes[1].className).toContain("right-[5%]");
    expect(probes[1].className).toContain("h-1");
    expect(probes[1].className).toContain("bg-background");
  });

  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<SafariTintProbe />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
