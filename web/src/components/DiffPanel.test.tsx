// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockApi = {
  getFileDiff: vi.fn().mockResolvedValue({ path: "/repo/file.ts", diff: "" }),
  getChangedFiles: vi.fn().mockResolvedValue({ files: [] }),
};

vi.mock("../api.js", () => ({
  api: {
    getFileDiff: (...args: unknown[]) => mockApi.getFileDiff(...args),
    getChangedFiles: (...args: unknown[]) => mockApi.getChangedFiles(...args),
  },
}));

// ─── Store mock ─────────────────────────────────────────────────────────────

interface MockStoreState {
  sessions: Map<string, { cwd?: string }>;
  sdkSessions: { sessionId: string; cwd?: string }[];
  diffPanelSelectedFile: Map<string, string>;
  changedFilesTick: Map<string, number>;
  setDiffPanelSelectedFile: ReturnType<typeof vi.fn>;
  setGitChangedFilesCount: ReturnType<typeof vi.fn>;
  diffBase: "last-commit" | "default-branch";
  setDiffBase: ReturnType<typeof vi.fn>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sdkSessions: [],
    diffPanelSelectedFile: new Map(),
    changedFilesTick: new Map(),
    setDiffPanelSelectedFile: vi.fn(),
    setGitChangedFilesCount: vi.fn(),
    diffBase: "last-commit",
    setDiffBase: vi.fn(),
    ...overrides,
  };
}

vi.mock("../store.js", () => ({
  useStore: (selector: (s: MockStoreState) => unknown) => selector(storeState),
}));

import { DiffPanel } from "./DiffPanel.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  // Default: no changed files from git
  mockApi.getChangedFiles.mockResolvedValue({ files: [] });
});

describe("DiffPanel", () => {
  it("shows empty state when no files changed", async () => {
    render(<DiffPanel sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("No changes yet")).toBeInTheDocument();
    });
  });

  it("displays changed files in sidebar", async () => {
    // Validates that git-reported changed files are shown with correct count and labels.
    mockApi.getChangedFiles.mockResolvedValue({
      files: [
        { path: "/repo/src/app.ts", status: "M" },
        { path: "/repo/src/utils.ts", status: "A" },
      ],
    });

    render(<DiffPanel sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("Changed (2)")).toBeInTheDocument();
    });
    expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/utils.ts").length).toBeGreaterThan(0);
  });

  it("hides changed files outside the session cwd", async () => {
    // Validates that only files within the session cwd are shown.
    mockApi.getChangedFiles.mockResolvedValue({
      files: [
        { path: "/repo/src/app.ts", status: "M" },
        { path: "/Users/stan/.claude/plans/plan.md", status: "M" },
      ],
    });

    render(<DiffPanel sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("Changed (1)")).toBeInTheDocument();
    });
    expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    expect(screen.queryByText("/Users/stan/.claude/plans/plan.md")).not.toBeInTheDocument();
  });

  it("shows changed filenames in the main debug list view", async () => {
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/src/app.ts", status: "M" }],
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/src/app.ts"]]),
    });

    render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("vs last commit")).toBeInTheDocument();
  });

  it("keeps the rendered-diff debug list in the main content area", async () => {
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/src/app.ts", status: "M" }],
    });
    mockApi.getFileDiff.mockResolvedValue({
      path: "/repo/src/app.ts",
      diff: `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-old
+new`,
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/src/app.ts"]]),
    });

    const { container } = render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    });

    expect(container.textContent).toContain("Single-file rendered diff with sidebar switching to keep mobile scrolling fast");
    expect(container.textContent).toContain("app.ts");
    await waitFor(() => {
      expect(container.querySelector(".diff-viewer")).toBeTruthy();
      expect(container.querySelector(".diff-line-add")).toBeTruthy();
    });
  });

  it("shows rendered diff content for each changed file", async () => {
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/file.ts", status: "M" }],
    });
    mockApi.getFileDiff.mockResolvedValue({
      path: "/repo/file.ts",
      diff: `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-before
+after`,
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/file.ts"]]),
    });

    render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getAllByText("file.ts").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(document.querySelector(".diff-viewer")).toBeTruthy();
      expect(document.querySelector(".diff-line-add")).toBeTruthy();
    });
    expect(mockApi.getFileDiff).toHaveBeenCalledWith("/repo/file.ts", "last-commit");
  });

  it("renders only the active file diff in the main pane", async () => {
    mockApi.getChangedFiles.mockResolvedValue({
      files: [
        { path: "/repo/src/a.ts", status: "M" },
        { path: "/repo/src/b.ts", status: "M" },
      ],
    });
    mockApi.getFileDiff.mockImplementation(async (path: string) => ({
      path,
      diff: `diff --git a/${path.endsWith("a.ts") ? "src/a.ts" : "src/b.ts"} b/${path.endsWith("a.ts") ? "src/a.ts" : "src/b.ts"}
--- a/${path.endsWith("a.ts") ? "src/a.ts" : "src/b.ts"}
+++ b/${path.endsWith("a.ts") ? "src/a.ts" : "src/b.ts"}
@@ -1 +1 @@
-before
+after`,
    }));

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/src/b.ts"]]),
    });

    const { container } = render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getAllByText("src/b.ts").length).toBeGreaterThan(0);
    });

    expect(container.textContent).not.toContain("/repo/src/a.ts/repo/src/a.ts");
    expect(container.textContent).toContain("/repo/src/b.ts");
  });

  it("shows waiting message when session has no cwd", () => {
    resetStore({
      sessions: new Map([["s1", {}]]),
    });

    render(<DiffPanel sessionId="s1" />);
    expect(screen.getByText("Waiting for session to initialize...")).toBeInTheDocument();
  });

  it("shows the default-branch label in the list debug view", async () => {
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/src/app.ts", status: "M" }],
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/src/app.ts"]]),
      diffBase: "default-branch",
    });

    render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("vs default branch")).toBeInTheDocument();
  });

  it("toggles diff base when label button is clicked", async () => {
    // Validates that clicking the diff base toggle calls setDiffBase with the opposite value.
    mockApi.getFileDiff.mockResolvedValueOnce({ path: "/repo/src/app.ts", diff: "some diff" });
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/src/app.ts", status: "M" }],
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/repo/src/app.ts"]]),
      diffBase: "last-commit",
    });

    render(<DiffPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("vs last commit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("vs last commit"));
    expect(storeState.setDiffBase).toHaveBeenCalledWith("default-branch");
  });

  it("reselects when selected file is outside cwd scope", async () => {
    // Validates that if the selected file is outside the cwd, it reselects to the first in-scope file.
    mockApi.getChangedFiles.mockResolvedValue({
      files: [{ path: "/repo/src/inside.ts", status: "M" }],
    });

    resetStore({
      diffPanelSelectedFile: new Map([["s1", "/Users/stan/.claude/plans/plan.md"]]),
    });

    render(<DiffPanel sessionId="s1" />);
    await waitFor(() => {
      expect(storeState.setDiffPanelSelectedFile).toHaveBeenCalledWith("s1", "/repo/src/inside.ts");
    });
  });
});
