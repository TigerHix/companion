import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store.js";
import { sendToSession } from "../ws.js";
import { getModelsForBackend } from "../utils/backends.js";
import type { ModelOption } from "../utils/backends.js";
import { Button } from "@/components/ui/button";

interface ModelSwitcherProps {
  sessionId: string;
}

export function ModelSwitcher({ sessionId }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sdkSession = useStore((s) =>
    s.sdkSessions.find((sdk) => sdk.sessionId === sessionId) || null,
  );
  // Runtime session state from WebSocket (has model from CLI init message)
  const runtimeSession = useStore((s) => s.sessions.get(sessionId));
  const cliConnected = useStore((s) => s.cliConnected.get(sessionId) ?? false);

  const backendType = sdkSession?.backendType ?? runtimeSession?.backend_type ?? "claude";
  // Prefer runtime model (from CLI init) over sdkSession model (from launch config)
  const currentModel = runtimeSession?.model ?? sdkSession?.model ?? "";
  const models = getModelsForBackend(backendType);

  // Find the matching model option, or build a fallback for custom models
  const currentOption: ModelOption | null =
    models.find((m) => m.value === currentModel) ||
    (currentModel ? { value: currentModel, label: currentModel, icon: "?" } : null);

  const handleSelect = useCallback(
    (model: string) => {
      setOpen(false);
      if (model === currentModel) return;

      // Send set_model to CLI via WebSocket
      sendToSession(sessionId, { type: "set_model", model });

      // Optimistic update: update sdkSession.model in Zustand store
      const { sdkSessions, setSdkSessions } = useStore.getState();
      setSdkSessions(
        sdkSessions.map((sdk) =>
          sdk.sessionId === sessionId ? { ...sdk, model } : sdk,
        ),
      );
    },
    [sessionId, currentModel],
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Hide for Codex (set_model not supported) or when CLI disconnected
  if (backendType === "codex" || !cliConnected || !currentOption) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        variant="ghost"
        size="sm"
        className={`h-8 px-2 text-xs font-medium ${
          open
            ? "text-foreground bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        title={`Current model: ${currentOption.label}`}
        aria-label="Switch model"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {currentOption.icon && <span className="text-sm leading-none">{currentOption.icon}</span>}
        <span>{currentOption.label}</span>
        <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5 opacity-50">
          <path d="M6 8L1.5 3.5h9L6 8z" />
        </svg>
      </Button>

      {open && (
        <div
          className="absolute right-0 bottom-full mb-1 z-50 min-w-[160px] rounded-lg border border-border bg-background shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Select model"
        >
          {models.map((model) => (
            <Button
              key={model.value}
              type="button"
              onClick={() => handleSelect(model.value)}
              variant="ghost"
              className={`w-full min-h-[44px] justify-start gap-2 rounded-none px-3 text-sm ${
                model.value === currentModel
                  ? "text-foreground bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              role="option"
              aria-selected={model.value === currentModel}
            >
              {model.icon && <span className="text-sm leading-none w-5 text-center">{model.icon}</span>}
              <span className="flex-1 text-left">{model.label}</span>
              {model.value === currentModel && (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-primary shrink-0">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
