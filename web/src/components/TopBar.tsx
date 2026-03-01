import { useMemo, useSyncExternalStore } from "react";
import { useStore } from "../store.js";
import { parseHash } from "../utils/routing.js";
import { InfoPopover } from "./InfoPopover.js";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

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

  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const sessionName = currentSessionId
    ? (sessionNames?.get(currentSessionId) ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showSessionInfo = !!(currentSessionId && isSessionView);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 px-4 bg-background">
      {/* sidebar-04 pattern: SidebarTrigger + vertical separator */}
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      />

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
          <span className="text-[12px] font-medium text-foreground truncate max-w-[200px]" title={sessionName || undefined}>
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
