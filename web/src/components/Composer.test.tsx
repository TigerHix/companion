// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SessionState } from "../../server/session-types.js";

// Polyfill scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

const mockSendToSession = vi.fn();
const mockGetClaudeConfig = vi.fn();

// Build a controllable mock store state
let mockStoreState: Record<string, unknown> = {};

vi.mock("../ws.js", () => ({
  sendToSession: (...args: unknown[]) => mockSendToSession(...args),
}));

vi.mock("../api.js", () => ({
  api: {
    gitPull: vi.fn().mockResolvedValue({ success: true, output: "", git_ahead: 0, git_behind: 0 }),
    getClaudeConfig: (...args: unknown[]) => mockGetClaudeConfig(...args),
  },
}));

// Mock useStore as a function that takes a selector
const mockAppendMessage = vi.fn();
const mockUpdateSession = vi.fn();
const mockSetPreviousPermissionMode = vi.fn();

vi.mock("../store.js", () => {
  // Create a mock store function that acts like zustand's useStore
  const useStore = (selector: (state: Record<string, unknown>) => unknown) => {
    return selector(mockStoreState);
  };
  // Add getState for imperative access (used by Composer for appendMessage)
  useStore.getState = () => mockStoreState;
  return { useStore };
});

import { Composer } from "./Composer.js";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: "s1",
    model: "claude-sonnet-4-6",
    cwd: "/test",
    tools: [],
    permissionMode: "acceptEdits",
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

function setupMockStore(overrides: {
  isConnected?: boolean;
  sessionStatus?: "idle" | "running" | "compacting" | null;
  session?: Partial<SessionState>;
} = {}) {
  const {
    isConnected = true,
    sessionStatus = "idle",
    session = {},
  } = overrides;

  const sessionsMap = new Map<string, SessionState>();
  sessionsMap.set("s1", makeSession(session));

  const cliConnectedMap = new Map<string, boolean>();
  cliConnectedMap.set("s1", isConnected);

  const sessionStatusMap = new Map<string, "idle" | "running" | "compacting" | null>();
  sessionStatusMap.set("s1", sessionStatus);

  const previousPermissionModeMap = new Map<string, string>();
  previousPermissionModeMap.set("s1", "acceptEdits");

  mockStoreState = {
    sessions: sessionsMap,
    cliConnected: cliConnectedMap,
    sessionStatus: sessionStatusMap,
    previousPermissionMode: previousPermissionModeMap,
    sdkSessions: [{ sessionId: "s1", model: "claude-sonnet-4-6", backendType: "claude", cwd: "/test" }],
    sessionNames: new Map<string, string>(),
    appendMessage: mockAppendMessage,
    updateSession: mockUpdateSession,
    setPreviousPermissionMode: mockSetPreviousPermissionMode,
    setSdkSessions: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClaudeConfig.mockResolvedValue({
    project: { root: "/test", claudeMd: [], settings: null, settingsLocal: null, commands: [] },
    user: { root: "/home/test/.claude", claudeMd: null, skills: [], agents: [], settings: null, commands: [] },
  });
  setupMockStore();
});

// ─── Basic rendering ────────────────────────────────────────────────────────

describe("Composer basic rendering", () => {
  it("renders textarea and send button", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
    // Send button (the round one with the arrow SVG) - identified by title
    const sendBtn = screen.getAllByTitle("Send message")[0];
    expect(sendBtn).toBeTruthy();
  });
});

// ─── Send button disabled state ──────────────────────────────────────────────

describe("Composer send button state", () => {
  it("send button is disabled when text is empty", () => {
    render(<Composer sessionId="s1" />);
    const sendBtn = screen.getAllByTitle("Send message")[0];
    expect(sendBtn.hasAttribute("disabled")).toBe(true);
  });

  it("send button is disabled when CLI is not connected", () => {
    setupMockStore({ isConnected: false });
    render(<Composer sessionId="s1" />);
    const sendBtn = screen.getAllByTitle("Send message")[0];
    expect(sendBtn.hasAttribute("disabled")).toBe(true);
  });

  it("typing text enables the send button", async () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "Hello world" } });

    const sendBtn = screen.getAllByTitle("Send message")[0];
    expect(sendBtn.hasAttribute("disabled")).toBe(false);
  });
});

// ─── Sending messages ────────────────────────────────────────────────────────

describe("Composer sending messages", () => {
  it("pressing Enter sends the message via sendToSession", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "test message" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(mockSendToSession).toHaveBeenCalledWith("s1", expect.objectContaining({
      type: "user_message",
      content: "test message",
      session_id: "s1",
    }));
  });

  it("pressing Shift+Enter does NOT send the message", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "line 1" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockSendToSession).not.toHaveBeenCalled();
  });

  it("clicking the send button sends the message", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "click send" } });
    fireEvent.click(screen.getAllByTitle("Send message")[0]);

    expect(mockSendToSession).toHaveBeenCalledWith("s1", expect.objectContaining({
      type: "user_message",
      content: "click send",
    }));
  });

  it("textarea is cleared after sending", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")! as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "to be cleared" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(textarea.value).toBe("");
  });
});

// ─── Plan mode toggle ────────────────────────────────────────────────────────

describe("Composer plan mode toggle", () => {
  it("pressing Shift+Tab toggles plan mode", () => {
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });

    // Should call sendToSession to set plan mode
    expect(mockSendToSession).toHaveBeenCalledWith("s1", {
      type: "set_permission_mode",
      mode: "plan",
    });
  });
});

// ─── Interrupt button ────────────────────────────────────────────────────────

describe("Composer interrupt button", () => {
  it("interrupt button appears when session is running", () => {
    setupMockStore({ sessionStatus: "running" });
    render(<Composer sessionId="s1" />);

    const stopBtn = screen.getAllByTitle("Stop generation")[0];
    expect(stopBtn).toBeTruthy();
    // Send button should not be present (both mobile and desktop show stop)
    expect(screen.queryAllByTitle("Send message")).toHaveLength(0);
  });

  it("interrupt button sends interrupt message", () => {
    setupMockStore({ sessionStatus: "running" });
    render(<Composer sessionId="s1" />);

    fireEvent.click(screen.getAllByTitle("Stop generation")[0]);

    expect(mockSendToSession).toHaveBeenCalledWith("s1", { type: "interrupt" });
  });

  it("send button appears when session is idle", () => {
    setupMockStore({ sessionStatus: "idle" });
    render(<Composer sessionId="s1" />);

    expect(screen.getAllByTitle("Send message")[0]).toBeTruthy();
    expect(screen.queryAllByTitle("Stop generation")).toHaveLength(0);
  });
});

// ─── Slash menu ──────────────────────────────────────────────────────────────

describe("Composer slash menu", () => {
  it("slash menu opens when typing /", () => {
    setupMockStore({
      session: {
        slash_commands: ["/help", "/clear"],
        skills: ["commit"],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });

    // Commands should appear in the menu
    expect(screen.getByText("/help")).toBeTruthy();
    expect(screen.getByText("/clear")).toBeTruthy();
    expect(screen.getByText("/commit")).toBeTruthy();
  });

  it("renders the slash menu above adjacent chat chrome when open", () => {
    setupMockStore({
      session: {
        slash_commands: ["/help"],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });

    expect(screen.getByText("/help").closest("div.z-40")).toBeTruthy();
  });

  it("slash commands are filtered as user types", () => {
    setupMockStore({
      session: {
        slash_commands: ["/help", "/clear"],
        skills: ["commit"],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/cl" } });

    expect(screen.getByText("/clear")).toBeTruthy();
    expect(screen.queryByText("/help")).toBeNull();
    // "commit" does not match "cl" so it should not appear either
    expect(screen.queryByText("/commit")).toBeNull();
  });

  it("slash menu still opens with an empty-state message when there are no commands", () => {
    setupMockStore({
      session: {
        slash_commands: [],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });

    expect(screen.getByText("No slash commands available yet.")).toBeTruthy();
  });

  it("falls back to local config commands when session slash metadata is missing", async () => {
    mockGetClaudeConfig.mockResolvedValue({
      project: {
        root: "/test",
        claudeMd: [],
        settings: null,
        settingsLocal: null,
        commands: [{ name: "deploy", path: "/test/.claude/commands/deploy.md" }],
      },
      user: {
        root: "/home/test/.claude",
        claudeMd: null,
        skills: [{ slug: "release-helper", name: "Release Helper", description: "", path: "/home/test/.claude/skills/release-helper/SKILL.md" }],
        agents: [],
        settings: null,
        commands: [{ name: "ship", path: "/home/test/.claude/commands/ship.md" }],
      },
    });
    setupMockStore({
      session: {
        slash_commands: [],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    await waitFor(() => {
      expect(mockGetClaudeConfig).toHaveBeenCalledWith("/test");
    });

    fireEvent.change(textarea, { target: { value: "/" } });

    expect(await screen.findByText("/deploy")).toBeTruthy();
    expect(screen.getByText("/ship")).toBeTruthy();
    expect(screen.getByText("/release-helper")).toBeTruthy();
  });

  it("slash menu shows command types", () => {
    setupMockStore({
      session: {
        slash_commands: ["/help"],
        skills: ["commit"],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });

    // Each command should display its type
    expect(screen.getByText("command")).toBeTruthy();
    expect(screen.getByText("skill")).toBeTruthy();
  });
});

// ─── Disabled state ──────────────────────────────────────────────────────────

describe("Composer disabled state", () => {
  it("textarea is disabled when CLI is not connected", () => {
    setupMockStore({ isConnected: false });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")! as HTMLTextAreaElement;

    expect(textarea.disabled).toBe(true);
  });

  it("textarea shows correct placeholder when connected", () => {
    setupMockStore({ isConnected: true });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")! as HTMLTextAreaElement;

    expect(textarea.placeholder).toContain("Type a message");
  });

  it("textarea shows waiting placeholder when not connected", () => {
    setupMockStore({ isConnected: false });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")! as HTMLTextAreaElement;

    expect(textarea.placeholder).toContain("Waiting for CLI connection");
  });
});

// ─── Keyboard navigation ────────────────────────────────────────────────────

describe("Composer keyboard navigation", () => {
  it("Escape in the slash menu does not send a message", () => {
    // Verifies pressing Escape while the slash menu is open does not trigger
    // a message send — the key event should be consumed by the menu handler.
    setupMockStore({
      session: {
        slash_commands: ["/help", "/clear"],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });
    expect(screen.getByText("/help")).toBeTruthy();

    fireEvent.keyDown(textarea, { key: "Escape" });

    // Escape should NOT send any message
    expect(mockSendToSession).not.toHaveBeenCalled();
    // The text should still be "/" (not cleared)
    expect((textarea as HTMLTextAreaElement).value).toBe("/");
  });

  it("ArrowDown/ArrowUp cycles through slash menu items", () => {
    // Verifies keyboard arrow navigation within the slash command menu.
    setupMockStore({
      session: {
        slash_commands: ["/help", "/clear"],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });
    // First item should be highlighted by default (index 0)
    const items = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.startsWith("/"),
    );
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Arrow down should move selection — pressing Enter selects the item
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyDown(textarea, { key: "Enter" });

    // The selected command should replace the textarea content
    expect((textarea as HTMLTextAreaElement).value).toContain("/clear");
  });

  it("Enter selects the highlighted slash command", () => {
    // Verifies that pressing Enter in the slash menu selects the command
    // without sending it as a message.
    setupMockStore({
      session: {
        slash_commands: ["/help"],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;

    fireEvent.change(textarea, { target: { value: "/" } });
    expect(screen.getByText("/help")).toBeTruthy();

    fireEvent.keyDown(textarea, { key: "Enter" });
    // Should NOT send a WebSocket message — it should just fill the command
    expect(mockSendToSession).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe("/help ");
  });

  it("replaces the slash token at the caret instead of overwriting the whole message", () => {
    setupMockStore({
      session: {
        slash_commands: ["/help"],
        skills: [],
      },
    });
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")! as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: "prefix /he suffix", selectionStart: 10 },
    });

    fireEvent.click(screen.getByText("/help"));

    expect(textarea.value).toBe("prefix /help suffix");
  });
});

// ─── Layout & overflow ──────────────────────────────────────────────────────

describe("Composer layout", () => {
  it("textarea has overflow-y-auto to handle long content", () => {
    // Verifies the textarea scrolls vertically rather than expanding infinitely.
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;
    expect(textarea.className).toContain("overflow-y-auto");
  });

  it("send button has consistent dimensions", () => {
    // Verifies the send button has explicit sizing classes for consistent layout.
    // The button uses shadcn size variants, so it should expose either
    // explicit width/height classes or a compact `size-*` utility.
    render(<Composer sessionId="s1" />);
    const sendBtns = screen.getAllByTitle("Send message");
    expect(sendBtns.length).toBeGreaterThanOrEqual(1);
    const hasSize = sendBtns.some((btn) => btn.className.includes("w-") || btn.className.includes("size-"));
    expect(hasSize).toBe(true);
  });

  it("textarea is full-width within its container", () => {
    // Verifies the textarea stretches to fill the input area.
    const { container } = render(<Composer sessionId="s1" />);
    const textarea = container.querySelector("textarea")!;
    expect(textarea.className).toContain("w-full");
  });
});

it("passes axe accessibility checks", async () => {
  const { axe } = await import("vitest-axe");
  setupMockStore({ isConnected: true });
  const { container } = render(<Composer sessionId="s1" />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
