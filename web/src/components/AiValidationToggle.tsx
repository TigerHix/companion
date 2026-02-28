import { useState, useRef, useEffect } from "react";
import { Shield } from "lucide-react";
import { useStore } from "../store.js";
import { sendSetAiValidation } from "../ws.js";
import { Button } from "@/components/ui/button";

interface AiValidationToggleProps {
  sessionId: string;
}

/**
 * Per-session AI validation toggle that appears in the TopBar.
 * Shows a shield icon that opens a dropdown with enable/disable
 * and auto-approve/auto-deny sub-toggles.
 */
export function AiValidationToggle({ sessionId }: AiValidationToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const session = useStore((s) => s.sessions.get(sessionId));

  const enabled = session?.aiValidationEnabled ?? false;
  const autoApprove = session?.aiValidationAutoApprove ?? true;
  const autoDeny = session?.aiValidationAutoDeny ?? true;

  // Close dropdown on outside click
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

  function toggle(
    field: "aiValidationEnabled" | "aiValidationAutoApprove" | "aiValidationAutoDeny",
    currentValue: boolean,
  ) {
    const newValue = !currentValue;
    const patch = { [field]: newValue };
    // Optimistic UI update
    useStore.getState().setSessionAiValidation(sessionId, patch);
    // Send to server via WebSocket
    sendSetAiValidation(sessionId, patch);
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="icon-sm"
        className={`${
          enabled
            ? "text-success hover:bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        title={enabled ? "AI Validation: On" : "AI Validation: Off"}
        aria-label="Toggle AI validation settings"
        aria-expanded={open}
      >
        <Shield className="w-[15px] h-[15px]" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-background border border-border rounded-lg shadow-lg p-2 space-y-1">
          <p className="text-[10px] text-muted-foreground px-2 pt-1 pb-1">
            AI Validation for this session
          </p>

          <Button
            type="button"
            onClick={() => toggle("aiValidationEnabled", enabled)}
            variant="ghost"
            size="sm"
            className="w-full justify-between px-2 py-1.5 text-foreground"
            aria-label="Toggle AI validation"
          >
            <span className="text-xs">Enabled</span>
            <span className={`text-[10px] font-medium ${enabled ? "text-success" : "text-muted-foreground"}`}>
              {enabled ? "On" : "Off"}
            </span>
          </Button>

          {enabled && (
            <>
              <Button
                type="button"
                onClick={() => toggle("aiValidationAutoApprove", autoApprove)}
                variant="ghost"
                size="sm"
                className="w-full justify-between px-2 py-1.5 text-foreground"
                aria-label="Toggle auto-approve safe tools"
              >
                <span className="text-xs">Auto-approve safe</span>
                <span className={`text-[10px] font-medium ${autoApprove ? "text-success" : "text-muted-foreground"}`}>
                  {autoApprove ? "On" : "Off"}
                </span>
              </Button>

              <Button
                type="button"
                onClick={() => toggle("aiValidationAutoDeny", autoDeny)}
                variant="ghost"
                size="sm"
                className="w-full justify-between px-2 py-1.5 text-foreground"
                aria-label="Toggle auto-deny dangerous tools"
              >
                <span className="text-xs">Auto-deny dangerous</span>
                <span className={`text-[10px] font-medium ${autoDeny ? "text-success" : "text-muted-foreground"}`}>
                  {autoDeny ? "On" : "Off"}
                </span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
