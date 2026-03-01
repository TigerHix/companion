import { useMemo, useSyncExternalStore } from "react";
import { PanelLeftIcon } from "lucide-react";
import { useStore } from "../store.js";
import { parseHash } from "../utils/routing.js";
import { InfoPopover } from "./InfoPopover.js";
import { useSidebar } from "@/components/ui/sidebar";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";

export function TopBar() {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
  );
  const route = useMemo(() => parseHash(hash), [hash]);
  const isSessionView = route.page === "session" || route.page === "home";
  const currentSessionId = useStore((s) => s.currentSessionId);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const sessionNames = useStore((s) => s.sessionNames);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const { toggleSidebar } = useSidebar();

  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const sessionName = currentSessionId
    ? (sessionNames?.get(currentSessionId) ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showSessionInfo = !!(currentSessionId && isSessionView);

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 px-4 bg-background">
      <LiquidGlassButton
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        data-testid="sidebar-trigger"
      >
        <PanelLeftIcon className="size-4" />
      </LiquidGlassButton>

      {/* Center: Session name + status dot */}
      {showSessionInfo && (
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            !isConnected
              ? "bg-muted-foreground opacity-45"
              : status === "running"
                ? "bg-primary"
                : status === "compacting"
                  ? "bg-warning"
                  : "bg-success"
          }`} />
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={sessionName || undefined}>
            {sessionName}
          </span>
        </div>
      )}

      {/* Spacer when no session info */}
      {!showSessionInfo && <div className="flex-1" />}

      {/* Right: Info popover */}
      <div className="flex items-center gap-0.5 shrink-0">
        {showSessionInfo && currentSessionId && (
          <InfoPopover sessionId={currentSessionId} />
        )}
      </div>
    </header>
  );
}
