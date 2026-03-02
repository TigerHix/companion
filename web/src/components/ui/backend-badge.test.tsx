// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BackendBadge, BackendIcon } from "./backend-badge";

describe("BackendBadge", () => {
  it("renders the default backend label", () => {
    render(<BackendBadge backend="claude" />);
    expect(screen.getByText("Claude")).toBeInTheDocument();
  });

  it("renders compact labels for sidebar-style usage", () => {
    render(<BackendBadge backend="codex" compact />);
    expect(screen.getByText("CX")).toBeInTheDocument();
  });

  it("applies backend semantic classes", () => {
    render(<BackendBadge backend="claude" compact>CC</BackendBadge>);
    const badge = screen.getByText("CC");
    expect(badge).toHaveAttribute("data-backend", "claude");
    expect(badge.className).toContain("bg-backend-claude/12");
    expect(badge.className).toContain("text-backend-claude");
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<BackendBadge backend="codex" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 10_000);
});

describe("BackendIcon", () => {
  it("renders Claude SVG icon with aria-label", () => {
    // BackendIcon renders an inline SVG with aria-label for accessibility.
    // Icons inherit text color from parent (no hardcoded color class).
    render(<BackendIcon backend="claude" />);
    const icon = screen.getByLabelText("Claude");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
  });

  it("renders Codex SVG icon with aria-label", () => {
    render(<BackendIcon backend="codex" />);
    const icon = screen.getByLabelText("Codex");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
  });

  it("applies custom className", () => {
    render(<BackendIcon backend="claude" className="w-5 h-5" />);
    const icon = screen.getByLabelText("Claude");
    const cls = icon.getAttribute("class") ?? "";
    expect(cls).toContain("w-5");
    expect(cls).toContain("h-5");
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<BackendIcon backend="codex" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 10_000);
});
