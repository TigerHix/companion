// @vitest-environment jsdom
/**
 * Tests for the simplified TopBar component.
 * After the navigation redesign, TopBar shows: sidebar toggle, session name + status, and InfoPopover trigger.
 * Workspace tabs, theme toggle, and AI validation toggle have been removed.
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

// Stub InfoPopover to isolate TopBar tests
vi.mock("./InfoPopover.js", () => ({
  InfoPopover: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="info-popover-stub">{sessionId}</div>
  ),
}));

// Mock shadcn sidebar components — SidebarTrigger uses useSidebar context internally.
// We stub it with a plain button to isolate TopBar logic.
const mockToggleSidebar = vi.fn();
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: React.ComponentProps<"button">) => (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        mockToggleSidebar();
        props.onClick?.(e);
      }}
    />
  ),
}));

interface MockStoreState {
  currentSessionId: string | null;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  sessionNames: Map<string, string>;
  sidebarOpen: boolean;
  setSidebarOpen: ReturnType<typeof vi.fn>;
  sdkSessions: { sessionId: string; name?: string }[];
  sessions: Map<string, { cwd?: string }>;
  sessionProcesses: Map<string, { status: string }[]>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    currentSessionId: "s1",
    cliConnected: new Map([["s1", true]]),
    sessionStatus: new Map([["s1", "idle"]]),
    sessionNames: new Map([["s1", "My Session"]]),
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    sdkSessions: [],
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sessionProcesses: new Map(),
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
  window.localStorage.clear();
});

describe("TopBar", () => {
  /** Sidebar toggle button renders and calls toggleSidebar on click */
  it("renders sidebar toggle and calls toggleSidebar on click", () => {
    render(<TopBar />);
    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(mockToggleSidebar).toHaveBeenCalled();
  });

  /** Session name is displayed when a session is active */
  it("displays session name when a session is selected", () => {
    render(<TopBar />);
    expect(screen.getByText("My Session")).toBeInTheDocument();
  });

  /** Session name falls back to truncated ID when no name is set */
  it("falls back to session ID when no name is available", () => {
    resetStore({ sessionNames: new Map() });
    render(<TopBar />);
    expect(screen.getByText("Session s1")).toBeInTheDocument();
  });

  /** InfoPopover is rendered in session view */
  it("renders InfoPopover trigger when in session view", () => {
    render(<TopBar />);
    expect(screen.getByTestId("info-popover-stub")).toBeInTheDocument();
    expect(screen.getByTestId("info-popover-stub")).toHaveTextContent("s1");
  });

  /** No session info or InfoPopover when no session is selected */
  it("hides session info and InfoPopover when no session", () => {
    resetStore({ currentSessionId: null });
    render(<TopBar />);
    expect(screen.queryByText("My Session")).not.toBeInTheDocument();
    expect(screen.queryByTestId("info-popover-stub")).not.toBeInTheDocument();
  });

  /** Connection status dot reflects session connection state */
  it("shows muted status dot when disconnected", () => {
    resetStore({ cliConnected: new Map([["s1", false]]) });
    const { container } = render(<TopBar />);
    const dots = container.querySelectorAll("span.rounded-full");
    const statusDot = Array.from(dots).find(
      (el) => el.classList.contains("w-1\\.5") || el.className.includes("w-1.5"),
    );
    expect(statusDot).toBeTruthy();
  });

  /** Passes axe accessibility checks */
  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    resetStore();
    const { container } = render(<TopBar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
