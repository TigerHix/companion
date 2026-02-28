// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Badge, badgeVariants } from "./badge";

describe("Badge", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────────

  it("renders with children text", () => {
    // Verifies the badge renders its children content and is present in the DOM.
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("has data-slot='badge'", () => {
    // The Badge component sets data-slot="badge" for styling and identification.
    render(<Badge>Tag</Badge>);
    const badge = screen.getByText("Tag");
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  it("renders as a span element", () => {
    // Badge uses a <span> as its root element.
    render(<Badge>Span</Badge>);
    const badge = screen.getByText("Span");
    expect(badge.tagName).toBe("SPAN");
  });

  // ─── Variant classes ──────────────────────────────────────────────────────

  it("renders default variant class", () => {
    // The default variant applies primary background and foreground colors.
    render(<Badge variant="default">Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-primary");
    expect(badge.className).toContain("text-primary-foreground");
  });

  it("renders secondary variant class", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge.className).toContain("bg-secondary");
    expect(badge.className).toContain("text-secondary-foreground");
  });

  it("renders destructive variant class", () => {
    // Destructive variant uses a translucent destructive background.
    render(<Badge variant="destructive">Destructive</Badge>);
    const badge = screen.getByText("Destructive");
    expect(badge.className).toContain("text-destructive");
  });

  it("renders outline variant class", () => {
    // Outline variant uses a visible border and foreground text color.
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge.className).toContain("border-border");
    expect(badge.className).toContain("text-foreground");
  });

  it("renders ghost variant class", () => {
    // Ghost variant has hover styles for muted backgrounds.
    render(<Badge variant="ghost">Ghost</Badge>);
    const badge = screen.getByText("Ghost");
    expect(badge.className).toContain("hover:bg-muted");
  });

  // ─── badgeVariants utility ────────────────────────────────────────────────

  it("badgeVariants returns expected class string for given variant", () => {
    // Verifies the CVA utility produces a class string with the expected tokens.
    const classes = badgeVariants({ variant: "outline" });
    expect(classes).toContain("border-border");
    expect(classes).toContain("text-foreground");
  });

  // ─── Custom className passthrough ─────────────────────────────────────────

  it("merges custom className", () => {
    // Verifies that a custom className prop is merged into the final class list.
    render(<Badge className="my-custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("my-custom-class");
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it("passes axe accessibility checks", async () => {
    // Runs axe-core against the rendered badge to catch common a11y violations.
    const { axe } = await import("vitest-axe");
    const { container } = render(<Badge>Accessible badge</Badge>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
