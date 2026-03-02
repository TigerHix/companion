import { useEffect, useMemo, useSyncExternalStore } from "react";
import { PanelLeftIcon } from "lucide-react";
import { useStore } from "../store.js";
import { parseHash } from "../utils/routing.js";
import { InfoPopover } from "./InfoPopover.js";
import { useSidebar } from "@/components/ui/sidebar";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { cn } from "@/lib/utils";

type NavId = "chat" | "terminal" | "editor" | "diff";

interface NavItemDef {
  id: NavId;
  label: string;
  conditionalOnDiff?: boolean;
  requiresCwd?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "chat", label: "Chat" },
  { id: "terminal", label: "Terminal" },
  { id: "editor", label: "Files", requiresCwd: true },
  { id: "diff", label: "Diff", conditionalOnDiff: true },
];

function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
  );
}

export function TopBar() {
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const isSessionView = route.page === "session" || route.page === "home";
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sessionNames = useStore((s) => s.sessionNames);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const { toggleSidebar } = useSidebar();

  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const markChatTabReentry = useStore((s) => s.markChatTabReentry);

  const quickTerminalOpen = useStore((s) => s.quickTerminalOpen);
  const quickTerminalTabs = useStore((s) => s.quickTerminalTabs);
  const openQuickTerminal = useStore((s) => s.openQuickTerminal);
  const resetQuickTerminal = useStore((s) => s.resetQuickTerminal);

  const changedFilesCount = useStore((s) =>
    currentSessionId ? (s.gitChangedFilesCount.get(currentSessionId) ?? 0) : 0,
  );

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

  const defaultTerminalOpts = useMemo(() => {
    if (sdkSession?.containerId) {
      return { target: "docker" as const, cwd: "/workspace", containerId: sdkSession.containerId };
    }
    return { target: "host" as const, cwd: cwd || "" };
  }, [cwd, sdkSession?.containerId]);

  useEffect(() => {
    if (!currentSessionId) {
      resetQuickTerminal();
    }
  }, [currentSessionId, resetQuickTerminal]);

  const sessionName = currentSessionId
    ? (sessionNames?.get(currentSessionId) ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showSessionInfo = !!(currentSessionId && isSessionView);

  const getActiveId = (): NavId | null => {
    if (isSessionView && currentSessionId) {
      if (activeTab === "chat" || activeTab === "processes") return "chat";
      if (activeTab === "diff") return "diff";
      if (activeTab === "terminal") return "terminal";
      if (activeTab === "editor") return "editor";
    }
    return null;
  };
  const activeId = getActiveId();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.conditionalOnDiff && changedFilesCount === 0) return false;
    return true;
  });

  const activateItem = (id: NavId) => {
    if (!currentSessionId) return;

    if (id === "terminal") {
      if (!cwd) return;
      if (!quickTerminalOpen || quickTerminalTabs.length === 0) {
        openQuickTerminal({ ...defaultTerminalOpts, reuseIfExists: true });
      }
      setActiveTab("terminal");
      return;
    }

    if (id === "editor") {
      if (!cwd) return;
      setActiveTab("editor");
      return;
    }

    if (id === "diff") {
      setActiveTab("diff");
      return;
    }

    if (activeTab !== "chat" && currentSessionId) {
      markChatTabReentry(currentSessionId);
    }
    setActiveTab("chat");
  };

  const isDisabled = (item: NavItemDef): boolean => {
    if (item.requiresCwd && !cwd) return true;
    return false;
  };

  // Keyboard shortcut: Cmd/Ctrl+J cycles through visible tabs
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "j") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();

      if (!currentSessionId || !isSessionView) return;

      const cyclable = visibleItems.filter((item) => !isDisabled(item));
      if (cyclable.length === 0) return;

      const currentIndex = cyclable.findIndex((item) => item.id === activeId);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + cyclable.length) % cyclable.length;
      activateItem(cyclable[nextIndex].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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

      {/* Center: session tabs when active, session name when on non-session page */}
      {showSessionInfo ? (
        <nav
          className="flex-1 flex items-center justify-center gap-1 min-w-0"
          aria-label="Session navigation"
          data-testid="session-navbar"
        >
          {visibleItems.map((item) => {
            const isActive = activeId === item.id;
            const disabled = isDisabled(item);
            const label = item.id === "diff" && changedFilesCount > 0
              ? `${item.label} (${changedFilesCount})`
              : item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !disabled && activateItem(item.id)}
                disabled={disabled}
                className={cn(
                  "tab-liquid-glass",
                  isActive && "tab-liquid-glass-active",
                )}
                aria-label={item.label}
                data-testid={`nav-${item.id}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: Info popover */}
      <div className="flex items-center gap-0.5 shrink-0">
        {showSessionInfo && currentSessionId && (
          <InfoPopover sessionId={currentSessionId} />
        )}
      </div>
    </header>
  );
}
