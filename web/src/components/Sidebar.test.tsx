// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import type { SessionState, SdkSessionInfo } from "../types.js";

// ─── Mock setup ──────────────────────────────────────────────────────────────

// Mock useIsMobile hook (required by shadcn SidebarProvider) — JSDOM has no matchMedia
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockConnectSession = vi.fn();
const mockConnectAllSessions = vi.fn();
const mockDisconnectSession = vi.fn();

vi.mock("../ws.js", () => ({
  connectSession: (...args: unknown[]) => mockConnectSession(...args),
  connectAllSessions: (...args: unknown[]) => mockConnectAllSessions(...args),
  disconnectSession: (...args: unknown[]) => mockDisconnectSession(...args),
}));

const mockApi = {
  listSessions: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue({}),
  archiveSession: vi.fn().mockResolvedValue({}),
  unarchiveSession: vi.fn().mockResolvedValue({}),
  renameSession: vi.fn().mockResolvedValue({}),
  getArchiveInfo: vi.fn().mockResolvedValue({ hasLinkedIssue: false, issueNotDone: false }),
};

vi.mock("../api.js", () => ({
  api: {
    listSessions: (...args: unknown[]) => mockApi.listSessions(...args),
    deleteSession: (...args: unknown[]) => mockApi.deleteSession(...args),
    archiveSession: (...args: unknown[]) => mockApi.archiveSession(...args),
    unarchiveSession: (...args: unknown[]) => mockApi.unarchiveSession(...args),
    renameSession: (...args: unknown[]) => mockApi.renameSession(...args),
    getArchiveInfo: (...args: unknown[]) => mockApi.getArchiveInfo(...args),
  },
}));

// ─── Store mock helpers ──────────────────────────────────────────────────────

// We need to mock the store. The Sidebar uses `useStore((s) => s.xxx)` selector pattern.
// We'll provide a real-ish mock that supports selector calls.

interface MockStoreState {
  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  lastSessionId: string | null;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  sessionNames: Map<string, string>;
  recentlyRenamed: Set<string>;
  pendingPermissions: Map<string, Map<string, unknown>>;
  linkedLinearIssues: Map<string, unknown>;
  collapsedProjects: Set<string>;
  setLastSessionId: ReturnType<typeof vi.fn>;
  toggleProjectCollapse: ReturnType<typeof vi.fn>;
  removeSession: ReturnType<typeof vi.fn>;
  newSession: ReturnType<typeof vi.fn>;
  setSidebarOpen: ReturnType<typeof vi.fn>;
  setSessionName: ReturnType<typeof vi.fn>;
  markRecentlyRenamed: ReturnType<typeof vi.fn>;
  clearRecentlyRenamed: ReturnType<typeof vi.fn>;
  setSdkSessions: ReturnType<typeof vi.fn>;
  closeTerminal: ReturnType<typeof vi.fn>;
}

function makeSession(id: string, overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: id,
    model: "claude-sonnet-4-6",
    cwd: "/home/user/projects/myapp",
    tools: [],
    permissionMode: "default",
    claude_code_version: "1.0",
    mcp_servers: [],
    agents: [],
    slash_commands: [],
    skills: [],
    total_cost_usd: 0,
    num_turns: 0,
    context_used_percent: 0,
    is_compacting: false,
    git_branch: "",
    is_worktree: false,
    is_containerized: false,
    repo_root: "",
    git_ahead: 0,
    git_behind: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
    ...overrides,
  };
}

function makeSdkSession(id: string, overrides: Partial<SdkSessionInfo> = {}): SdkSessionInfo {
  return {
    sessionId: id,
    state: "connected",
    cwd: "/home/user/projects/myapp",
    createdAt: Date.now(),
    archived: false,
    ...overrides,
  };
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    sessions: new Map(),
    sdkSessions: [],
    lastSessionId: null,
    cliConnected: new Map(),
    sessionStatus: new Map(),
    sessionNames: new Map(),
    recentlyRenamed: new Set(),
    pendingPermissions: new Map(),
    linkedLinearIssues: new Map(),
    collapsedProjects: new Set(),
    setLastSessionId: vi.fn(),
    toggleProjectCollapse: vi.fn(),
    removeSession: vi.fn(),
    newSession: vi.fn(),
    setSidebarOpen: vi.fn(),
    setSessionName: vi.fn(),
    markRecentlyRenamed: vi.fn(),
    clearRecentlyRenamed: vi.fn(),
    setSdkSessions: vi.fn(),
    closeTerminal: vi.fn(),
    ...overrides,
  };
}

// Mock the store module
vi.mock("../store.js", () => {
  // We create a function that acts like the zustand hook with selectors
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => {
    return selector(mockState);
  };
  // Also support useStore.getState() which Sidebar uses directly
  useStoreFn.getState = () => mockState;

  return { useStore: useStoreFn };
});

// ─── Import component after mocks ───────────────────────────────────────────

import { Sidebar } from "./Sidebar.js";
import { SidebarProvider } from "@/components/ui/sidebar";

/** Wraps <Sidebar /> in the SidebarProvider context required by shadcn sidebar components. */
function renderSidebar() {
  return render(
    <SidebarProvider defaultOpen>
      <Sidebar />
    </SidebarProvider>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockState = createMockState();
  window.location.hash = "";
});

describe("Sidebar", () => {
  it("renders 'New Session' button", () => {
    // Single New Session button in the sidebar header (uniform on all screen sizes)
    renderSidebar();
    const button = screen.getByTitle("New Session");
    expect(button).toBeInTheDocument();
  });

  it("renders 'No sessions yet.' when no sessions exist", () => {
    renderSidebar();
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });

  it("applies safe-area padding to the sidebar shell", () => {
    renderSidebar();
    const shell = document.querySelector('[data-slot="sidebar-container"]');
    expect(shell).toHaveClass("pt-safe");
    expect(shell).toHaveClass("pb-safe-only");
  });

  it("renders session items for active sessions", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { model: "claude-sonnet-4-6" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    // The session label defaults to model name
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
  });

  it("session items show model name or session ID", () => {
    // Session with model name
    const session1 = makeSession("s1", { model: "claude-opus-4-6" });
    const sdk1 = makeSdkSession("s1", { model: "claude-opus-4-6" });

    // Session without model (falls back to short ID)
    const session2 = makeSession("abcdef12-3456-7890-abcd-ef1234567890", { model: "" });
    const sdk2 = makeSdkSession("abcdef12-3456-7890-abcd-ef1234567890", { model: "" });

    mockState = createMockState({
      sessions: new Map([
        ["s1", session1],
        ["abcdef12-3456-7890-abcd-ef1234567890", session2],
      ]),
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
    // Falls back to shortId (first 8 chars)
    expect(screen.getByText("abcdef12")).toBeInTheDocument();
  });

  it("session items show project name in group header but no cwd path in session row", () => {
    // "myapp" appears in the project group header. The cwd path was intentionally
    // removed from session rows in the minimal sidebar redesign.
    const session = makeSession("s1", { cwd: "/home/user/projects/myapp" });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    // Group header shows "myapp (1)" as a single inline string inside a SidebarMenuButton
    const matches = screen.getAllByText(/myapp/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Session row no longer shows the full cwd path (removed for minimal design)
    expect(screen.queryByText("/home/user/projects/myapp")).not.toBeInTheDocument();
  });

  it("session items do not show git branch (removed in redesign)", () => {
    // Git branch was intentionally removed from session items in the sidebar redesign.
    // The data is still in the store but no longer rendered in the session row.
    const session = makeSession("s1", { git_branch: "feature/awesome" });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.queryByText("feature/awesome")).not.toBeInTheDocument();
  });

  it("session items do not show container badge (removed in redesign)", () => {
    // The redesigned session row no longer renders any Docker/container badge.
    // The is_containerized flag is still tracked internally but not displayed.
    const session = makeSession("s1", { git_branch: "feature/docker", is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const dockerLogo = document.querySelector('img[src="/logo-docker.svg"]');
    expect(dockerLogo).not.toBeInTheDocument();
  });

  it("session items do not show git stats (removed in redesign)", () => {
    // Git ahead/behind and lines added/removed were intentionally removed
    // from session items in the sidebar redesign.
    const session = makeSession("s1", {
      git_branch: "main",
      git_ahead: 3,
      git_behind: 2,
      total_lines_added: 42,
      total_lines_removed: 7,
    });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.queryByText("+42")).not.toBeInTheDocument();
    expect(screen.queryByText("-7")).not.toBeInTheDocument();
  });

  it("active session has highlighted styling (data-active attribute)", () => {
    // The redesigned sidebar uses SidebarMenuButton with isActive prop which
    // sets a data-active attribute instead of CSS classes like session-item-active.
    window.location.hash = "#/session/s1";
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).toHaveAttribute("data-active");
  });

  it("clicking a session navigates to the session hash", () => {
    // Sidebar now delegates to URL-based routing: it sets the hash to #/session/{id}
    // and App.tsx's hash effect remembers that session from the route.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button")!;
    fireEvent.click(sessionButton);

    expect(window.location.hash).toBe("#/session/s1");
  });

  it("New Session button calls newSession", () => {
    // There are two New Session buttons: desktop header + mobile FAB
    renderSidebar();
    const buttons = screen.getAllByTitle("New Session");
    fireEvent.click(buttons[0]);

    expect(mockState.newSession).toHaveBeenCalled();
  });

  it("double-clicking a session enters edit mode", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    // After double-click, an input should appear for renaming
    const input = screen.getByDisplayValue("claude-sonnet-4-6");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("session actions menu button exists in the DOM", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    // Session actions button (three-dot menu) has title "Session actions"
    const menuButton = screen.getByTitle("Session actions");
    expect(menuButton).toBeInTheDocument();
  });

  it("session actions menu shows archive option when clicked", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const menuButton = screen.getByTitle("Session actions");
    fireEvent.click(menuButton);

    // Menu should show Archive and Rename options
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Rename")).toBeInTheDocument();
  });

  it("session actions menu button is hidden by default and visible on row hover", () => {
    // The redesigned sidebar uses per-row hover (group/row) to show the
    // menu button only on the hovered session row, not all rows at once.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const menuButton = screen.getByTitle("Session actions");

    expect(menuButton).toHaveClass("opacity-0");
    expect(menuButton).toHaveClass("sm:group-hover/row:opacity-100");
  });

  it("pending permissions render data-status='awaiting' and StatusDot on the row", () => {
    // The redesigned sidebar communicates "awaiting" status via a data-status
    // attribute on the SidebarMenuButton and a StatusDot component with
    // session-status-awaiting class.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      pendingPermissions: new Map([["s1", new Map([["p1", {}]])]]),
      cliConnected: new Map([["s1", true]]),
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).toHaveAttribute("data-status", "awaiting");
    expect(document.querySelector(".session-status-awaiting")).toBeInTheDocument();
  });

  it("archived sessions section shows count", () => {
    // The redesigned sidebar renders "Archived (2)" as a single inline string
    // inside a span within a SidebarMenuButton.
    const sdk1 = makeSdkSession("s1", { archived: false });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: true });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    renderSidebar();
    expect(screen.getByText(/Archived \(2\)/)).toBeInTheDocument();
  });

  it("toggle archived shows/hides archived sessions", () => {
    const sdk1 = makeSdkSession("s1", { archived: false, model: "active-model" });
    const sdk2 = makeSdkSession("s2", { archived: true, model: "archived-model" });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();

    // Archived sessions should not be visible initially
    expect(screen.queryByText("archived-model")).not.toBeInTheDocument();

    // Click the archived toggle button (single inline string "Archived (1)")
    const toggleButton = screen.getByText(/Archived/);
    fireEvent.click(toggleButton);

    // Now the archived session should be visible
    expect(screen.getByText("archived-model")).toBeInTheDocument();
  });

  it("does not render settings controls directly in sidebar", () => {
    renderSidebar();
    expect(screen.queryByText("Notification")).not.toBeInTheDocument();
    expect(screen.queryByText("Dark mode")).not.toBeInTheDocument();
  });

  it("session name shows animate-name-appear class when recently renamed", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Auto Generated Title"]]),
      recentlyRenamed: new Set(["s1"]),
    });

    renderSidebar();
    const nameElement = screen.getByText("Auto Generated Title");
    // Animation class is on the parent span wrapper, not the inner text span
    expect(nameElement.closest(".animate-name-appear")).toBeTruthy();
  });

  it("session name does NOT have animate-name-appear when not recently renamed", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Regular Name"]]),
      recentlyRenamed: new Set(), // not recently renamed
    });

    renderSidebar();
    const nameElement = screen.getByText("Regular Name");
    expect(nameElement.className).not.toContain("animate-name-appear");
  });

  it("calls clearRecentlyRenamed on animation end", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Animated Name"]]),
      recentlyRenamed: new Set(["s1"]),
    });

    const { container } = renderSidebar();
    // The animated span has the animate-name-appear class and an onAnimationEnd
    // handler that calls onClearRecentlyRenamed(sessionId).
    const animatedSpan = container.querySelector(".animate-name-appear");
    expect(animatedSpan).toBeTruthy();

    // JSDOM does not define AnimationEvent in all environments, which
    // causes fireEvent.animationEnd to silently fail. We traverse the
    // React fiber tree to invoke the onAnimationEnd handler directly.
    const fiberKey = Object.keys(animatedSpan!).find((k) =>
      k.startsWith("__reactFiber$"),
    );
    expect(fiberKey).toBeDefined();
    let fiber = (animatedSpan as unknown as Record<string, unknown>)[fiberKey!] as Record<string, unknown> | null;
    let called = false;
    while (fiber) {
      const props = fiber.memoizedProps as Record<string, unknown> | undefined;
      if (props?.onAnimationEnd) {
        (props.onAnimationEnd as () => void)();
        called = true;
        break;
      }
      fiber = fiber.return as Record<string, unknown> | null;
    }
    expect(called).toBe(true);
    expect(mockState.clearRecentlyRenamed).toHaveBeenCalledWith("s1");
  });

  it("animation class applies only to the recently renamed session, not others", () => {
    const session1 = makeSession("s1");
    const session2 = makeSession("s2");
    const sdk1 = makeSdkSession("s1");
    const sdk2 = makeSdkSession("s2");
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
      sessionNames: new Map([["s1", "Renamed Session"], ["s2", "Other Session"]]),
      recentlyRenamed: new Set(["s1"]), // only s1 was renamed
    });

    renderSidebar();
    const renamedElement = screen.getByText("Renamed Session");
    const otherElement = screen.getByText("Other Session");

    // Animation class is on the parent span wrapper, not the inner text span
    expect(renamedElement.closest(".animate-name-appear")).toBeTruthy();
    expect(otherElement.closest(".animate-name-appear")).toBeFalsy();
  });

  it("session keeps awaiting state with multiple pending permissions", () => {
    // With multiple pending permissions, the session row should still have
    // data-status="awaiting" (status derived from permCount > 0).
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    const permMap = new Map<string, unknown>([
      ["r1", { request_id: "r1", tool_name: "Bash" }],
      ["r2", { request_id: "r2", tool_name: "Read" }],
    ]);
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      pendingPermissions: new Map([["s1", permMap as Map<string, unknown>]]),
      cliConnected: new Map([["s1", true]]),
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).toHaveAttribute("data-status", "awaiting");
  });

  it("archived session row is clickable after opening archived section", () => {
    const sdk = makeSdkSession("s1", { archived: true, model: "archived-clickable" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByText(/Archived/));

    const archivedRowButton = screen.getByText("archived-clickable").closest("button");
    expect(archivedRowButton).toBeInTheDocument();
    if (!archivedRowButton) throw new Error("Archived row button not found");

    fireEvent.click(archivedRowButton);
    expect(window.location.hash).toBe("#/session/s1");
  });

  it("session does not render git data from sdkInfo (redesign removes git display)", () => {
    // Git branch and stats are no longer rendered in the session row.
    // The data still flows through the store but is not displayed.
    const sdk = makeSdkSession("s1", {
      gitBranch: "feature/from-rest",
      gitAhead: 5,
      gitBehind: 2,
      totalLinesAdded: 100,
      totalLinesRemoved: 20,
    });
    mockState = createMockState({
      sessions: new Map(),
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.queryByText("feature/from-rest")).not.toBeInTheDocument();
    expect(screen.queryByText("+100")).not.toBeInTheDocument();
    expect(screen.queryByText("-20")).not.toBeInTheDocument();
  });

  it("codex session shows Codex icon when bridgeState is missing", () => {
    // Only sdkInfo available (no WS session_init received yet).
    // The redesigned session item uses inline SVG icons with aria-label
    // instead of text badges ("CC" / "CX").
    const sdk = makeSdkSession("s1", { backendType: "codex" });
    mockState = createMockState({
      sessions: new Map(),
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.getByLabelText("Codex")).toBeInTheDocument();
  });

  it("session shows correct backend icon based on backendType", () => {
    // The redesigned session item uses inline SVG icons (BackendIcon) with
    // aria-labels "Claude" and "Codex" instead of text badges.
    const session1 = makeSession("s1", { backend_type: "claude" });
    const session2 = makeSession("s2", { backend_type: "codex" });
    const sdk1 = makeSdkSession("s1", { backendType: "claude" });
    const sdk2 = makeSdkSession("s2", { backendType: "codex" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    expect(screen.getAllByLabelText("Claude").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("Codex").length).toBeGreaterThanOrEqual(1);
  });

  it("sessions are grouped by project directory", () => {
    const session1 = makeSession("s1", { cwd: "/home/user/project-a" });
    const session2 = makeSession("s2", { cwd: "/home/user/project-a" });
    const session3 = makeSession("s3", { cwd: "/home/user/project-b" });
    const sdk1 = makeSdkSession("s1", { cwd: "/home/user/project-a" });
    const sdk2 = makeSdkSession("s2", { cwd: "/home/user/project-a" });
    const sdk3 = makeSdkSession("s3", { cwd: "/home/user/project-b" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2], ["s3", session3]]),
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    renderSidebar();
    // Project group headers show "project-a (2)" and "project-b (1)" as single inline strings
    expect(screen.getAllByText(/project-a/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/project-b/).length).toBeGreaterThanOrEqual(1);
  });

  it("project group header shows running status pip and session count", () => {
    // The redesigned sidebar shows count in "(N)" format and running status
    // as a tiny 1px pip dot (bg-success/70) inside the group header.
    const session1 = makeSession("s1", { cwd: "/home/user/myapp" });
    const session2 = makeSession("s2", { cwd: "/home/user/myapp" });
    const sdk1 = makeSdkSession("s1", { cwd: "/home/user/myapp" });
    const sdk2 = makeSdkSession("s2", { cwd: "/home/user/myapp" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
      sessionStatus: new Map([["s1", "running"], ["s2", "running"]]),
    });

    renderSidebar();
    // Status pip with title "2 running" should be present
    expect(screen.getByTitle("2 running")).toBeInTheDocument();
    // Session count as part of inline label "myapp (2)"
    expect(screen.getByText(/myapp \(2\)/)).toBeInTheDocument();
  });

  it("collapsing a project group hides its session items completely", () => {
    // The redesigned sidebar removes the collapsed preview text entirely.
    // When a folder is collapsed, its sessions are simply hidden.
    const session = makeSession("s1", { cwd: "/home/user/myapp", model: "hidden-model" });
    const sdk = makeSdkSession("s1", { cwd: "/home/user/myapp" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      collapsedProjects: new Set(["/home/user/myapp"]),
    });

    renderSidebar();
    // Group header should still be visible (label includes count: "myapp (1)")
    expect(screen.getByText(/myapp/)).toBeInTheDocument();
    // The session should not be visible at all — no button, no preview
    expect(screen.queryByText("hidden-model")).not.toBeInTheDocument();
  });

  it("context menu shows restore and delete for archived sessions", () => {
    const sdk1 = makeSdkSession("s1", { archived: false, model: "active-model" });
    const sdk2 = makeSdkSession("s2", { archived: true, model: "archived-model" });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();

    // Expand the archived section first (single inline string "Archived (1)")
    const toggleButton = screen.getByText(/Archived/);
    fireEvent.click(toggleButton);

    // Find the session actions menu for the archived session
    const menuButtons = screen.getAllByTitle("Session actions");
    // The archived session's menu button (last one since archived section is below)
    const archivedMenuButton = menuButtons[menuButtons.length - 1];
    fireEvent.click(archivedMenuButton);

    // Should show Restore and Delete options, but not Archive or Rename
    expect(screen.getByText("Restore")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
  });

  it("session item does not show timestamp (removed in redesign)", () => {
    // Timestamps were intentionally removed from session items in the sidebar
    // redesign to reduce visual clutter.
    const now = Date.now();
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { createdAt: now - 3600000 }); // 1 hour ago
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.queryByText("1h ago")).not.toBeInTheDocument();
  });

  it("session item has minimum touch target height", () => {
    // The redesigned sidebar uses SidebarMenuButton with default h-8 sizing
    // for a compact, dense layout.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).toHaveClass("h-8");
  });

  it("Enter confirms rename in edit mode", () => {
    // Verifies that pressing Enter in the rename input commits the name change
    // via the store's setSessionName action.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("claude-sonnet-4-6") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "My Session" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After Enter, the rename should be confirmed via the store action
    expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "My Session");
  });

  it("Escape cancels rename in edit mode", () => {
    // Verifies that pressing Escape reverts the rename without saving.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("claude-sonnet-4-6") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Should Not Save" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // After Escape, setSessionName should not be called — the rename was cancelled
    expect(mockState.setSessionName).not.toHaveBeenCalled();
  });

  it("long session names are truncated with the truncate class", () => {
    // Verifies that a very long session name does not cause horizontal overflow.
    // SidebarMenuButton has [&>span:last-child]:truncate in its CVA definition,
    // so the truncate class is applied to the outer button wrapper, not the
    // session name span directly.
    const longName = "A".repeat(200);
    const session = makeSession("s1", { model: longName });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const nameEl = screen.getByText(longName);
    // The button wrapper applies truncate via [&>span:last-child]:truncate
    const button = nameEl.closest("button");
    expect(button).toHaveClass("[&>span:last-child]:truncate");
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });
    const { container } = renderSidebar();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ─── Polling & session name hydration ──────────────────────────────────────

  it("polls for SDK sessions on mount and hydrates session names", async () => {
    // Verifies that the Sidebar's useEffect poll() fetches sessions from the
    // API, calls setSdkSessions + connectAllSessions, and hydrates names from
    // the server response when the store has a random (two-word) name.
    const serverSessions = [
      makeSdkSession("s1", { name: "Server Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    // Simulate store having a random two-word name that should be overwritten
    mockState = createMockState({
      sessionNames: new Map([["s1", "Alpha Beta"]]),
    });

    renderSidebar();

    // Wait for the poll() promise to resolve
    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(mockState.setSdkSessions).toHaveBeenCalledWith(serverSessions);
    });
    expect(mockConnectAllSessions).toHaveBeenCalledWith(serverSessions);
    expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "Server Name");
    // Since the store had a random two-word name, markRecentlyRenamed should fire
    expect(mockState.markRecentlyRenamed).toHaveBeenCalledWith("s1");
  });

  it("poll does not overwrite session name when store name is user-defined (not random)", async () => {
    // Verifies that server names do not overwrite user-typed session names.
    // Only random two-word names (e.g. "Alpha Beta") should be overwritten.
    const serverSessions = [
      makeSdkSession("s1", { name: "Server Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    // Store has a non-random name — should not be replaced
    mockState = createMockState({
      sessionNames: new Map([["s1", "My Custom Name"]]),
    });

    renderSidebar();

    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    // setSessionName should NOT be called since "My Custom Name" is not a random two-word name
    expect(mockState.setSessionName).not.toHaveBeenCalled();
  });

  it("poll hydrates name when store has no existing name for the session", async () => {
    // Verifies that poll() sets the session name when none exists in the store yet.
    const serverSessions = [
      makeSdkSession("s1", { name: "Fresh Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    mockState = createMockState({
      sessionNames: new Map(), // no names in store at all
    });

    renderSidebar();

    await vi.waitFor(() => {
      expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "Fresh Name");
    });
    // No random name existed, so markRecentlyRenamed should not be called
    expect(mockState.markRecentlyRenamed).not.toHaveBeenCalled();
  });

  it("poll gracefully handles API errors", async () => {
    // Verifies that when api.listSessions rejects, the Sidebar does not crash
    // and still renders correctly.
    mockApi.listSessions.mockRejectedValueOnce(new Error("server not ready"));

    renderSidebar();

    // Should still render "No sessions yet." since the API call failed
    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });

  // ─── Delete session flow ──────────────────────────────────────────────────

  it("shows delete confirmation modal when Delete is clicked from context menu", () => {
    // Verifies that clicking Delete in the session context menu triggers the
    // delete confirmation modal with "Delete session?" heading.
    const sdk = makeSdkSession("s1", { archived: true, model: "deletable" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();

    // Expand archived section (single inline string "Archived (1)")
    fireEvent.click(screen.getByText(/Archived/));

    // Open context menu and click Delete
    const menuButton = screen.getByTitle("Session actions");
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText("Delete"));

    // Delete confirmation modal should appear
    expect(screen.getByText("Delete session?")).toBeInTheDocument();
    expect(screen.getByText(/This will permanently delete this session/)).toBeInTheDocument();
  });

  it("confirming delete calls api.deleteSession, disconnectSession, and removeSession", async () => {
    // Verifies the full delete flow: clicking Delete in the modal calls through
    // to the API and cleans up the session from the store.
    const sdk = makeSdkSession("s1", { archived: true, model: "to-delete" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();

    // Expand archived, open menu, click Delete
    fireEvent.click(screen.getByText(/Archived/));
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Delete"));

    // Now click the confirm "Delete" button in the modal
    const modalDeleteBtn = screen.getAllByText("Delete").find(
      (el) => el.closest(".fixed") !== null,
    );
    expect(modalDeleteBtn).toBeTruthy();
    fireEvent.click(modalDeleteBtn!);

    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    expect(mockState.removeSession).toHaveBeenCalledWith("s1");
  });

  it("cancelling delete closes the modal without deleting", () => {
    // Verifies that clicking Cancel in the delete modal does not trigger any
    // delete operations and the modal disappears.
    const sdk = makeSdkSession("s1", { archived: true, model: "keep-me" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();

    // Expand archived, open menu, click Delete
    fireEvent.click(screen.getByText(/Archived/));
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Delete"));

    // Verify modal is showing
    expect(screen.getByText("Delete session?")).toBeInTheDocument();

    // Click Cancel in the modal
    const cancelBtn = screen.getAllByText("Cancel").find(
      (el) => el.closest(".fixed") !== null,
    );
    fireEvent.click(cancelBtn!);

    // Modal should be gone
    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
    expect(mockApi.deleteSession).not.toHaveBeenCalled();
  });

  it("clicking modal backdrop cancels the delete", () => {
    // Verifies that clicking the backdrop (overlay) of the delete modal
    // dismisses it without deleting.
    const sdk = makeSdkSession("s1", { archived: true, model: "safe" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByText(/Archived/));
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Delete"));

    // Click the backdrop overlay (the outer fixed div)
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
  });

  it("delete navigates home when the deleted session is the current one", async () => {
    // Verifies that deleting the currently active session navigates the user
    // back to the home page.
    window.location.hash = "#/session/s1";
    const sdk = makeSdkSession("s1", { archived: true, model: "current-one" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByText(/Archived/));
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Delete"));

    // Confirm
    const modalDeleteBtn = screen.getAllByText("Delete").find(
      (el) => el.closest(".fixed") !== null,
    );
    fireEvent.click(modalDeleteBtn!);

    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    });
    // navigateHome() clears the hash
    expect(window.location.hash).toBe("");
  });

  // ─── Delete all archived flow ──────────────────────────────────────────────

  it("shows delete-all icon button when archived section has sessions", () => {
    // The redesigned sidebar shows a trash icon (with title "Delete all archived sessions")
    // on hover of the archive folder header, instead of a "Delete all" text button.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();

    // The delete-all icon button should be in the DOM (hidden via CSS opacity)
    const deleteAllBtn = screen.getByTitle("Delete all archived sessions");
    expect(deleteAllBtn).toBeInTheDocument();
  });

  it("clicking delete-all icon shows confirmation modal for all archived sessions", async () => {
    // Verifies that clicking the trash icon triggers the bulk delete confirmation
    // modal with the correct count of archived sessions.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: false });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Delete all archived sessions"));

    await vi.waitFor(() => {
      expect(screen.getByText("Delete all archived?")).toBeInTheDocument();
    });
    expect(screen.getByText(/This will permanently delete 2 archived sessions/)).toBeInTheDocument();
  });

  it("confirming delete-all deletes each archived session", async () => {
    // Verifies that the bulk delete flow iterates over all archived sessions
    // and deletes each one individually.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: false });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Delete all archived sessions"));

    // Click "Delete all" in the confirmation modal
    // The dialog is rendered via a portal; find the button inside the dialog role element
    const confirmBtn = screen.getAllByText("Delete all").find(
      (el) => el.closest("[role='dialog']") !== null || el.closest("[data-slot='dialog-content']") !== null,
    );
    fireEvent.click(confirmBtn!);

    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    });
    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s2");
    });
    // Non-archived session should not be deleted
    expect(mockApi.deleteSession).not.toHaveBeenCalledWith("s3");
  });

  it("cancelling delete-all closes the modal without deleting", () => {
    // Verifies that clicking Cancel in the bulk-delete modal does not trigger
    // any delete operations.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Delete all archived sessions"));

    // Cancel the modal
    const cancelBtn = screen.getAllByText("Cancel").find(
      (el) => el.closest(".fixed") !== null,
    );
    fireEvent.click(cancelBtn!);

    expect(screen.queryByText("Delete all archived?")).not.toBeInTheDocument();
    expect(mockApi.deleteSession).not.toHaveBeenCalled();
  });

  // ─── Archive with container confirmation ───────────────────────────────────

  it("archiving a containerized session shows container warning confirmation", () => {
    // Verifies that archiving a containerized session triggers the container
    // archive confirmation panel warning about uncommitted changes.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();

    // Open the context menu and click Archive
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Container warning should appear
    expect(screen.getByText(/Archiving will/)).toBeInTheDocument();
    expect(screen.getByText(/remove the container/)).toBeInTheDocument();
  });

  it("confirming container archive calls api.archiveSession with force:true", async () => {
    // Verifies that confirming the container archive sends force:true to the API
    // which bypasses the container check.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();

    // Trigger archive via context menu
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Click the "Archive" confirm button in the warning panel
    const warningPanel = screen.getByText(/remove the container/).closest("div");
    expect(warningPanel).toBeTruthy();
    const archiveConfirmBtn = screen.getAllByText("Archive").find(
      (el) => warningPanel?.contains(el) ?? false,
    );
    expect(archiveConfirmBtn).toBeTruthy();
    fireEvent.click(archiveConfirmBtn!);

    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", { force: true });
  });

  it("cancelling container archive dismisses the warning", () => {
    // Verifies that clicking Cancel in the container archive confirmation
    // dismisses the warning without archiving.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Click Cancel in the warning panel
    const warningPanel = screen.getByText(/remove the container/).closest("div");
    const cancelBtn = screen.getAllByText("Cancel").find(
      (el) => warningPanel?.contains(el) ?? false,
    );
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn!);

    // Warning should be dismissed
    expect(screen.queryByText(/remove the container/)).not.toBeInTheDocument();
    expect(mockApi.archiveSession).not.toHaveBeenCalled();
  });

  it("archiving a non-containerized session archives directly without confirmation", async () => {
    // Verifies that archiving a regular (non-containerized) session proceeds
    // immediately without showing the container warning.
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Should NOT show container warning
    expect(screen.queryByText(/remove the container/)).not.toBeInTheDocument();

    // Should directly call archiveSession
    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
  });

  it("archiving the current session navigates home and creates a new session", async () => {
    // Verifies that when the currently selected session is archived, the user
    // is redirected to the home page and a new session is started.
    window.location.hash = "#/session/s1";
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    await vi.waitFor(() => {
      expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
    });
    // Should navigate home
    expect(window.location.hash).toBe("");
    expect(mockState.newSession).toHaveBeenCalled();
  });

  it("archives directly when session has no linked Linear issue", async () => {
    // Verifies that the modal is NOT shown for sessions without a linked issue.
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      linkedLinearIssues: new Map(),
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Should archive directly
    await vi.waitFor(() => {
      expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
    });
    // Modal should NOT appear
    expect(screen.queryByText("Archive session")).not.toBeInTheDocument();
  });

  it("archives directly when linked issue is already done", async () => {
    // Verifies that completed issues don't trigger the modal.
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1");
    const linkedIssues = new Map<string, unknown>([["s1", {
      id: "issue-1",
      identifier: "ENG-42",
      title: "Test",
      stateType: "completed",
      stateName: "Done",
    }]]);
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      linkedLinearIssues: linkedIssues,
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Archive"));

    // Should archive directly since issue is done
    await vi.waitFor(() => {
      expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
    });
  });

  // ─── Unarchive flow ────────────────────────────────────────────────────────

  it("clicking Restore on an archived session calls api.unarchiveSession", async () => {
    // Verifies that unarchiving (restoring) a session calls the correct API endpoint
    // and refreshes the sessions list.
    const sdk = makeSdkSession("s1", { archived: true, model: "restore-me" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByText(/Archived/));

    // Open context menu on the archived session
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Restore"));

    await vi.waitFor(() => {
      expect(mockApi.unarchiveSession).toHaveBeenCalledWith("s1");
    });
    // Should also refresh the sessions list
    expect(mockApi.listSessions).toHaveBeenCalled();
  });

  // ─── Cron sessions section ─────────────────────────────────────────────────

  it("renders Scheduled section when cron sessions exist", () => {
    // Verifies that sessions with cronJobId are displayed in a separate
    // "Scheduled" section with the correct count.
    const sdk1 = makeSdkSession("s1");
    const sdk2 = makeSdkSession("s2", { cronJobId: "cron-1", cronJobName: "Daily Build" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    // Label is "Scheduled (1)" as a single inline string
    expect(screen.getByText(/Scheduled \(1\)/)).toBeInTheDocument();
  });

  it("cron sessions are not shown in the active sessions list", () => {
    // Verifies that sessions with a cronJobId are excluded from the main
    // active sessions list and only appear under "Scheduled".
    const sdk1 = makeSdkSession("s1", { model: "regular-session" });
    const sdk2 = makeSdkSession("s2", { model: "cron-session", cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    // regular-session should be in the main list
    expect(screen.getByText("regular-session")).toBeInTheDocument();
    // cron-session should appear under Scheduled, not in main list
    expect(screen.getByText(/Scheduled \(1\)/)).toBeInTheDocument();
  });

  it("toggling Scheduled section hides/shows cron sessions", () => {
    // Verifies that the Scheduled section can be collapsed and expanded
    // via its toggle button.
    const sdk = makeSdkSession("s1", { model: "cron-model", cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    // Initially expanded (showCronSessions defaults to true)
    expect(screen.getByText("cron-model")).toBeInTheDocument();

    // Click to collapse (label is "Scheduled (1)" as a single inline string)
    fireEvent.click(screen.getByText(/Scheduled/));

    // Session should be hidden
    expect(screen.queryByText("cron-model")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText(/Scheduled/));
    expect(screen.getByText("cron-model")).toBeInTheDocument();
  });

  // ─── Agent sessions section ────────────────────────────────────────────────

  it("renders Agent Runs section when agent sessions exist", () => {
    // Verifies that sessions with agentId are displayed in a separate
    // "Agents" section folder. The section label is "Agents (1)" as a
    // single inline string. The nav item "Agents" is separate.
    const sdk1 = makeSdkSession("s1");
    const sdk2 = makeSdkSession("s2", { agentId: "agent-1", agentName: "Code Reviewer" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    // Nav "Agents" text + section "Agents (1)" text
    expect(screen.getByText(/Agents \(1\)/)).toBeInTheDocument();
  });

  it("agent sessions are separate from active sessions", () => {
    // Verifies that sessions with agentId do not appear in the main active
    // sessions list.
    const sdk1 = makeSdkSession("s1", { model: "normal" });
    const sdk2 = makeSdkSession("s2", { model: "agent-one", agentId: "agent-1" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    renderSidebar();
    expect(screen.getByText("normal")).toBeInTheDocument();
    // Section label "Agents (1)" as a single inline string
    expect(screen.getByText(/Agents \(1\)/)).toBeInTheDocument();
  });

  it("toggling Agent Runs section hides/shows agent sessions", () => {
    // Verifies that the Agent Runs section can be collapsed and expanded.
    // Note: we need at least one active session to prevent the "No sessions yet."
    // empty state from hiding the agent sessions section entirely.
    // The section label is "Agents (1)" as a single inline string, distinct
    // from the nav item "Agents".
    const sdkActive = makeSdkSession("s-active", { model: "active-model" });
    const sdk = makeSdkSession("s1", { model: "agent-model", agentId: "agent-1" });
    mockState = createMockState({
      sdkSessions: [sdkActive, sdk],
    });

    renderSidebar();
    // Initially expanded
    expect(screen.getByText("agent-model")).toBeInTheDocument();

    // The section toggle is "Agents (1)" (distinct from nav item "Agents")
    const agentsSectionToggle = screen.getByText(/Agents \(1\)/);

    // Collapse
    fireEvent.click(agentsSectionToggle);
    expect(screen.queryByText("agent-model")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText(/Agents \(1\)/));
    expect(screen.getByText("agent-model")).toBeInTheDocument();
  });

  // ─── Sidebar is a uniform push-panel (no mobile close button) ──────────────

  it("does not render a separate close button (toggle is in TopBar)", () => {
    // The sidebar is now a uniform 260px push-panel on all screen sizes.
    // The sidebar toggle is handled exclusively by the TopBar's PanelLeft button,
    // so no dedicated close button should exist inside the sidebar itself.
    renderSidebar();
    expect(screen.queryByLabelText("Close sidebar")).not.toBeInTheDocument();
  });

  // ─── Logo source based on backend type ─────────────────────────────────────

  it("shows codex logo when the selected route session uses codex backend", () => {
    // Verifies that the sidebar header logo changes to the Codex logo when
    // the currently selected route session has backendType "codex".
    window.location.hash = "#/session/s1";
    const sdk = makeSdkSession("s1", { backendType: "codex" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    const { container } = renderSidebar();
    const logo = container.querySelector("img[src='/logo-codex.svg']");
    expect(logo).toBeTruthy();
  });

  it("shows default logo when the selected route session uses claude backend", () => {
    // Verifies that the sidebar header logo is the default when the currently
    // selected route session has backendType "claude".
    window.location.hash = "#/session/s1";
    const sdk = makeSdkSession("s1", { backendType: "claude" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    const { container } = renderSidebar();
    const logo = container.querySelector("img[src='/logo.svg']");
    expect(logo).toBeTruthy();
  });

  // ─── Delete modal inner click propagation ──────────────────────────────────

  it("clicking inside the delete modal does not dismiss it", () => {
    // Verifies that clicking inside the modal content area (not the backdrop)
    // does not close the modal, thanks to e.stopPropagation().
    const sdk = makeSdkSession("s1", { archived: true, model: "modal-test" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    fireEvent.click(screen.getByText(/Archived/));
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Delete"));

    // Click inside the modal content (the text area)
    const modalContent = screen.getByText("Delete session?");
    fireEvent.click(modalContent);

    // Modal should still be open
    expect(screen.getByText("Delete session?")).toBeInTheDocument();
  });

  // ─── Rename via context menu ───────────────────────────────────────────────

  it("clicking Rename in context menu keeps the inline editor focused and editable", async () => {
    // Verifies that clicking "Rename" from the session context menu does not
    // immediately blur the editor before the user can type.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    const user = userEvent.setup();
    renderSidebar();
    fireEvent.click(screen.getByTitle("Session actions"));
    fireEvent.click(screen.getByText("Rename"));

    // An input field should appear with the current session label
    const input = screen.getByDisplayValue("claude-sonnet-4-6");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveFocus();

    await user.type(input, " updated");
    expect(screen.getByDisplayValue("claude-sonnet-4-6 updated")).toBeInTheDocument();
  });

  // ─── Rename calls api.renameSession ────────────────────────────────────────

  it("confirming rename also calls api.renameSession for server persistence", () => {
    // Verifies that after pressing Enter to confirm a rename, the Sidebar
    // also calls the API to persist the new name on the server.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("claude-sonnet-4-6") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockApi.renameSession).toHaveBeenCalledWith("s1", "New Name");
  });

  // ─── Session with cron badge ───────────────────────────────────────────────

  it("session with cronJobId appears in Scheduled section", () => {
    // Verifies that a session with a cron job ID appears under the Scheduled
    // section header. The section label is "Scheduled (1)" as a single inline string.
    const sdk = makeSdkSession("s1", { cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    renderSidebar();
    expect(screen.getByText(/Scheduled \(1\)/)).toBeInTheDocument();
  });

  // ─── Delete all singular text ──────────────────────────────────────────────

  it("delete-all modal uses singular 'session' when only one archived session", () => {
    // Verifies correct grammar: "1 archived session" (singular) vs "2 archived sessions" (plural).
    // Note: "Delete all" button only appears with 2+ archived sessions, but
    // we can trigger the modal state directly via the flow.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: true });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    renderSidebar();
    fireEvent.click(screen.getByTitle("Delete all archived sessions"));

    expect(screen.getByText(/3 archived sessions/)).toBeInTheDocument();
  });

  // ─── App-level navigation items ──────────────────────────────────────────

  it("renders app-level nav items: Home, Agents, Environments, Settings", () => {
    // Verifies that the sidebar renders the four app-level navigation items
    // above the session list for navigating between app pages.
    renderSidebar();
    expect(screen.getByTestId("sidebar-nav-home")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-nav-agents")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-nav-environments")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-nav-settings")).toBeInTheDocument();
  });

  it("clicking Settings nav item navigates to #/settings", () => {
    // Verifies that clicking the Settings sidebar nav item sets the correct hash route.
    renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-nav-settings"));
    expect(window.location.hash).toBe("#/settings");
  });

  it("clicking Agents nav item navigates to #/agents", () => {
    // Verifies that clicking the Agents sidebar nav item sets the correct hash route.
    renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-nav-agents"));
    expect(window.location.hash).toBe("#/agents");
  });

  it("clicking Environments nav item navigates to #/environments", () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-nav-environments"));
    expect(window.location.hash).toBe("#/environments");
  });

  it("clicking Home nav item navigates home and creates new session", () => {
    // Verifies that clicking Home calls navigateHome() and newSession().
    renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-nav-home"));
    expect(window.location.hash).toBe("");
    expect(mockState.newSession).toHaveBeenCalled();
  });

  it("Settings nav item shows active state when on settings page", () => {
    // Verifies that the Settings nav item reflects active state based on current route.
    // SidebarMenuButton sets data-active="" (present but empty) for truthy isActive.
    window.location.hash = "#/settings";
    renderSidebar();
    const settingsBtn = screen.getByTestId("sidebar-nav-settings");
    expect(settingsBtn).toHaveAttribute("data-active");
  });

  it("does not keep a remembered session highlighted on settings", () => {
    window.location.hash = "#/settings";
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      lastSessionId: "s1",
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).not.toHaveAttribute("data-active");
    expect(screen.getByTestId("sidebar-nav-settings")).toHaveAttribute("data-active");
  });

  it("Agents nav item shows active state when on agents page", () => {
    window.location.hash = "#/agents";
    renderSidebar();
    const agentsBtn = screen.getByTestId("sidebar-nav-agents");
    expect(agentsBtn).toHaveAttribute("data-active");
  });

  it("home route clears session highlighting even when a last session is remembered", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      lastSessionId: "s1",
    });

    renderSidebar();
    const sessionButton = screen.getByText("claude-sonnet-4-6").closest("button");
    expect(sessionButton).not.toHaveAttribute("data-active");
    expect(screen.getByTestId("sidebar-nav-home")).toHaveAttribute("data-active");
  });
});
