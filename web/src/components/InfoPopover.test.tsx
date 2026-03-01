// @vitest-environment jsdom
/**
 * Tests for the InfoPopover component.
 *
 * InfoPopover replaces the TaskPanel right sidebar. It renders a trigger button
 * in the TopBar that opens a popover containing session context sections:
 * usage limits, git branch, PR status, MCP servers, tasks, and a processes shortcut.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Stub child components to isolate InfoPopover logic ────────────────────

vi.mock("./SectionErrorBoundary.js", () => ({
  SectionErrorBoundary: ({ children, label }: { children: React.ReactNode; label?: string }) => (
    <div data-testid={`section-${label?.toLowerCase().replace(/\s+/g, "-")}`}>{children}</div>
  ),
}));

vi.mock("./ClaudeConfigBrowser.js", () => ({
  ClaudeConfigBrowser: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-config">{sessionId}</div>
  ),
}));

vi.mock("./session-info-sections.js", () => ({
  UsageLimitsRenderer: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-usage-limits">{sessionId}</div>
  ),
  GitBranchSection: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-git-branch">{sessionId}</div>
  ),
  GitHubPRSection: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-github-pr">{sessionId}</div>
  ),
  TasksSection: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-tasks">{sessionId}</div>
  ),
}));

vi.mock("./McpPanel.js", () => ({
  McpSection: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="stub-mcp">{sessionId}</div>
  ),
}));

// ─── Store mock ────────────────────────────────────────────────────────────

interface MockStoreState {
  sessionProcesses: Map<string, { status: string }[]>;
  setActiveTab: ReturnType<typeof vi.fn>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    sessionProcesses: new Map(),
    setActiveTab: vi.fn(),
    ...overrides,
  };
}

vi.mock("../store.js", () => ({
  useStore: Object.assign(
    (selector: (s: MockStoreState) => unknown) => selector(storeState),
    {
      getState: () => storeState,
    },
  ),
}));

import { InfoPopover } from "./InfoPopover.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("InfoPopover", () => {
  /** Trigger button renders with correct test ID */
  it("renders the trigger button", () => {
    render(<InfoPopover sessionId="s1" />);
    expect(screen.getByTestId("info-popover-trigger")).toBeInTheDocument();
  });

  /** Trigger button has correct aria-label */
  it("trigger button has aria-label 'Session info'", () => {
    render(<InfoPopover sessionId="s1" />);
    expect(screen.getByLabelText("Session info")).toBeInTheDocument();
  });

  /** Popover is closed by default */
  it("popover is closed by default", () => {
    render(<InfoPopover sessionId="s1" />);
    expect(screen.queryByTestId("info-popover-content")).not.toBeInTheDocument();
  });

  /** Clicking trigger opens the popover */
  it("clicking trigger opens the popover", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    expect(screen.getByTestId("info-popover-content")).toBeInTheDocument();
  });

  /** Popover shows "Session Info" header */
  it("popover shows Session Info header", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    expect(screen.getByText("Session Info")).toBeInTheDocument();
  });

  /** All section stubs render with correct sessionId */
  it("renders all session info sections", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));

    expect(screen.getByTestId("stub-config")).toHaveTextContent("s1");
    expect(screen.getByTestId("stub-usage-limits")).toHaveTextContent("s1");
    expect(screen.getByTestId("stub-git-branch")).toHaveTextContent("s1");
    expect(screen.getByTestId("stub-github-pr")).toHaveTextContent("s1");
    expect(screen.getByTestId("stub-mcp")).toHaveTextContent("s1");
    expect(screen.getByTestId("stub-tasks")).toHaveTextContent("s1");
  });

  /** Clicking trigger again closes the popover */
  it("clicking trigger toggles popover closed", () => {
    render(<InfoPopover sessionId="s1" />);
    const trigger = screen.getByTestId("info-popover-trigger");

    fireEvent.click(trigger);
    expect(screen.getByTestId("info-popover-content")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId("info-popover-content")).not.toBeInTheDocument();
  });

  /** Clicking outside closes the popover */
  it("clicking outside closes the popover", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    expect(screen.getByTestId("info-popover-content")).toBeInTheDocument();

    // Click outside the popover (on the document body)
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("info-popover-content")).not.toBeInTheDocument();
  });

  /** Pressing Escape closes the popover */
  it("pressing Escape closes the popover", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    expect(screen.getByTestId("info-popover-content")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("info-popover-content")).not.toBeInTheDocument();
  });

  /** Processes shortcut is hidden when no running processes */
  it("hides processes shortcut when no running processes", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    expect(screen.queryByTestId("info-popover-processes")).not.toBeInTheDocument();
  });

  /** Processes shortcut shows when running processes exist */
  it("shows processes shortcut when running processes exist", () => {
    resetStore({
      sessionProcesses: new Map([
        ["s1", [{ status: "running" }, { status: "done" }, { status: "running" }]],
      ]),
    });
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));

    const processLink = screen.getByTestId("info-popover-processes");
    expect(processLink).toBeInTheDocument();
    expect(processLink).toHaveTextContent("2");
    expect(processLink).toHaveTextContent("View running processes");
  });

  /** Clicking processes shortcut sets activeTab and closes popover */
  it("clicking processes shortcut navigates to processes view", () => {
    resetStore({
      sessionProcesses: new Map([["s1", [{ status: "running" }]]]),
    });
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    fireEvent.click(screen.getByTestId("info-popover-processes"));

    expect(storeState.setActiveTab).toHaveBeenCalledWith("processes");
    // Popover should close after clicking processes
    expect(screen.queryByTestId("info-popover-content")).not.toBeInTheDocument();
  });

  /** Running process count badge shows on trigger button */
  it("shows process count badge on trigger when running processes exist", () => {
    resetStore({
      sessionProcesses: new Map([
        ["s1", [{ status: "running" }, { status: "running" }]],
      ]),
    });
    const { container } = render(<InfoPopover sessionId="s1" />);

    // Badge should be visible on the trigger button (before popover opens)
    const badge = container.querySelector(".absolute.-top-0\\.5.-right-0\\.5");
    // The badge with count "2" should be present somewhere near the trigger
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  /** No badge when no running processes */
  it("hides process count badge when no running processes", () => {
    render(<InfoPopover sessionId="s1" />);
    // Only the trigger should be visible, no "0" badge
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  /** Sections are wrapped in error boundaries */
  it("sections are wrapped in error boundaries", () => {
    render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));

    // SectionErrorBoundary stubs render with section-{label} test IDs
    expect(screen.getByTestId("section-config")).toBeInTheDocument();
    expect(screen.getByTestId("section-usage-limits")).toBeInTheDocument();
    expect(screen.getByTestId("section-git-branch")).toBeInTheDocument();
    expect(screen.getByTestId("section-github-pr")).toBeInTheDocument();
    expect(screen.getByTestId("section-mcp-servers")).toBeInTheDocument();
    expect(screen.getByTestId("section-tasks")).toBeInTheDocument();
  });

  /** Passes axe accessibility checks (closed state) */
  it("passes axe accessibility checks (closed)", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<InfoPopover sessionId="s1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /** Passes axe accessibility checks (open state) */
  it("passes axe accessibility checks (open)", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<InfoPopover sessionId="s1" />);
    fireEvent.click(screen.getByTestId("info-popover-trigger"));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
