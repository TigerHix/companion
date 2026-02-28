import { useState, useEffect, useRef, useCallback } from "react";
import type { CreationProgressEvent } from "../api.js";
import { Button } from "@/components/ui/button";

interface Props {
  steps: CreationProgressEvent[];
  error?: string | null;
}

/** Steps whose detail lines should be accumulated and shown as a log area. */
const LOG_STEPS = new Set(["pulling_image", "running_init_script", "building_image"]);

export function SessionCreationProgress({ steps, error }: Props) {
  // Accumulate detail lines per step (the store only keeps the latest event)
  const [detailLogs, setDetailLogs] = useState<Record<string, string[]>>({});
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const logRefsMap = useRef<Map<string, HTMLPreElement>>(new Map());

  const setLogRef = useCallback((step: string) => (el: HTMLPreElement | null) => {
    if (el) logRefsMap.current.set(step, el);
    else logRefsMap.current.delete(step);
  }, []);

  // When a step's detail changes, append it to that step's log
  useEffect(() => {
    for (const step of steps) {
      if (step.detail && LOG_STEPS.has(step.step)) {
        setDetailLogs((prev) => {
          const existing = prev[step.step] || [];
          // Only append if this is a new line (avoid duplicates from re-renders)
          if (existing.length === 0 || existing[existing.length - 1] !== step.detail) {
            return { ...prev, [step.step]: [...existing, step.detail!] };
          }
          return prev;
        });
        // Auto-expand when details start arriving
        setExpandedSteps((prev) => {
          if (prev.has(step.step)) return prev;
          const next = new Set(prev);
          next.add(step.step);
          return next;
        });
      }
    }
  }, [steps]);

  // Auto-scroll all expanded log areas
  useEffect(() => {
    for (const el of logRefsMap.current.values()) {
      el.scrollTo?.({ top: el.scrollHeight });
    }
  }, [detailLogs]);

  if (steps.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-4 mb-2">
      <div className="space-y-1.5">
        {steps.map((step) => {
          const logs = detailLogs[step.step];
          const hasLogs = logs && logs.length > 0;
          const isExpanded = expandedSteps.has(step.step);

          return (
            <div key={step.step}>
              <div className="flex items-center gap-2.5 py-1">
                {/* Status icon */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {step.status === "in_progress" && (
                    <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                  {step.status === "done" && (
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-success">
                      <path
                        d="M13.25 4.75L6 12 2.75 8.75"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {step.status === "error" && (
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-destructive">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm flex-1 ${
                    step.status === "in_progress"
                      ? "text-foreground font-medium"
                      : step.status === "done"
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }`}
                >
                  {step.label}
                </span>

                {/* Toggle log visibility */}
                {hasLogs && (
                  <Button
                    type="button"
                    onClick={() => setExpandedSteps((prev) => {
                      const next = new Set(prev);
                      if (next.has(step.step)) next.delete(step.step);
                      else next.add(step.step);
                      return next;
                    })}
                    variant="ghost"
                    size="xs"
                    className="h-auto px-0 py-0 text-[10px] text-muted-foreground"
                  >
                    {isExpanded ? "Hide logs" : "Show logs"}
                  </Button>
                )}
              </div>

              {/* Detail log area */}
              {hasLogs && isExpanded && (
                <pre
                  ref={setLogRef(step.step)}
                  className="ml-[26px] mt-1 mb-1 px-3 py-2 text-[10px] font-mono bg-black/20 border border-border rounded-md text-muted-foreground max-h-[150px] overflow-auto whitespace-pre-wrap"
                >
                  {logs.slice(-30).join("\n")}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-2.5 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-xs text-destructive whitespace-pre-wrap">{error}</p>
        </div>
      )}
    </div>
  );
}
