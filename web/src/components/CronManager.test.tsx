// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CronManager } from "./CronManager.js";

const apiMocks = vi.hoisted(() => ({
  listCronJobs: vi.fn(),
  toggleCronJob: vi.fn(),
  runCronJob: vi.fn(),
}));

vi.mock("../api.js", () => ({
  api: {
    listCronJobs: apiMocks.listCronJobs,
    toggleCronJob: apiMocks.toggleCronJob,
    runCronJob: apiMocks.runCronJob,
    createCronJob: vi.fn(),
    updateCronJob: vi.fn(),
    deleteCronJob: vi.fn(),
  },
}));

vi.mock("./FolderPicker.js", () => ({
  FolderPicker: () => <div data-testid="folder-picker">Folder picker</div>,
}));

describe("CronManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listCronJobs.mockResolvedValue([
      {
        id: "job-1",
        name: "Daily review",
        prompt: "Summarize repo changes",
        recurring: true,
        schedule: "0 8 * * *",
        backendType: "codex",
        model: "gpt-5-codex",
        cwd: "/workspace/app",
        enabled: true,
        consecutiveFailures: 0,
        nextRunAt: Date.now() + 60_000,
        lastRunAt: Date.now() - 60_000,
        totalRuns: 3,
      },
    ]);
    apiMocks.toggleCronJob.mockResolvedValue({});
    apiMocks.runCronJob.mockResolvedValue({});
  });

  it("renders the scheduled jobs list in embedded mode", async () => {
    render(<CronManager />);

    expect(await screen.findByText("Daily review")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByTestId("cron-row-toggle-job-1")).toHaveAttribute("role", "switch");
  });

  it("toggles a job through the shared switch primitive", async () => {
    render(<CronManager />);

    fireEvent.click(await screen.findByTestId("cron-row-toggle-job-1"));

    await waitFor(() => {
      expect(apiMocks.toggleCronJob).toHaveBeenCalledWith("job-1");
    });
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<CronManager />);

    await screen.findByText("Daily review");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
