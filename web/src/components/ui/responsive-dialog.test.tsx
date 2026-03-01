// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogTrigger,
} from "./responsive-dialog";

// Mock useIsMobile — defaults to desktop (false).
// Individual tests can override with vi.mocked(useIsMobile).mockReturnValue(true).
const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
});

describe("ResponsiveDialog", () => {
  // Verifies the trigger button renders in closed state.
  it("renders trigger button", () => {
    render(
      <ResponsiveDialog>
        <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Description</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>Footer</ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Open")).toBeTruthy();
  });

  // Runs axe accessibility audit on the closed state (trigger only).
  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(
      <ResponsiveDialog>
        <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // Desktop mode: renders base-ui Dialog with title and close button.
  it("renders desktop dialog with title and close button when open", () => {
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Desktop Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    // Title should be visible in the open dialog
    expect(screen.getByText("Desktop Title")).toBeTruthy();
    // Default showCloseButton=true renders a close button with sr-only "Close" text
    expect(screen.getByText("Close")).toBeTruthy();
  });

  // Desktop mode: showCloseButton={false} hides the close button.
  it("hides close button on desktop when showCloseButton={false}", () => {
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent showCloseButton={false}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>No Close</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("No Close")).toBeTruthy();
    // The sr-only "Close" text should not exist
    expect(screen.queryByText("Close")).toBeNull();
  });

  // Mobile mode: renders vaul Drawer with drag handle instead of X button.
  it("renders mobile drawer with drag handle when open", () => {
    mockUseIsMobile.mockReturnValue(true);
    const { container } = render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mobile Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Mobile Title")).toBeTruthy();
    // Drag handle is rendered as a muted bar
    const dragHandle = container.ownerDocument.querySelector(".bg-muted.rounded-full");
    expect(dragHandle).toBeTruthy();
    // No desktop close button (sr-only "Close") should be present
    expect(screen.queryByText("Close")).toBeNull();
  });

  // Mobile mode with dismissible={false}: no drag handle shown.
  it("hides drag handle on mobile when dismissible={false}", () => {
    mockUseIsMobile.mockReturnValue(true);
    const { container } = render(
      <ResponsiveDialog open dismissible={false}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Non-dismissible</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Non-dismissible")).toBeTruthy();
    // No drag handle
    const dragHandle = container.ownerDocument.querySelector(".bg-muted.rounded-full");
    expect(dragHandle).toBeNull();
  });

  // Verifies data-slot attributes are set on content.
  it("sets data-slot attributes on desktop content", () => {
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Slots</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    const content = document.querySelector('[data-slot="responsive-dialog-content"]');
    expect(content).toBeTruthy();
    const title = document.querySelector('[data-slot="responsive-dialog-title"]');
    expect(title).toBeTruthy();
  });

  // Verifies header responsive gap: desktop gets gap-2, mobile gets gap-0.5.
  it("applies responsive gap to header", () => {
    // Desktop: gap-2
    const { unmount } = render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader data-testid="header">
            <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    const desktopHeader = document.querySelector('[data-slot="responsive-dialog-header"]');
    expect(desktopHeader?.className).toContain("gap-2");
    unmount();

    // Mobile: gap-0.5
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader data-testid="header">
            <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    const mobileHeader = document.querySelector('[data-slot="responsive-dialog-header"]');
    expect(mobileHeader?.className).toContain("gap-0.5");
  });

  // Verifies footer renders children and has responsive layout.
  it("renders footer with responsive layout", () => {
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <button>Cancel</button>
            <button>Confirm</button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Confirm")).toBeTruthy();
    const footer = document.querySelector('[data-slot="responsive-dialog-footer"]');
    // Desktop layout uses flex-col-reverse + sm:flex-row
    expect(footer?.className).toContain("sm:flex-row");
  });
});
