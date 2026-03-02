// @vitest-environment jsdom
/**
 * Tests for the TopBar component.
 *
 * TopBar shows: sidebar toggle, session workspace tabs (Chat, Terminal, Files,
 * Diff) as liquid-glass text pills, and InfoPopover trigger.
 * Session tabs are only visible when a session is active and the route is a session view.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("../api.js", () => ({
  api: {
    relaunchSession: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock("../ws.js", () => ({
  sendToSession: vi.fn(),
}));

vi.mock("./InfoPopover.js", () => ({
  InfoPopover: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="info-popover-stub">{sessionId}</div>
  ),
}));

const mockToggleSidebar = vi.fn();
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    toggleSidebar: mockToggleSidebar,
    state: "expanded",
    open: true,
    setOpen: vi.fn(),
    isMobile: false,
    openMobile: false,
    setOpenMobile: vi.fn(),
  }),
}));

interface MockStoreState {
  activeTab: "chat" | "diff" | "terminal" | "processes" | "editor";
  setActiveTab: ReturnType<typeof vi.fn>;
  markChatTabReentry: ReturnType<typeof vi.fn>;
  sessionNames: Map<string, string>;
  sidebarOpen: boolean;
  setSidebarOpen: ReturnType<typeof vi.fn>;
  sdkSessions: { sessionId: string; name?: string; cwd?: string; containerId?: string }[];
  sessions: Map<string, { cwd?: string }>;
  sessionProcesses: Map<string, { status: string }[]>;
  quickTerminalOpen: boolean;
  quickTerminalTabs: unknown[];
  openQuickTerminal: ReturnType<typeof vi.fn>;
  resetQuickTerminal: ReturnType<typeof vi.fn>;
  gitChangedFilesCount: Map<string, number>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    activeTab: "chat",
    setActiveTab: vi.fn(),
    markChatTabReentry: vi.fn(),
    sessionNames: new Map([["s1", "My Session"]]),
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    sdkSessions: [{ sessionId: "s1", cwd: "/repo" }],
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sessionProcesses: new Map(),
    quickTerminalOpen: false,
    quickTerminalTabs: [],
    openQuickTerminal: vi.fn(),
    resetQuickTerminal: vi.fn(),
    gitChangedFilesCount: new Map(),
    ...overrides,
  };
}

vi.mock("../store.js", () => ({
  useStore: Object.assign(
    (selector: (s: MockStoreState) => unknown) => selector(storeState),
    {
      getState: () => ({ ...storeState, setSdkSessions: vi.fn() }),
    },
  ),
}));

import { TopBar } from "./TopBar.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  window.location.hash = "#/session/s1";
});

afterEach(() => {
  window.location.hash = "";
});

describe("TopBar", () => {
  // ─── Sidebar toggle ─────────────────────────────────────────────────────

  /** Sidebar toggle button renders and calls toggleSidebar on click */
  it("renders sidebar toggle and calls toggleSidebar on click", () => {
    render(<TopBar />);
    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(mockToggleSidebar).toHaveBeenCalled();
  });

  // ─── Session info ───────────────────────────────────────────────────────

  /** InfoPopover is rendered in session view */
  it("renders InfoPopover trigger when in session view", () => {
    render(<TopBar />);
    expect(screen.getByTestId("info-popover-stub")).toBeInTheDocument();
    expect(screen.getByTestId("info-popover-stub")).toHaveTextContent("s1");
  });

  /** No session info or InfoPopover when no session is selected */
  it("hides session info and InfoPopover when no session", () => {
    resetStore();
    window.location.hash = "#/home";
    render(<TopBar />);
    expect(screen.queryByTestId("info-popover-stub")).not.toBeInTheDocument();
  });

  // ─── Session workspace tabs ─────────────────────────────────────────────

  /** Renders Chat, Terminal, Files tabs when session is active */
  it("renders Chat, Terminal, Files nav items when session is active", () => {
    render(<TopBar />);
    expect(screen.getByTestId("nav-chat")).toBeInTheDocument();
    expect(screen.getByTestId("nav-terminal")).toBeInTheDocument();
    expect(screen.getByTestId("nav-editor")).toBeInTheDocument();
  });

  /** Tabs are text-only (no Settings tab — moved to sidebar) */
  it("does not render a Settings nav item", () => {
    render(<TopBar />);
    expect(screen.queryByTestId("nav-settings")).not.toBeInTheDocument();
  });

  /** Tabs hidden when no session is selected */
  it("hides tabs when no session is selected", () => {
    resetStore();
    window.location.hash = "#/home";
    render(<TopBar />);
    expect(screen.queryByTestId("nav-chat")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-navbar")).not.toBeInTheDocument();
  });

  /** Tabs hidden on app-level pages */
  it("hides tabs on app-level pages like settings", () => {
    window.location.hash = "#/settings";
    render(<TopBar />);
    expect(screen.queryByTestId("nav-chat")).not.toBeInTheDocument();
  });

  /** Diff tab hidden when no changed files */
  it("hides Diff tab when no changed files", () => {
    render(<TopBar />);
    expect(screen.queryByTestId("nav-diff")).not.toBeInTheDocument();
  });

  /** Diff tab appears when changed files exist */
  it("shows Diff tab when changed files exist", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 3]]) });
    render(<TopBar />);
    expect(screen.getByTestId("nav-diff")).toBeInTheDocument();
  });

  /** Diff tab shows count as text */
  it("shows changed files count in Diff tab label", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 7]]) });
    render(<TopBar />);
    expect(screen.getByText("Diff (7)")).toBeInTheDocument();
  });

  /** Clicking Chat sets activeTab to "chat" */
  it("clicking Chat activates the chat tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-chat"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("chat");
  });

  /** Clicking Chat marks reentry from another tab */
  it("clicking Chat marks reentry when switching from non-chat tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-chat"));
    expect(storeState.markChatTabReentry).toHaveBeenCalledWith("s1");
  });

  /** Clicking Terminal opens quick terminal and sets tab */
  it("clicking Terminal activates the terminal tab", () => {
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(storeState.openQuickTerminal).toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Clicking Files sets activeTab to "editor" */
  it("clicking Files activates the editor tab", () => {
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-editor"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("editor");
  });

  /** Clicking Diff sets activeTab to "diff" */
  it("clicking Diff activates the diff tab", () => {
    resetStore({ gitChangedFilesCount: new Map([["s1", 2]]) });
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-diff"));
    expect(storeState.setActiveTab).toHaveBeenCalledWith("diff");
  });

  /** Files disabled when no cwd */
  it("disables Files when no cwd is available", () => {
    resetStore({ sessions: new Map([["s1", {}]]), sdkSessions: [{ sessionId: "s1" }] });
    render(<TopBar />);
    expect(screen.getByTestId("nav-editor")).toBeDisabled();
  });

  /** Terminal does nothing without cwd */
  it("Terminal is disabled when no cwd", () => {
    resetStore({
      sessions: new Map([["s1", {}]]),
      sdkSessions: [{ sessionId: "s1" }],
    });
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
  });

  /** Tab labels are rendered as text */
  it("renders tab labels as text", () => {
    render(<TopBar />);
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  /** All tab buttons have aria-labels */
  it("tab buttons have aria-labels", () => {
    render(<TopBar />);
    expect(screen.getByTestId("nav-chat")).toHaveAttribute("aria-label", "Chat");
    expect(screen.getByTestId("nav-terminal")).toHaveAttribute("aria-label", "Terminal");
    expect(screen.getByTestId("nav-editor")).toHaveAttribute("aria-label", "Files");
  });

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────

  /** Cmd+J cycles to next tab */
  it("Cmd+J cycles to next tab", () => {
    resetStore({ activeTab: "chat" });
    render(<TopBar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(storeState.openQuickTerminal).toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Cmd+Shift+J cycles backwards */
  it("Cmd+Shift+J cycles to previous tab", () => {
    resetStore({ activeTab: "terminal" });
    render(<TopBar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true, shiftKey: true });
    expect(storeState.setActiveTab).toHaveBeenCalledWith("chat");
  });

  /** Shortcut ignored in textarea */
  it("Cmd+J does not fire from textarea", () => {
    render(<TopBar />);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "j", metaKey: true });
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  /** Shortcut ignored when no session */
  it("Cmd+J does not fire when no session", () => {
    resetStore();
    window.location.hash = "#/home";
    render(<TopBar />);
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
  });

  /** Terminal not reopened when already open */
  it("does not reopen terminal when already open", () => {
    resetStore({ quickTerminalOpen: true, quickTerminalTabs: [{}] });
    render(<TopBar />);
    fireEvent.click(screen.getByTestId("nav-terminal"));
    expect(storeState.openQuickTerminal).not.toHaveBeenCalled();
    expect(storeState.setActiveTab).toHaveBeenCalledWith("terminal");
  });

  /** Resets quick terminal when session becomes null */
  it("resets quick terminal when no session", () => {
    resetStore();
    window.location.hash = "#/home";
    render(<TopBar />);
    expect(storeState.resetQuickTerminal).toHaveBeenCalled();
  });

  // ─── Accessibility ──────────────────────────────────────────────────────

  /** Passes axe accessibility checks */
  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    resetStore();
    const { container } = render(<TopBar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
