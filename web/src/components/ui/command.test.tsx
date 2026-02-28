// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";

describe("Command", () => {
  // Verifies a full command palette composition renders.
  it("renders a command palette composition", () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem>Create file</CommandItem>
            <CommandItem>Open terminal</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    expect(screen.getByPlaceholderText("Search...")).toBeTruthy();
    expect(screen.getByText("Create file")).toBeTruthy();
  });

  // Confirms data-slot attributes are set on key components.
  it("has data-slot attributes", () => {
    const { container } = render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandItem>Item</CommandItem>
        </CommandList>
      </Command>,
    );
    expect(container.querySelector('[data-slot="command"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="command-input"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="command-item"]')).toBeTruthy();
  });

  // Runs axe accessibility audit.
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <Command label="Command palette">
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Actions">
            <CommandItem>Create</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
