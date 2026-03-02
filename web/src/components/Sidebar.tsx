import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from "react";
import { Plus, ChevronRight, AlertTriangle, Trash2, Clock, MoreVertical, Home, Bot, Box, Settings } from "lucide-react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, connectAllSessions, disconnectSession } from "../ws.js";
import { navigateToSession, navigateHome, parseHash } from "../utils/routing.js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { BackendIcon } from "@/components/ui/backend-badge";
import { groupSessionsByProject, type SessionItem as SessionItemType } from "../utils/project-grouping.js";

function useHash() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => window.location.hash,
  );
}

// ─── Status derivation ──────────────────────────────────────────────────────

type DerivedStatus = "awaiting" | "running" | "idle" | "exited";

function deriveStatus(s: SessionItemType): DerivedStatus {
  if (s.permCount > 0) return "awaiting";
  if ((s.status === "running" || s.status === "compacting") && s.isConnected) return "running";
  if (s.isConnected) return "idle";
  return "exited";
}

/** Small colored dot — only rendered for running/awaiting states */
function StatusDot({ status }: { status: DerivedStatus }) {
  if (status === "running") {
    return <span className="session-status-dot session-status-running" title="Running" />;
  }
  if (status === "awaiting") {
    return <span className="session-status-dot session-status-awaiting" title="Awaiting permission" />;
  }
  return null;
}

// ─── Session row — uses SidebarMenuButton, same structure as nav items ───────

interface SessionSubItemProps {
  session: SessionItemType;
  isActive: boolean;
  isArchived?: boolean;
  sessionName: string | undefined;
  permCount: number;
  isRecentlyRenamed: boolean;
  onSelect: (id: string) => void;
  onStartRename: (id: string, currentName: string) => void;
  onArchive: (e: React.MouseEvent, id: string) => void;
  onUnarchive: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onClearRecentlyRenamed: (id: string) => void;
  editingSessionId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

function SessionSubItem({
  session: s,
  isActive,
  isArchived: archived,
  sessionName,
  permCount,
  isRecentlyRenamed,
  onSelect,
  onStartRename,
  onArchive,
  onUnarchive,
  onDelete,
  onClearRecentlyRenamed,
  editingSessionId,
  editingName,
  setEditingName,
  onConfirmRename,
  onCancelRename,
  editInputRef,
}: SessionSubItemProps) {
  const shortId = s.id.slice(0, 8);
  const label = sessionName || s.model || shortId;
  const isEditing = editingSessionId === s.id;
  const [menuOpen, setMenuOpen] = useState(false);

  const derivedStatus = archived ? ("exited" as DerivedStatus) : deriveStatus(s);

  if (isEditing) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center px-2 py-1">
          <input
            ref={editInputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirmRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelRename();
              }
              e.stopPropagation();
            }}
            onBlur={onConfirmRename}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="input-moku text-sm flex-1 min-w-0 rounded-md px-2 py-1"
          />
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="group/row">
      <SidebarMenuButton
        onClick={() => onSelect(s.id)}
        onDoubleClick={(e: React.MouseEvent) => {
          e.preventDefault();
          onStartRename(s.id, label);
        }}
        isActive={isActive}
        className="gap-2 pr-7"
        data-status={derivedStatus}
      >
        <BackendIcon backend={s.backendType} className="size-4" />
        <span
          className={isRecentlyRenamed ? "animate-name-appear" : undefined}
          onAnimationEnd={() => onClearRecentlyRenamed(s.id)}
        >
          {label}
        </span>
        <StatusDot status={derivedStatus} />
      </SidebarMenuButton>

      {/* Context menu — per-row hover only */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className={`absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-opacity size-6 flex items-center justify-center rounded-md ${
            menuOpen ? "opacity-100" : "opacity-0 sm:group-hover/row:opacity-100"
          }`}
          title="Session actions"
          aria-label="Session actions"
        >
          <MoreVertical className="!size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-36 sidebar-ctx-menu">
          {!archived && (
            <DropdownMenuItem className="text-xs" onClick={() => onStartRename(s.id, label)}>
              Rename
            </DropdownMenuItem>
          )}
          {archived ? (
            <>
              <DropdownMenuItem className="text-xs" onClick={(e) => onUnarchive(e as React.MouseEvent, s.id)}>
                Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="text-xs" onClick={(e) => onDelete(e as React.MouseEvent, s.id)}>
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem className="text-xs" onClick={(e) => onArchive(e as React.MouseEvent, s.id)}>
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

// ─── Main Sidebar component ─────────────────────────────────────────────────

const APP_NAV_ITEMS = [
  { id: "home", label: "Home", hash: "", icon: Home },
  { id: "agents", label: "Agents", hash: "#/agents", icon: Bot },
  { id: "environments", label: "Environments", hash: "#/environments", icon: Box },
  { id: "settings", label: "Settings", hash: "#/settings", icon: Settings },
] as const;

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const sessions = useStore((s) => s.sessions);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const removeSession = useStore((s) => s.removeSession);
  const sessionNames = useStore((s) => s.sessionNames);
  const recentlyRenamed = useStore((s) => s.recentlyRenamed);
  const clearRecentlyRenamed = useStore((s) => s.clearRecentlyRenamed);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const collapsedProjects = useStore((s) => s.collapsedProjects);
  const toggleProjectCollapse = useStore((s) => s.toggleProjectCollapse);
  const { isMobile } = useSidebar();
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);

  // Poll for SDK sessions on mount
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const list = await api.listSessions();
        if (active) {
          useStore.getState().setSdkSessions(list);
          connectAllSessions(list);
          const store = useStore.getState();
          for (const s of list) {
            if (s.name && (!store.sessionNames.has(s.sessionId) || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(store.sessionNames.get(s.sessionId)!))) {
              const currentStoreName = store.sessionNames.get(s.sessionId);
              const hadRandomName = !!currentStoreName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(currentStoreName);
              if (currentStoreName !== s.name) {
                store.setSessionName(s.sessionId, s.name);
                if (hadRandomName) {
                  store.markRecentlyRenamed(s.sessionId);
                }
              }
            }
          }
        }
      } catch {
        // server not ready
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  function handleSelectSession(sessionId: string) {
    useStore.getState().closeTerminal();
    navigateToSession(sessionId);
  }

  function handleNewSession() {
    useStore.getState().closeTerminal();
    navigateHome();
    useStore.getState().newSession();
  }

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  function confirmRename() {
    if (editingSessionId && editingName.trim()) {
      useStore.getState().setSessionName(editingSessionId, editingName.trim());
      api.renameSession(editingSessionId, editingName.trim()).catch(() => {});
    }
    setEditingSessionId(null);
    setEditingName("");
  }

  function cancelRename() {
    setEditingSessionId(null);
    setEditingName("");
  }

  function handleStartRename(id: string, currentName: string) {
    setEditingSessionId(id);
    setEditingName(currentName);
  }

  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  }, []);

  const doDelete = useCallback(async (sessionId: string) => {
    try {
      disconnectSession(sessionId);
      await api.deleteSession(sessionId);
    } catch {
      // best-effort
    }
    if (useStore.getState().currentSessionId === sessionId) {
      navigateHome();
    }
    removeSession(sessionId);
  }, [removeSession]);

  const confirmDelete = useCallback(() => {
    if (confirmDeleteId) {
      doDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, doDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleDeleteAllArchived = useCallback(() => {
    setConfirmDeleteAll(true);
  }, []);

  const confirmDeleteAllArchived = useCallback(async () => {
    setConfirmDeleteAll(false);
    const store = useStore.getState();
    const allIds = new Set<string>();
    for (const id of store.sessions.keys()) allIds.add(id);
    for (const s of store.sdkSessions) allIds.add(s.sessionId);
    const archivedIds = Array.from(allIds).filter((id) => {
      const sdkInfo = store.sdkSessions.find((s) => s.sessionId === id);
      return sdkInfo?.archived ?? false;
    });
    for (const id of archivedIds) {
      await doDelete(id);
    }
  }, [doDelete]);

  const cancelDeleteAll = useCallback(() => {
    setConfirmDeleteAll(false);
  }, []);

  const handleArchiveSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const bridgeState = sessions.get(sessionId);
    const isContainerized = bridgeState?.is_containerized || !!sdkInfo?.containerId || false;
    if (isContainerized) {
      setConfirmArchiveId(sessionId);
      return;
    }
    doArchive(sessionId);
  }, [sdkSessions, sessions]);

  const doArchive = useCallback(async (sessionId: string, force?: boolean) => {
    try {
      disconnectSession(sessionId);
      await api.archiveSession(sessionId, force ? { force: true } : undefined);
    } catch {
      // best-effort
    }
    if (useStore.getState().currentSessionId === sessionId) {
      navigateHome();
      useStore.getState().newSession();
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  const confirmArchive = useCallback(() => {
    if (confirmArchiveId) {
      doArchive(confirmArchiveId, true);
      setConfirmArchiveId(null);
    }
  }, [confirmArchiveId, doArchive]);

  const cancelArchive = useCallback(() => {
    setConfirmArchiveId(null);
  }, []);

  const handleUnarchiveSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.unarchiveSession(sessionId);
    } catch {
      // best-effort
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  // Combine sessions from WsBridge state + SDK sessions list
  const allSessionIds = new Set<string>();
  for (const id of sessions.keys()) allSessionIds.add(id);
  for (const s of sdkSessions) allSessionIds.add(s.sessionId);

  const allSessionList: SessionItemType[] = Array.from(allSessionIds).map((id) => {
    const bridgeState = sessions.get(id);
    const sdkInfo = sdkSessions.find((s) => s.sessionId === id);
    return {
      id,
      model: bridgeState?.model || sdkInfo?.model || "",
      cwd: bridgeState?.cwd || sdkInfo?.cwd || "",
      gitBranch: bridgeState?.git_branch || sdkInfo?.gitBranch || "",
      isContainerized: bridgeState?.is_containerized || !!sdkInfo?.containerId || false,
      gitAhead: bridgeState?.git_ahead || sdkInfo?.gitAhead || 0,
      gitBehind: bridgeState?.git_behind || sdkInfo?.gitBehind || 0,
      linesAdded: bridgeState?.total_lines_added || sdkInfo?.totalLinesAdded || 0,
      linesRemoved: bridgeState?.total_lines_removed || sdkInfo?.totalLinesRemoved || 0,
      isConnected: cliConnected.get(id) ?? false,
      status: sessionStatus.get(id) ?? null,
      sdkState: sdkInfo?.state ?? null,
      createdAt: sdkInfo?.createdAt ?? 0,
      archived: sdkInfo?.archived ?? false,
      backendType: bridgeState?.backend_type || sdkInfo?.backendType || "claude",
      repoRoot: bridgeState?.repo_root || "",
      permCount: pendingPermissions.get(id)?.size ?? 0,
      cronJobId: bridgeState?.cronJobId || sdkInfo?.cronJobId,
      cronJobName: bridgeState?.cronJobName || sdkInfo?.cronJobName,
      agentId: bridgeState?.agentId || sdkInfo?.agentId,
      agentName: bridgeState?.agentName || sdkInfo?.agentName,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  const activeSessions = allSessionList.filter((s) => !s.archived && !s.cronJobId && !s.agentId);
  const cronSessions = allSessionList.filter((s) => !s.archived && !!s.cronJobId);
  const agentSessions = allSessionList.filter((s) => !s.archived && !!s.agentId);
  const archivedSessions = allSessionList.filter((s) => s.archived);
  const currentSession = currentSessionId ? allSessionList.find((s) => s.id === currentSessionId) : null;
  const logoSrc = currentSession?.backendType === "codex" ? "/logo-codex.svg" : "/logo.svg";
  const [showCronSessions, setShowCronSessions] = useState(true);
  const [showAgentSessions, setShowAgentSessions] = useState(true);

  // Group active sessions by project
  const projectGroups = useMemo(
    () => groupSessionsByProject(activeSessions),
    [activeSessions],
  );

  // Shared props for SessionSubItem
  const sessionItemProps = {
    onSelect: handleSelectSession,
    onStartRename: handleStartRename,
    onArchive: handleArchiveSession,
    onUnarchive: handleUnarchiveSession,
    onDelete: handleDeleteSession,
    onClearRecentlyRenamed: clearRecentlyRenamed,
    editingSessionId,
    editingName,
    setEditingName,
    onConfirmRename: confirmRename,
    onCancelRename: cancelRename,
    editInputRef,
  };

  return (
    <ShadcnSidebar variant="floating">
      {/* Header — logo + new session button */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
              <img src={logoSrc} alt="" className="size-6" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-foreground">Moku</span>
          </div>
          <LiquidGlassButton
            onClick={handleNewSession}
            title="New Session"
            aria-label="New Session"
            className="size-8"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </LiquidGlassButton>
        </div>
      </SidebarHeader>

      {/* App-level navigation */}
      <SidebarGroup className="px-2 pt-0 pb-1">
        <SidebarMenu>
          {APP_NAV_ITEMS.map((item) => {
            const isActive = item.id === "home"
              ? (route.page === "home" && !currentSessionId)
              : item.id === "agents"
                ? (route.page === "agents" || route.page === "agent-detail")
                : route.page === item.id;
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => {
                    if (item.id === "home") {
                      navigateHome();
                      useStore.getState().newSession();
                    } else {
                      window.location.hash = item.hash;
                    }
                    if (isMobile) setSidebarOpen(false);
                  }}
                  isActive={isActive}
                  data-testid={`sidebar-nav-${item.id}`}
                  className="gap-2"
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarSeparator />

      {/* Container archive confirmation */}
      {confirmArchiveId && (
        <div className="mx-2 mb-1 rounded-[10px] border border-warning/20 bg-warning/10 p-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">
                Archiving will <strong>remove the container</strong> and any uncommitted changes.
              </p>
              <div className="flex gap-2 mt-2">
                <Button onClick={cancelArchive} variant="secondary" size="xs">Cancel</Button>
                <Button onClick={confirmArchive} variant="destructive" size="xs">Archive</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session list */}
      <SidebarContent>
        {activeSessions.length === 0 && cronSessions.length === 0 && archivedSessions.length === 0 ? (
          <SidebarGroup>
            <div className="px-4 py-12 text-center">
              <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-muted/40 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground/50 leading-relaxed">
                No sessions yet.
              </p>
            </div>
          </SidebarGroup>
        ) : (
          <SidebarGroup className="px-2">
            <SidebarMenu>
              {/* Active sessions — grouped by project */}
              {projectGroups.map((group) => {
                const isCollapsed = collapsedProjects.has(group.key);
                return (
                  <SidebarMenuItem key={group.key}>
                    <SidebarMenuButton
                      onClick={() => toggleProjectCollapse(group.key)}
                      size="sm"
                      className="gap-1.5 text-muted-foreground/60 hover:text-foreground/80"
                    >
                      <ChevronRight
                        className={`!size-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                      />
                      <span>{group.label} ({group.sessions.length})</span>
                      {group.runningCount > 0 && (
                        <span className="session-status-dot session-status-running ml-auto" title={`${group.runningCount} running`} />
                      )}
                      {group.permCount > 0 && (
                        <span className="session-status-dot session-status-awaiting" title={`${group.permCount} waiting`} />
                      )}
                    </SidebarMenuButton>

                    {!isCollapsed && (
                      <SidebarMenu className="mt-0.5">
                        {group.sessions.map((s) => (
                          <SessionSubItem
                            key={s.id}
                            session={s}
                            isActive={currentSessionId === s.id}
                            sessionName={sessionNames.get(s.id)}
                            permCount={pendingPermissions.get(s.id)?.size ?? 0}
                            isRecentlyRenamed={recentlyRenamed.has(s.id)}
                            {...sessionItemProps}
                          />
                        ))}
                      </SidebarMenu>
                    )}
                  </SidebarMenuItem>
                );
              })}

              {/* Scheduled section */}
              {cronSessions.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowCronSessions(!showCronSessions)}
                    size="sm"
                    className="gap-1.5 text-muted-foreground/60 hover:text-foreground/80"
                  >
                    <ChevronRight
                      className={`!size-3 transition-transform duration-150 ${showCronSessions ? "rotate-90" : ""}`}
                    />
                    <Clock className="!size-3.5" />
                    <span>Scheduled ({cronSessions.length})</span>
                  </SidebarMenuButton>

                  {showCronSessions && (
                    <SidebarMenu className="mt-0.5">
                      {cronSessions.map((s) => (
                        <SessionSubItem
                          key={s.id}
                          session={s}
                          isActive={currentSessionId === s.id}
                          sessionName={sessionNames.get(s.id)}
                          permCount={pendingPermissions.get(s.id)?.size ?? 0}
                          isRecentlyRenamed={recentlyRenamed.has(s.id)}
                          {...sessionItemProps}
                        />
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              )}

              {/* Agent Runs section */}
              {agentSessions.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowAgentSessions(!showAgentSessions)}
                    size="sm"
                    className="gap-1.5 text-muted-foreground/60 hover:text-foreground/80"
                  >
                    <ChevronRight
                      className={`!size-3 transition-transform duration-150 ${showAgentSessions ? "rotate-90" : ""}`}
                    />
                    <Bot className="!size-3.5" />
                    <span>Agents ({agentSessions.length})</span>
                  </SidebarMenuButton>

                  {showAgentSessions && (
                    <SidebarMenu className="mt-0.5">
                      {agentSessions.map((s) => (
                        <SessionSubItem
                          key={s.id}
                          session={s}
                          isActive={currentSessionId === s.id}
                          sessionName={sessionNames.get(s.id)}
                          permCount={pendingPermissions.get(s.id)?.size ?? 0}
                          isRecentlyRenamed={recentlyRenamed.has(s.id)}
                          {...sessionItemProps}
                        />
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              )}

              {/* Archived section */}
              {archivedSessions.length > 0 && (
                <SidebarMenuItem className="group/archive">
                  <SidebarMenuButton
                    onClick={() => setShowArchived(!showArchived)}
                    size="sm"
                    className="gap-1.5 text-muted-foreground/60 hover:text-foreground/80"
                  >
                    <ChevronRight
                      className={`!size-3 transition-transform duration-150 ${showArchived ? "rotate-90" : ""}`}
                    />
                    <span>Archived ({archivedSessions.length})</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAllArchived();
                      }}
                      className="ml-auto opacity-0 group-hover/archive:opacity-100 transition-opacity text-muted-foreground/30 hover:text-destructive"
                      title="Delete all archived sessions"
                      aria-label="Delete all archived sessions"
                    >
                      <Trash2 className="!size-3" />
                    </button>
                  </SidebarMenuButton>

                  {showArchived && (
                    <SidebarMenu className="mt-0.5">
                      {archivedSessions.map((s) => (
                        <SessionSubItem
                          key={s.id}
                          session={s}
                          isActive={currentSessionId === s.id}
                          isArchived
                          sessionName={sessionNames.get(s.id)}
                          permCount={pendingPermissions.get(s.id)?.size ?? 0}
                          isRecentlyRenamed={recentlyRenamed.has(s.id)}
                          {...sessionItemProps}
                        />
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Delete confirmation modal */}
      <ResponsiveDialog
        open={!!(confirmDeleteId || confirmDeleteAll)}
        onOpenChange={(open) => {
          if (!open) {
            if (confirmDeleteAll) {
              cancelDeleteAll();
            } else {
              cancelDelete();
            }
          }
        }}
      >
        <ResponsiveDialogContent showCloseButton={false} className="sm:max-w-[320px]">
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
          </div>
          <ResponsiveDialogHeader className="items-center text-center">
            <ResponsiveDialogTitle>
              {confirmDeleteAll ? "Delete all archived?" : "Delete session?"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {confirmDeleteAll
                ? `This will permanently delete ${archivedSessions.length} archived session${archivedSessions.length === 1 ? "" : "s"}. This cannot be undone.`
                : "This will permanently delete this session and its history. This cannot be undone."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              onClick={confirmDeleteAll ? cancelDeleteAll : cancelDelete}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteAll ? confirmDeleteAllArchived : confirmDelete}
              variant="destructive"
              className="flex-1"
            >
              {confirmDeleteAll ? "Delete all" : "Delete"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </ShadcnSidebar>
  );
}
