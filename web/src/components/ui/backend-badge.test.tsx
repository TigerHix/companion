// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BackendBadge } from "./backend-badge";

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
