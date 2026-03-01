import { useMemo } from "react";
import { useStore, type QuickTerminalPlacement } from "../store.js";
import { TerminalView } from "./TerminalView.js";
import { Button } from "@/components/ui/button";
interface SessionTerminalDockProps {
  sessionId: string;
  children?: React.ReactNode;
  terminalOnly?: boolean;
  onClosePanel?: () => void;
  suppressPanel?: boolean;
}

function placementLayout(placement: QuickTerminalPlacement) {
  if (placement === "left") {
    return {
      shellClass: "flex-row",
      terminalWrapClass: "w-[42%] min-w-[300px] max-w-[70%] border-r border-border order-1",
      contentWrapClass: "flex-1 min-w-0 order-2",
    };
  }
  if (placement === "right") {
    return {
      shellClass: "flex-row",
      terminalWrapClass: "w-[42%] min-w-[300px] max-w-[70%] border-l border-border order-2",
      contentWrapClass: "flex-1 min-w-0 order-1",
    };
  }
  if (placement === "top") {
    return {
      shellClass: "flex-col",
      terminalWrapClass: "h-[38%] min-h-[220px] max-h-[70%] border-b border-border order-1",
      contentWrapClass: "flex-1 min-h-0 order-2",
    };
  }
  return {
    shellClass: "flex-col",
    terminalWrapClass: "h-[38%] min-h-[220px] max-h-[70%] border-t border-border order-2",
    contentWrapClass: "flex-1 min-h-0 order-1",
  };
}

export function SessionTerminalDock({
  sessionId,
  children,
  terminalOnly = false,
  onClosePanel,
  suppressPanel = false,
}: SessionTerminalDockProps) {
  const currentSessionId = useStore((s) => s.currentSessionId);
  const quickTerminalOpen = useStore((s) => s.quickTerminalOpen);
  const quickTerminalTabs = useStore((s) => s.quickTerminalTabs);
  const activeQuickTerminalTabId = useStore((s) => s.activeQuickTerminalTabId);
  const quickTerminalPlacement = useStore((s) => s.quickTerminalPlacement);
  const setQuickTerminalOpen = useStore((s) => s.setQuickTerminalOpen);
  const openQuickTerminal = useStore((s) => s.openQuickTerminal);
  const closeQuickTerminalTab = useStore((s) => s.closeQuickTerminalTab);
  const setActiveQuickTerminalTabId = useStore((s) => s.setActiveQuickTerminalTabId);

  const cwd = useStore((s) => {
    if (!currentSessionId) return null;
    return (
      s.sessions.get(currentSessionId)?.cwd
      || s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.cwd
      || null
    );
  });
  const sdkSession = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId) || null;
  });
  const defaultNewTerminalOpts = sdkSession?.containerId
    ? { target: "docker" as const, cwd: "/workspace", containerId: sdkSession.containerId }
    : (cwd ? { target: "host" as const, cwd } : null);

  const hasPanel = currentSessionId === sessionId && quickTerminalOpen && quickTerminalTabs.length > 0;
  const layout = useMemo(
    () => placementLayout(quickTerminalPlacement),
    [quickTerminalPlacement],
  );

  const closeDock = () => {
    setQuickTerminalOpen(false);
    onClosePanel?.();
  };

  if (!hasPanel) {
    if (terminalOnly) {
      return (
        <div className="h-full min-h-0 flex items-center justify-center bg-background">
          <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-5 text-center">
            <h3 className="text-sm font-semibold text-foreground">Terminal ready</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Open a terminal tab to work directly in this session workspace.
            </p>
            {defaultNewTerminalOpts && (
              <Button
                type="button"
                onClick={() => openQuickTerminal(defaultNewTerminalOpts)}
                size="sm"
                className="mt-4 text-xs font-semibold"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zm3.2 2.2a.7.7 0 00-.99.99L5.82 8.3 4.21 9.91a.7.7 0 00.99.99l2.1-2.1a.7.7 0 000-.99L5.2 5.7zm3.6 4.1h2.4a.7.7 0 000-1.4H8.8a.7.7 0 000 1.4z" />
                </svg>
                Open terminal
              </Button>
            )}
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  const closeLabel = terminalOnly ? "Back to chat" : "Close";

  const terminalPanel = (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-2 py-1.5 border-b border-border bg-sidebar flex items-center gap-2">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {quickTerminalTabs.map((tab) => (
              <div
                key={tab.id}
                className={`group inline-flex items-center gap-1.5 rounded-md border pl-0.5 pr-1 py-0.5 ${
                  activeQuickTerminalTabId === tab.id
                    ? "bg-card border-border"
                    : "bg-transparent border-transparent"
                }`}
              >
                <Button
                  type="button"
                  onClick={() => setActiveQuickTerminalTabId(tab.id)}
                  variant="ghost"
                  size="xs"
                  className={`px-1.5 py-1 text-xs font-medium ${
                    activeQuickTerminalTabId === tab.id
                      ? "text-foreground hover:bg-transparent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {tab.label}
                </Button>
                <Button
                  type="button"
                  aria-label={`Close ${tab.label} terminal tab`}
                  onClick={() => closeQuickTerminalTab(tab.id)}
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 rounded-sm p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {cwd && (
            <Button
              type="button"
              onClick={() => defaultNewTerminalOpts && openQuickTerminal(defaultNewTerminalOpts)}
              variant="ghost"
              size="xs"
              className="text-xs text-muted-foreground hover:text-foreground"
              title={sdkSession?.containerId ? "Open terminal in session container" : "Open terminal on host machine"}
            >
              + Terminal
            </Button>
          )}
          <Button
            type="button"
            onClick={closeDock}
            variant="ghost"
            size="xs"
            className="ml-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {closeLabel}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0" style={{ background: "var(--terminal-bg)" }}>
        {quickTerminalTabs.map((tab) => (
          <div key={tab.id} className={activeQuickTerminalTabId === tab.id ? "h-full" : "hidden"}>
            <TerminalView
              cwd={tab.cwd}
              containerId={tab.containerId}
              title={tab.containerId ? `docker:${tab.cwd}` : tab.cwd}
              embedded
              visible={activeQuickTerminalTabId === tab.id}
              hideHeader
            />
          </div>
        ))}
      </div>
    </div>
  );

  const contentArea = terminalOnly ? null : (
    <div className={suppressPanel ? "h-full min-h-0" : layout.contentWrapClass}>{children}</div>
  );

  const terminalAreaClass = terminalOnly
    ? "h-full min-h-0 bg-card"
    : suppressPanel
      ? "absolute inset-0 opacity-0 pointer-events-none"
      : `min-h-0 shrink-0 bg-card ${layout.terminalWrapClass}`;

  if (terminalOnly) {
    return (
      <div className="h-full min-h-0 bg-card pb-28 md:pb-0">
        {terminalPanel}
      </div>
    );
  }

  return (
    <div className={`h-full min-h-0 ${suppressPanel ? "relative" : `flex ${layout.shellClass}`}`}>
      {contentArea}
      <div className={terminalAreaClass} aria-hidden={suppressPanel ? "true" : undefined}>
        {terminalPanel}
      </div>
    </div>
  );
}
