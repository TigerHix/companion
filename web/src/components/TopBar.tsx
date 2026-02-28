import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { PanelLeft, PanelRight, Sun, Moon } from "lucide-react";
import { useStore } from "../store.js";
import { parseHash } from "../utils/routing.js";
import { AiValidationToggle } from "./AiValidationToggle.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type WorkspaceTab = "chat" | "diff" | "terminal" | "processes" | "editor";

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
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const markChatTabReentry = useStore((s) => s.markChatTabReentry);
  const quickTerminalOpen = useStore((s) => s.quickTerminalOpen);
  const quickTerminalTabs = useStore((s) => s.quickTerminalTabs);
  const openQuickTerminal = useStore((s) => s.openQuickTerminal);
  const resetQuickTerminal = useStore((s) => s.resetQuickTerminal);
  const changedFilesCount = useStore((s) =>
    currentSessionId ? (s.gitChangedFilesCount.get(currentSessionId) ?? 0) : 0
  );

  const runningProcessCount = useStore((s) => {
    if (!currentSessionId) return 0;
    const processes = s.sessionProcesses.get(currentSessionId);
    if (!processes) return 0;
    return processes.filter((p) => p.status === "running").length;
  });

  const cwd = useStore((s) => {
    if (!currentSessionId) return null;
    return (
      s.sessions.get(currentSessionId)?.cwd ||
      s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.cwd ||
      null
    );
  });
  const sdkSession = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId) || null;
  });
  const bridgeSession = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sessions.get(currentSessionId) || null;
  });
  const defaultTerminalOpts = useMemo(() => {
    if (sdkSession?.containerId) {
      return { target: "docker" as const, cwd: "/workspace", containerId: sdkSession.containerId };
    }
    return { target: "host" as const, cwd: cwd || "" };
  }, [cwd, sdkSession?.containerId]);
  const terminalButtonTitle = !cwd
    ? "Terminal unavailable while session is reconnecting"
    : sdkSession?.containerId || bridgeSession?.is_containerized
      ? "Open terminal in session container (Ctrl/Cmd+J)"
      : "Quick terminal (Ctrl/Cmd+J)";
  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const sessionName = currentSessionId
    ? (sessionNames?.get(currentSessionId) ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showWorkspaceControls = !!(currentSessionId && isSessionView);
  const showContextToggle = route.page === "session" && !!currentSessionId;
  const workspaceTabs: WorkspaceTab[] = ["chat", "diff", "terminal", "processes", "editor"];

  const activateWorkspaceTab = (tab: WorkspaceTab) => {
    if (tab === "terminal") {
      if (!cwd) return;
      if (!quickTerminalOpen || quickTerminalTabs.length === 0) {
        openQuickTerminal({ ...defaultTerminalOpts, reuseIfExists: true });
      }
      setActiveTab("terminal");
      return;
    }

    if (tab === "editor") {
      if (!cwd) return;
      setActiveTab("editor");
      return;
    }

    if (tab === "chat" && activeTab !== "chat" && currentSessionId) {
      markChatTabReentry(currentSessionId);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!currentSessionId) {
      resetQuickTerminal();
    }
  }, [currentSessionId, resetQuickTerminal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "j") return;
      if (!showWorkspaceControls) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      const currentIndex = Math.max(0, workspaceTabs.indexOf(activeTab as WorkspaceTab));
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + workspaceTabs.length) % workspaceTabs.length;
      activateWorkspaceTab(workspaceTabs[nextIndex]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showWorkspaceControls, workspaceTabs, activeTab, cwd, quickTerminalOpen, quickTerminalTabs.length, openQuickTerminal, defaultTerminalOpts, setActiveTab, markChatTabReentry, currentSessionId]);

  return (
    <header className="relative shrink-0 h-11 px-4 bg-background">
      <div className="h-full flex items-center gap-1 min-w-0">
        <Button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          variant="ghost"
          size="icon-sm"
          className={`shrink-0 ${
            sidebarOpen
              ? "text-primary bg-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-[15px] h-[15px]" />
        </Button>

        {showWorkspaceControls && (
          <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                type="button"
                onClick={() => activateWorkspaceTab("chat")}
                variant="ghost"
                size="sm"
                className={`h-full rounded-none px-3 text-[12px] font-medium border-b-[1.5px] shrink-0 ${
                  activeTab === "chat"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                title={sessionName || "Session"}
                aria-label="Session tab"
              >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    !isConnected
                      ? "bg-muted-foreground opacity-45"
                      : status === "running"
                        ? "bg-primary"
                        : status === "compacting"
                          ? "bg-warning"
                      : "bg-success"
                  }`} />
                  Session
              </Button>
              <Button
                type="button"
                onClick={() => activateWorkspaceTab("diff")}
                variant="ghost"
                size="sm"
                className={`h-full rounded-none px-3 text-[12px] font-medium border-b-[1.5px] shrink-0 ${
                  activeTab === "diff"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                aria-label="Diffs tab"
              >
                Diffs
                {changedFilesCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="status-chip status-chip-warning min-w-[15px] px-1 text-[9px] font-semibold leading-none"
                  >
                    {changedFilesCount}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => activateWorkspaceTab("terminal")}
                disabled={!cwd}
                variant="ghost"
                size="sm"
                className={`h-full rounded-none px-3 text-[12px] font-medium border-b-[1.5px] shrink-0 ${
                  !cwd
                    ? "text-muted-foreground/50 border-transparent"
                    : activeTab === "terminal"
                      ? "text-foreground border-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                title={terminalButtonTitle}
                aria-label="Shell tab"
              >
                Shell
              </Button>
              <Button
                type="button"
                onClick={() => activateWorkspaceTab("processes")}
                variant="ghost"
                size="sm"
                className={`h-full rounded-none px-3 text-[12px] font-medium border-b-[1.5px] shrink-0 ${
                  activeTab === "processes"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                aria-label="Processes tab"
              >
                Processes
                {runningProcessCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="status-chip status-chip-primary min-w-[15px] px-1 text-[9px] font-semibold leading-none"
                  >
                    {runningProcessCount}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => activateWorkspaceTab("editor")}
                disabled={!cwd}
                variant="ghost"
                size="sm"
                className={`h-full rounded-none px-3 text-[12px] font-medium border-b-[1.5px] shrink-0 ${
                  !cwd
                    ? "text-muted-foreground/50 border-transparent"
                    : activeTab === "editor"
                      ? "text-foreground border-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                title={!cwd ? "Editor unavailable while session is reconnecting" : "Editor"}
                aria-label="Editor tab"
              >
                Editor
              </Button>
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          {showWorkspaceControls && currentSessionId && (
            <AiValidationToggle sessionId={currentSessionId} />
          )}
          <ThemeToggle />
          {showContextToggle && (
            <Button
              type="button"
              onClick={() => setTaskPanelOpen(!taskPanelOpen)}
              variant="ghost"
              size="icon-sm"
              className={`${
                taskPanelOpen
                  ? "text-primary bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              title="Toggle context panel"
              aria-label="Toggle context panel"
            >
              <PanelRight className="w-[15px] h-[15px]" />
            </Button>
          )}
        </div>
      </div>

    </header>
  );
}

function ThemeToggle() {
  const darkMode = useStore((s) => s.darkMode);
  const toggle = useCallback(() => useStore.getState().toggleDarkMode(), []);

  return (
    <Button
      type="button"
      onClick={toggle}
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground hover:bg-accent"
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <Sun className="w-[15px] h-[15px]" />
      ) : (
        <Moon className="w-[15px] h-[15px]" />
      )}
    </Button>
  );
}
