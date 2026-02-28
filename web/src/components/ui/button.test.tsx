// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────────

  it("renders with children text", () => {
    // Verifies the button renders its children content and is present in the DOM.
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("has data-slot='button'", () => {
    // The Button component sets a data-slot attribute for styling/identification.
    render(<Button>Slot test</Button>);
    const button = screen.getByText("Slot test");
    expect(button).toHaveAttribute("data-slot", "button");
  });

  // ─── Variant classes ──────────────────────────────────────────────────────

  it("renders default variant class", () => {
    // The default variant applies the primary button styles.
    render(<Button variant="default">Default</Button>);
    const button = screen.getByText("Default");
    expect(button.className).toContain("btn-moku-primary");
  });

  it("renders outline variant class", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByText("Outline");
    expect(button.className).toContain("btn-moku-outline");
  });

  it("renders secondary variant class", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText("Secondary");
    expect(button.className).toContain("btn-moku-secondary");
  });

  it("renders ghost variant class", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByText("Ghost");
    expect(button.className).toContain("btn-moku-ghost");
  });

  it("renders destructive variant class", () => {
    render(<Button variant="destructive">Destructive</Button>);
    const button = screen.getByText("Destructive");
    expect(button.className).toContain("btn-moku-destructive");
  });

  it("renders link variant class", () => {
    // The link variant applies underline offset styling rather than a btn-moku class.
    render(<Button variant="link">Link</Button>);
    const button = screen.getByText("Link");
    expect(button.className).toContain("underline-offset-4");
  });

  // ─── Size classes ─────────────────────────────────────────────────────────

  it("renders default size class", () => {
    render(<Button size="default">Default Size</Button>);
    const button = screen.getByText("Default Size");
    expect(button.className).toContain("h-9");
    expect(button.className).toContain("px-4");
  });

  it("renders xs size class", () => {
    render(<Button size="xs">XS</Button>);
    const button = screen.getByText("XS");
    expect(button.className).toContain("h-6");
    expect(button.className).toContain("px-2");
  });

  it("renders sm size class", () => {
    render(<Button size="sm">SM</Button>);
    const button = screen.getByText("SM");
    expect(button.className).toContain("h-8");
    expect(button.className).toContain("px-3");
  });

  it("renders lg size class", () => {
    render(<Button size="lg">LG</Button>);
    const button = screen.getByText("LG");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("px-5");
  });

  it("renders icon size class", () => {
    render(<Button size="icon">I</Button>);
    const button = screen.getByText("I");
    expect(button.className).toContain("size-9");
  });

  it("renders icon-xs size class", () => {
    render(<Button size="icon-xs">IXS</Button>);
    const button = screen.getByText("IXS");
    expect(button.className).toContain("size-6");
  });

  it("renders icon-sm size class", () => {
    render(<Button size="icon-sm">ISM</Button>);
    const button = screen.getByText("ISM");
    expect(button.className).toContain("size-8");
  });

  it("renders icon-lg size class", () => {
    render(<Button size="icon-lg">ILG</Button>);
    const button = screen.getByText("ILG");
    expect(button.className).toContain("size-10");
  });

  // ─── Interaction ──────────────────────────────────────────────────────────

  it("fires click handler", () => {
    // Verifies that onClick prop is called when the button is clicked.
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    fireEvent.click(screen.getByText("Clickable"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // ─── buttonVariants utility ───────────────────────────────────────────────

  it("buttonVariants returns expected class string for given variant and size", () => {
    // Verifies the CVA utility produces a class string containing the expected tokens.
    const classes = buttonVariants({ variant: "outline", size: "sm" });
    expect(classes).toContain("btn-moku-outline");
    expect(classes).toContain("h-8");
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it("passes axe accessibility checks", async () => {
    // Runs axe-core against the rendered button to catch common a11y violations.
    const { axe } = await import("vitest-axe");
    const { container } = render(<Button>Accessible</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
