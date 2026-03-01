// @vitest-environment jsdom
/**
 * Tests for the Navbar component.
 *
 * Navbar renders a glassmorphic navigation dock on desktop (vertical, left side)
 * and a fixed bottom tab bar on mobile. Nav items: Chat, Terminal, Files, Diff
 * (conditional on changedFilesCount > 0), and Settings.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Store mock ────────────────────────────────────────────────────────────

interface MockStoreState {
  currentSessionId: string | null;
  activeTab: "chat" | "diff" | "terminal" | "processes" | "editor";
  setActiveTab: ReturnType<typeof vi.fn>;
  markChatTabReentry: ReturnType<typeof vi.fn>;
  quickTerminalOpen: boolean;
  quickTerminalTabs: unknown[];
  openQuickTerminal: ReturnType<typeof vi.fn>;
  resetQuickTerminal: ReturnType<typeof vi.fn>;
  gitChangedFilesCount: Map<string, number>;
  sessions: Map<string, { cwd?: string }>;
  sdkSessions: { sessionId: string; cwd?: string; containerId?: string }[];
  sessionProcesses: Map<string, { status: string }[]>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    currentSessionId: "s1",
    activeTab: "chat",
    setActiveTab: vi.fn(),
    markChatTabReentry: vi.fn(),
    quickTerminalOpen: false,
    quickTerminalTabs: [],
    openQuickTerminal: vi.fn(),
    resetQuickTerminal: vi.fn(),
    gitChangedFilesCount: new Map(),
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sdkSessions: [{ sessionId: "s1", cwd: "/repo" }],
    sessionProcesses: new Map(),
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

import { Navbar } from "./Navbar.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  window.location.hash = "#/session/s1";
});

afterEach(() => {
  window.location.hash = "";
});

describe("Navbar", () => {
  /** Desktop nav renders Chat, Terminal, Files, Settings by default */
  it("renders Chat, Terminal, Files, and Settings nav items", () => {
    render(<Navbar />);
    expect(screen.getByTestId("nav-chat")).toBeInTheDocument();
    expect(screen.getByTestId("nav-terminal")).toBeInTheDocument();
    expect(screen.getByTestId("nav-editor")).toBeInTheDocument();
    expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
  });

  /** Diff tab is hidden when changedFilesCount is 0 */
  it("hides Diff tab when no changed files", () => {
    render(<Navbar />);
    expect(screen.queryByTestId("nav-diff")).not.toBeInTheDocument();
  });

  /** Diff tab appears when changedFilesCount > 0 */
  it("shows Diff tab when changed files exist", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 3]]) });
    render(<Navbar />);
    expect(screen.getByTestId("nav-diff")).toBeInTheDocument();
  });

  /** Diff badge shows the count of changed files (desktop + mobile both render) */
  it("shows changed files count badge on Diff tab", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 7]]) });
    render(<Navbar />);
    // Both desktop and mobile Diff badges show the count
    const badges = screen.getAllByText("7");
    expect(badges.length).toBe(2);
  });

  /** Clicking Chat sets activeTab to "chat" */
  it("clicking Chat activates the chat tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-chat"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("chat");
  });

  /** Clicking Chat marks chat tab reentry when switching from another tab */
  it("clicking Chat marks reentry when switching from non-chat tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-chat"));
    expect(storeState.markChatTabReentry).toHaveBeenCalledWith("s1");
  });

  /** Clicking Terminal sets activeTab and opens quick terminal */
  it("clicking Terminal activates the terminal tab", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(storeState.openQuickTerminal).toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Clicking Files sets activeTab to "editor" */
  it("clicking Files activates the editor tab", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-editor"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("editor");
  });

  /** Clicking Diff sets activeTab to "diff" */
  it("clicking Diff activates the diff tab", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 2]]) });
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-diff"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("diff");
  });

  /** Clicking Settings navigates to #/settings */
  it("clicking Settings navigates to settings page", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-settings"));
    expect(window.location.hash).toBe("#/settings");
  });

  /** Files/Editor is disabled when no cwd is available */
  it("disables Files when no cwd is available", () => {
    resetStore({ sessions: new Map(), sdkSessions: [] });
    render(<Navbar />);
    const filesBtn = screen.getByTestId("nav-editor");
    expect(filesBtn).toBeDisabled();
  });

  /** Terminal is never disabled — it falls back to standalone terminal page */
  it("Terminal is not disabled even without cwd", () => {
    resetStore({
      sessions: new Map([["s1", {}]]),
      sdkSessions: [{ sessionId: "s1" }],
    });
    render(<Navbar />);
    const termBtn = screen.getByTestId("nav-terminal");
    expect(termBtn).not.toBeDisabled();
  });

  /** Files is disabled when no session is selected */
  it("disables Files when no session is selected", () => {
    resetStore({ currentSessionId: null });
    render(<Navbar />);
    const filesBtn = screen.getByTestId("nav-editor");
    expect(filesBtn).toBeDisabled();
  });

  /** Terminal navigates to #/terminal when no session is active */
  it("Terminal navigates to standalone terminal page when no session", () => {
    resetStore({ currentSessionId: null });
    window.location.hash = "#/home";
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(window.location.hash).toBe("#/terminal");
  });

  /** Chat navigates to #/home when no session is active */
  it("Chat navigates to home when no session", () => {
    resetStore({ currentSessionId: null });
    window.location.hash = "#/home";
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-chat"));
    expect(window.location.hash).toBe("#/home");
  });

  /** Mobile nav items have correct test IDs */
  it("renders mobile nav items", () => {
    render(<Navbar />);
    expect(screen.getByTestId("nav-mobile-chat")).toBeInTheDocument();
    expect(screen.getByTestId("nav-mobile-terminal")).toBeInTheDocument();
    expect(screen.getByTestId("nav-mobile-editor")).toBeInTheDocument();
    expect(screen.getByTestId("nav-mobile-settings")).toBeInTheDocument();
  });

  /** Mobile Diff hidden when no changed files */
  it("hides mobile Diff tab when no changed files", () => {
    render(<Navbar />);
    expect(screen.queryByTestId("nav-mobile-diff")).not.toBeInTheDocument();
  });

  /** Mobile Diff shown when changed files exist */
  it("shows mobile Diff tab when changed files exist", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 1]]) });
    render(<Navbar />);
    expect(screen.getByTestId("nav-mobile-diff")).toBeInTheDocument();
  });

  /** Mobile nav labels are shown */
  it("renders mobile nav labels", () => {
    render(<Navbar />);
    // Mobile buttons have visible labels
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  /** Both desktop and mobile navs have unique aria-labels for accessibility */
  it("both navs have unique accessible aria-labels", () => {
    render(<Navbar />);
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBe(2);
    expect(screen.getByLabelText("Main navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile navigation")).toBeInTheDocument();
  });

  /** All desktop nav buttons have aria-label for accessibility */
  it("desktop nav buttons have aria-labels", () => {
    render(<Navbar />);
    expect(screen.getByTestId("nav-chat")).toHaveAttribute("aria-label", "Chat");
    expect(screen.getByTestId("nav-terminal")).toHaveAttribute("aria-label", "Terminal");
    expect(screen.getByTestId("nav-editor")).toHaveAttribute("aria-label", "Files");
    expect(screen.getByTestId("nav-settings")).toHaveAttribute("aria-label", "Settings");
  });

  /** Keyboard shortcut Cmd+J cycles to next tab */
  it("Cmd+J cycles to next tab", () => {
    resetStore({ activeTab: "chat" });
    render(<Navbar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    // Should cycle from chat -> terminal
    expect(storeState.openQuickTerminal).toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Keyboard shortcut Cmd+Shift+J cycles backwards */
  it("Cmd+Shift+J cycles to previous tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<Navbar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true, shiftKey: true });
    // Should cycle from terminal -> chat
    expect(storeState.setActiveTab).toHaveBeenCalledWith("chat");
  });

  /** Keyboard shortcut doesn't fire from textarea */
  it("Cmd+J does not fire from textarea", () => {
    render(<Navbar />);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "j", metaKey: true });
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  /** Keyboard shortcut doesn't fire when no session */
  it("Cmd+J does not fire when no session", () => {
    resetStore({ currentSessionId: null });
    window.location.hash = "#/home";
    render(<Navbar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
  });

  /** Terminal not reopened when already open */
  it("does not reopen terminal when already open", () => {
    resetStore({ quickTerminalOpen: true, quickTerminalTabs: [{}] });
    render(<Navbar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(storeState.openQuickTerminal).not.toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Resets quick terminal when session changes to null */
  it("resets quick terminal when no session", () => {
    resetStore({ currentSessionId: null });
    window.location.hash = "#/home";
    render(<Navbar />);
    expect(storeState.resetQuickTerminal).toHaveBeenCalled();
  });

  /** Passes axe accessibility checks */
  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    resetStore();
    const { container } = render(<Navbar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
