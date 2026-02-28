// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card";

describe("Card", () => {
  // Verifies that a full card composition renders all sub-components.
  it("renders a full card composition", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  // Confirms Card has the correct data-slot attribute.
  it('has data-slot="card"', () => {
    const { container } = render(<Card>Test</Card>);
    const el = container.querySelector('[data-slot="card"]');
    expect(el).toBeTruthy();
  });

  // Verifies that the card-moku CSS class is applied for glassmorphism styling.
  it("has card-moku class", () => {
    const { container } = render(<Card>Test</Card>);
    const el = container.querySelector('[data-slot="card"]');
    expect(el?.className).toContain("card-moku");
  });

  // Verifies default and sm size variants via data-size attribute.
  it("supports size variants", () => {
    const { container: defaultContainer } = render(<Card>Default</Card>);
    expect(
      defaultContainer
        .querySelector('[data-slot="card"]')
        ?.getAttribute("data-size"),
    ).toBe("default");

    const { container: smContainer } = render(<Card size="sm">Small</Card>);
    expect(
      smContainer
        .querySelector('[data-slot="card"]')
        ?.getAttribute("data-size"),
    ).toBe("sm");
  });

  // Runs axe accessibility audit on a full card composition.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Accessible Card</CardTitle>
        </CardHeader>
        <CardContent>Some content</CardContent>
      </Card>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
