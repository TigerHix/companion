/**
 * Navbar — nemu-inspired glassmorphic navigation dock.
 *
 * Desktop: Narrow vertical dock between sidebar and main content area.
 * Mobile: Fixed bottom tab bar with icons + labels.
 *
 * Nav items: Chat, Terminal, Files/Editor, Diff (conditional), Settings.
 *
 * Dimensions match nemu 1:1:
 * - Desktop dock: size-11 (44px) buttons, p-2, gap-1, rounded-2xl, icons size-5
 * - Mobile bar: rounded-[22px], px-3 py-2, gap-2, icons size-6, labels text-[10px] tracking-wide
 * - Mobile safe area: pb-[max(env(safe-area-inset-bottom),12px)]
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MessageSquare, FileCode, GitCompareArrows, Settings } from "lucide-react";
import { useStore } from "../store.js";
import { parseHash } from "../utils/routing.js";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type NavId = "chat" | "terminal" | "editor" | "diff" | "settings";

interface NavItemDef {
  id: NavId;
  label: string;
  /** When true, only show if changedFilesCount > 0 */
  conditionalOnDiff?: boolean;
  /** When true, disabled if no cwd available */
  requiresCwd?: boolean;
  /** When true, disabled if no session is selected */
  requiresSession?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "chat", label: "Chat" },
  { id: "terminal", label: "Terminal" },
  { id: "editor", label: "Files", requiresCwd: true, requiresSession: true },
  { id: "diff", label: "Diff", conditionalOnDiff: true, requiresSession: true },
];

const SETTINGS_ITEM: NavItemDef = { id: "settings", label: "Settings" };

function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
  );
}

/** Terminal icon SVG */
function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1.5l3 2.5-3 2.5V4.5zM8.5 10h3v1h-3v-1z" />
    </svg>
  );
}

/** Settings gear icon SVG */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} fillRule="evenodd" clipRule="evenodd">
      <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.35-.8-2.92.77-2.12 2.12.54.9.07 2.04-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.39.95 2.29-.8 1.35.77 2.92 2.12 2.12.9-.54 2.04-.07 2.29.95.38 1.56 2.6 1.56 2.98 0 .25-1.02 1.39-1.49 2.29-.95 1.35.8 2.92-.77 2.12-2.12-.54-.9-.07-2.04.95-2.29 1.56-.38 1.56-2.6 0-2.98-1.02-.25-1.49-1.39-.95-2.29.8-1.35-.77-2.92-2.12-2.12-.9.54-2.04.07-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}

function NavIcon({ id, className }: { id: NavId; className?: string }) {
  switch (id) {
    case "chat":
      return <MessageSquare className={className} />;
    case "terminal":
      return <TerminalIcon className={className} />;
    case "editor":
      return <FileCode className={className} />;
    case "diff":
      return <GitCompareArrows className={className} />;
    case "settings":
      return <Settings className={className} />;
  }
}

export function Navbar() {
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const isSessionView = route.page === "session" || route.page === "home";

  const currentSessionId = useStore((s) => s.currentSessionId);
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

  // Reset quick terminal when session changes
  useEffect(() => {
    if (!currentSessionId) {
      resetQuickTerminal();
    }
  }, [currentSessionId, resetQuickTerminal]);

  // Determine which nav item is active
  const getActiveId = (): NavId | null => {
    if (route.page === "settings") return "settings";
    if (route.page === "terminal") return "terminal";
    if (isSessionView && currentSessionId) {
      if (activeTab === "chat" || activeTab === "processes") return "chat";
      if (activeTab === "diff") return "diff";
      if (activeTab === "terminal") return "terminal";
      if (activeTab === "editor") return "editor";
    }
    if (route.page === "home") return "chat";
    return null;
  };
  const activeId = getActiveId();

  // Build visible nav items (filter out conditional Diff when no changes)
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.conditionalOnDiff && changedFilesCount === 0) return false;
    return true;
  });

  const activateItem = (id: NavId) => {
    if (id === "settings") {
      window.location.hash = "#/settings";
      return;
    }

    if (id === "terminal") {
      if (!currentSessionId || !isSessionView) {
        // No session — go to standalone terminal page
        window.location.hash = "#/terminal";
        return;
      }
      if (!cwd) return;
      if (!quickTerminalOpen || quickTerminalTabs.length === 0) {
        openQuickTerminal({ ...defaultTerminalOpts, reuseIfExists: true });
      }
      setActiveTab("terminal");
      return;
    }

    if (id === "editor") {
      if (!cwd || !currentSessionId) return;
      setActiveTab("editor");
      return;
    }

    if (id === "diff") {
      if (!currentSessionId) return;
      setActiveTab("diff");
      return;
    }

    // Chat
    if (!currentSessionId || !isSessionView) {
      window.location.hash = "#/home";
      return;
    }
    if (activeTab !== "chat" && currentSessionId) {
      markChatTabReentry(currentSessionId);
    }
    setActiveTab("chat");
  };

  const isDisabled = (item: NavItemDef): boolean => {
    if (item.requiresCwd && !cwd) return true;
    if (item.requiresSession && !currentSessionId) return true;
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

      // Only cycle session-level tabs when in session view
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
    <>
      {/* Desktop dock — matches nemu: p-2, gap-1, size-11 buttons, rounded-2xl */}
      <nav
        className="hidden md:flex flex-col items-center shrink-0 p-2 gap-1 navbar-dock z-10"
        aria-label="Main navigation"
      >
        {/* Session-level nav items */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {visibleItems.map((item) => {
            const isActive = activeId === item.id;
            const disabled = isDisabled(item);
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => !disabled && activateItem(item.id)}
                      disabled={disabled}
                      className={`relative flex items-center justify-center size-11 rounded-xl transition-all duration-200 ${
                        disabled
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : isActive
                            ? "text-primary bg-primary/15"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-95"
                      }`}
                      aria-label={item.label}
                      data-testid={`nav-${item.id}`}
                    />
                  }
                >
                  {/* Active left accent bar — matches nemu: -left-1 h-5 w-1 */}
                  {isActive && (
                    <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary" />
                  )}
                  <NavIcon id={item.id} className={`size-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                  {/* Diff badge */}
                  {item.id === "diff" && changedFilesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[8px] font-bold leading-none px-0.5">
                      {changedFilesCount}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Separator + Settings at bottom */}
        <div className="flex flex-col items-center gap-1">
          <div className="mx-2 mb-1 h-px bg-border/50" />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => activateItem("settings")}
                  className={`relative flex items-center justify-center size-11 rounded-xl transition-all duration-200 ${
                    activeId === "settings"
                      ? "text-primary bg-primary/15"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-95"
                  }`}
                  aria-label="Settings"
                  data-testid="nav-settings"
                />
              }
            >
              {activeId === "settings" && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary" />
              )}
              <SettingsIcon className={`size-5 transition-transform duration-200 ${activeId === "settings" ? "scale-110" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* Mobile bottom tab bar — matches nemu: rounded-[22px], px-3 py-2, size-6 icons, text-[10px] tracking-wide */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mobile-tab-bar flex items-center gap-2 px-3 py-2 rounded-[22px]">
          {visibleItems.map((item) => {
            const isActive = activeId === item.id;
            const disabled = isDisabled(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !disabled && activateItem(item.id)}
                disabled={disabled}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-5 py-2 rounded-2xl transition-all duration-200 ${
                  disabled
                    ? "text-muted-foreground/40"
                    : isActive
                      ? "text-primary bg-primary/15"
                      : "text-muted-foreground active:scale-95"
                }`}
                aria-label={item.label}
                data-testid={`nav-mobile-${item.id}`}
              >
                <span className="relative">
                  <NavIcon id={item.id} className={`size-6 transition-transform duration-200 ${isActive ? "scale-105" : ""}`} />
                  {item.id === "diff" && changedFilesCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[8px] font-bold leading-none px-0.5">
                      {changedFilesCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* Settings in mobile bar */}
          <button
            type="button"
            onClick={() => activateItem("settings")}
            className={`flex flex-col items-center justify-center gap-0.5 px-5 py-2 rounded-2xl transition-all duration-200 ${
              activeId === "settings"
                ? "text-primary bg-primary/15"
                : "text-muted-foreground active:scale-95"
            }`}
            aria-label="Settings"
            data-testid="nav-mobile-settings"
          >
            <SettingsIcon className={`size-6 transition-transform duration-200 ${activeId === "settings" ? "scale-105" : ""}`} />
            <span className={`text-[10px] leading-none tracking-wide ${activeId === "settings" ? "font-semibold" : "font-medium"}`}>
              Settings
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
