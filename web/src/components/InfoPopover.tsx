/**
 * InfoPopover — replaces the right-hand TaskPanel sidebar.
 *
 * Renders a trigger button (for the TopBar) that opens a popover/dropdown
 * containing session context sections: usage limits, git branch, PR status,
 * MCP servers, tasks, and a link to the processes view.
 */

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { useStore } from "../store.js";
import { Button } from "@/components/ui/button";
import { SectionErrorBoundary } from "./SectionErrorBoundary.js";
import { ClaudeConfigBrowser } from "./ClaudeConfigBrowser.js";
import { McpSection } from "./McpPanel.js";
import {
  UsageLimitsRenderer,
  GitBranchSection,
  GitHubPRSection,
  TasksSection,
} from "./session-info-sections.js";

interface InfoPopoverProps {
  sessionId: string;
}

export function InfoPopover({ sessionId }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const runningProcessCount = useStore((s) => {
    const processes = s.sessionProcesses.get(sessionId);
    if (!processes) return 0;
    return processes.filter((p) => p.status === "running").length;
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="icon-sm"
        className={`relative ${
          open
            ? "text-primary bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        title="Session info"
        aria-label="Session info"
        data-testid="info-popover-trigger"
      >
        <Info className="w-[15px] h-[15px]" />
        {runningProcessCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[7px] font-bold leading-none px-0.5">
            {runningProcessCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-[340px] max-h-[80vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-lg z-50"
          data-testid="info-popover-content"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-4 py-2.5 bg-popover border-b border-border">
            <span className="text-sm font-semibold text-foreground tracking-tight">
              Session Info
            </span>
          </div>

          {/* Sections */}
          <div className="divide-y divide-border">
            <SectionErrorBoundary label="Config">
              <ClaudeConfigBrowser sessionId={sessionId} />
            </SectionErrorBoundary>

            <SectionErrorBoundary label="Usage Limits">
              <UsageLimitsRenderer sessionId={sessionId} />
            </SectionErrorBoundary>

            <SectionErrorBoundary label="Git Branch">
              <GitBranchSection sessionId={sessionId} />
            </SectionErrorBoundary>

            <SectionErrorBoundary label="GitHub PR">
              <GitHubPRSection sessionId={sessionId} />
            </SectionErrorBoundary>

            <SectionErrorBoundary label="MCP Servers">
              <McpSection sessionId={sessionId} />
            </SectionErrorBoundary>

            <SectionErrorBoundary label="Tasks">
              <TasksSection sessionId={sessionId} />
            </SectionErrorBoundary>

            {/* Processes shortcut */}
            {runningProcessCount > 0 && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    useStore.getState().setActiveTab("processes");
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                  data-testid="info-popover-processes"
                >
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {runningProcessCount}
                  </span>
                  View running processes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
