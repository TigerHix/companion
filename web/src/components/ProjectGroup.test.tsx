// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ComponentProps } from "react";
import { ProjectGroup } from "./ProjectGroup.js";

vi.mock("./SessionItem.js", () => ({
  SessionItem: ({ sessionName }: { sessionName?: string }) => (
    <div data-testid="session-item">{sessionName}</div>
  ),
}));

function buildProps(
  overrides: Partial<ComponentProps<typeof ProjectGroup>> = {},
): ComponentProps<typeof ProjectGroup> {
  return {
    group: {
      key: "/workspace/app",
      label: "app",
      mostRecentActivity: Date.now(),
      sessions: [
        {
          id: "session-1",
          model: "claude-sonnet-4-6",
          cwd: "/workspace/app",
          gitBranch: "",
          isContainerized: false,
          gitAhead: 0,
          gitBehind: 0,
          linesAdded: 0,
          linesRemoved: 0,
          isConnected: true,
          status: "running",
          sdkState: "connected",
          createdAt: Date.now(),
          archived: false,
          permCount: 0,
          backendType: "claude",
          repoRoot: "/workspace/app",
          cronJobId: undefined,
        },
      ],
      runningCount: 1,
      permCount: 1,
    },
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    currentSessionId: null,
    sessionNames: new Map([["session-1", "App Session"]]),
    pendingPermissions: new Map(),
    recentlyRenamed: new Set(),
    onSelect: vi.fn(),
    onStartRename: vi.fn(),
    onArchive: vi.fn(),
    onUnarchive: vi.fn(),
    onDelete: vi.fn(),
    onClearRecentlyRenamed: vi.fn(),
    editingSessionId: null,
    editingName: "",
    setEditingName: vi.fn(),
    onConfirmRename: vi.fn(),
    onCancelRename: vi.fn(),
    editInputRef: { current: null },
    isFirst: true,
    ...overrides,
  };
}

describe("ProjectGroup", () => {
  it("renders the group header and sessions when expanded", () => {
    // Covers the main sidebar grouping contract so rewrite changes do not hide sessions.
    render(<ProjectGroup {...buildProps()} />);

    expect(screen.getByRole("button", { name: /app/i })).toBeInTheDocument();
    expect(screen.getByTestId("session-item")).toHaveTextContent("App Session");
  });

  it("toggles collapse when the group header is clicked", () => {
    // Confirms the shared button shell still drives the group collapse interaction.
    const onToggleCollapse = vi.fn();
    render(<ProjectGroup {...buildProps({ onToggleCollapse })} />);

    fireEvent.click(screen.getByRole("button", { name: /app/i }));

    expect(onToggleCollapse).toHaveBeenCalledWith("/workspace/app");
  });

  it("shows a collapsed preview when the group is collapsed", () => {
    // Preserves the compact preview text used to scan grouped sessions quickly.
    render(<ProjectGroup {...buildProps({ isCollapsed: true })} />);

    expect(screen.getByText("App Session")).toBeInTheDocument();
    expect(screen.queryByTestId("session-item")).not.toBeInTheDocument();
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<ProjectGroup {...buildProps()} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
