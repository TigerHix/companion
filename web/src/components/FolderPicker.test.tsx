// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FolderPicker } from "./FolderPicker.js";

const apiMocks = vi.hoisted(() => ({
  listDirs: vi.fn(),
}));

const recentDirMocks = vi.hoisted(() => ({
  getRecentDirs: vi.fn(),
  addRecentDir: vi.fn(),
}));

vi.mock("../api.js", () => ({
  api: {
    listDirs: apiMocks.listDirs,
  },
}));

vi.mock("../utils/recent-dirs.js", () => ({
  getRecentDirs: recentDirMocks.getRecentDirs,
  addRecentDir: recentDirMocks.addRecentDir,
}));

describe("FolderPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listDirs.mockResolvedValue({
      path: "/workspace",
      dirs: [
        { name: "app", path: "/workspace/app" },
      ],
    });
    recentDirMocks.getRecentDirs.mockReturnValue(["/recent/project"]);
  });

  it("renders the dialog and loaded directories", async () => {
    render(<FolderPicker initialPath="/workspace" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Select Folder")).toBeInTheDocument();
    expect(await screen.findByText("app")).toBeInTheDocument();
    expect(screen.getByText("/recent/project")).toBeInTheDocument();
  });

  it("selects a recent directory and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<FolderPicker initialPath="/workspace" onSelect={onSelect} onClose={onClose} />);

    fireEvent.click(await screen.findByText("project"));

    await waitFor(() => {
      expect(recentDirMocks.addRecentDir).toHaveBeenCalledWith("/recent/project");
      expect(onSelect).toHaveBeenCalledWith("/recent/project");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<FolderPicker initialPath="/workspace" onSelect={vi.fn()} onClose={vi.fn()} />);

    await screen.findByText("app");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
