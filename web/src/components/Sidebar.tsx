import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, ChevronRight, AlertTriangle, Trash2, Folder, Clock, Archive as ArchiveIcon, MoreVertical } from "lucide-react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, connectAllSessions, disconnectSession } from "../ws.js";
import { navigateToSession, navigateHome } from "../utils/routing.js";
import { Button } from "@/components/ui/button";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuAction,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { BackendBadge } from "@/components/ui/backend-badge";
import { groupSessionsByProject, type SessionItem as SessionItemType } from "../utils/project-grouping.js";

// ─── Status derivation ──────────────────────────────────────────────────────

type DerivedStatus = "awaiting" | "running" | "idle" | "exited";

function deriveStatus(s: SessionItemType): DerivedStatus {
  if (s.permCount > 0) return "awaiting";
  if ((s.status === "running" || s.status === "compacting") && s.isConnected) return "running";
  if (s.isConnected) return "idle";
  return "exited";
}

function StatusDot({ status }: { status: DerivedStatus }) {
  switch (status) {
    case "running":
      return (
        <span className="relative shrink-0 w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-success animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-success block" />
        </span>
      );
    case "awaiting":
      return (
        <span className="relative shrink-0 w-2 h-2">
          <span className="w-2 h-2 rounded-full bg-warning block animate-[ring-pulse_1.5s_ease-out_infinite]" />
        </span>
      );
    case "idle":
      return <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />;
    case "exited":
      return <span className="w-2 h-2 rounded-full border border-muted-foreground/25 shrink-0" />;
  }
}

// ─── Session sub-item (used inside project groups and standalone sections) ───

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
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLDivElement>(null);

  const derivedStatus = archived ? ("exited" as DerivedStatus) : deriveStatus(s);
  const cwdTail = s.cwd || "";

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const handleMenuAction = useCallback((action: () => void) => {
    setMenuOpen(false);
    action();
  }, []);

  if (isEditing) {
    return (
      <SidebarMenuSubItem>
        <div className="w-full flex items-center gap-1.5 py-2 pl-1 pr-12 min-h-[44px] rounded-lg">
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
            className="text-sm font-medium flex-1 min-w-0 text-foreground bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem className="relative group">
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        onDoubleClick={(e) => {
          e.preventDefault();
          onStartRename(s.id, label);
        }}
        className={`w-full min-h-[44px] h-auto flex items-center gap-1.5 rounded-lg py-2 pl-1 pr-12 transition-colors duration-100 text-left ${
          isActive ? "bg-accent" : "hover:bg-sidebar-accent"
        }`}
      >
        <StatusDot status={derivedStatus} />
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium truncate text-foreground leading-snug block ${
              isRecentlyRenamed ? "animate-name-appear" : ""
            }`}
            onAnimationEnd={() => onClearRecentlyRenamed(s.id)}
          >
            {label}
          </span>
          {cwdTail && (
            <span className="text-[10px] text-muted-foreground truncate block leading-tight">
              {cwdTail}
            </span>
          )}
        </div>

        <span className="flex items-center gap-1 shrink-0">
          <BackendBadge backend={s.backendType} compact />
          {s.isContainerized && (
            <Badge
              variant="secondary"
              className="h-auto rounded-md px-1 py-0.5"
              title="Docker"
            >
              <img src="/logo-docker.svg" alt="Docker logo" className="w-3 h-3" />
            </Badge>
          )}
          {s.cronJobId && (
            <Badge
              variant="secondary"
              className="status-chip status-chip-primary h-auto rounded-md px-1 py-0.5"
              title="Scheduled"
            >
              <Clock className="w-2.5 h-2.5 text-primary" />
            </Badge>
          )}
        </span>
      </button>

      {/* Archive button — hover reveal (desktop), always visible (mobile) */}
      {!archived && !menuOpen && (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive(e, s.id);
          }}
          variant="ghost"
          size="icon-xs"
          className="absolute right-7 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto text-muted-foreground hover:text-foreground transition-all"
          title="Archive"
          aria-label="Archive session"
        >
          <ArchiveIcon className="w-3 h-3" />
        </Button>
      )}

      {/* Three-dot menu button */}
      <div ref={menuBtnRef}>
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto text-muted-foreground hover:text-foreground transition-all"
          title="Session actions"
          aria-label="Session actions"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-36 py-1 bg-card border border-border rounded-lg shadow-lg z-10 animate-[menu-appear_150ms_ease-out]"
        >
          {!archived && (
            <Button
              type="button"
              onClick={() => handleMenuAction(() => onStartRename(s.id, label))}
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-none px-3 py-1.5 text-xs text-foreground"
            >
              Rename
            </Button>
          )}
          {archived ? (
            <>
              <Button
                type="button"
                onClick={(e) => handleMenuAction(() => onUnarchive(e, s.id))}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-none px-3 py-1.5 text-xs text-foreground"
              >
                Restore
              </Button>
              <Button
                type="button"
                onClick={(e) => handleMenuAction(() => onDelete(e, s.id))}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-none px-3 py-1.5 text-xs text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={(e) => handleMenuAction(() => onArchive(e, s.id))}
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-none px-3 py-1.5 text-xs text-foreground"
            >
              Archive
            </Button>
          )}
        </div>
      )}
    </SidebarMenuSubItem>
  );
}

// ─── Main Sidebar component ─────────────────────────────────────────────────

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
      {/* Header — logo + new session button (sidebar-04 SidebarHeader pattern) */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <img src={logoSrc} alt="" className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold text-sm tracking-tight">Moku</span>
              </div>
            </SidebarMenuButton>
            <SidebarMenuAction
              onClick={handleNewSession}
              title="New Session"
              aria-label="New Session"
              className="text-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

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
                <Button
                  onClick={cancelArchive}
                  variant="secondary"
                  size="xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmArchive}
                  variant="destructive"
                  size="xs"
                >
                  Archive
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session list — sidebar-04 pattern: SidebarContent > SidebarGroup > SidebarMenu */}
      <SidebarContent>
        {activeSessions.length === 0 && cronSessions.length === 0 && archivedSessions.length === 0 ? (
          <SidebarGroup>
            <p className="px-3 py-8 text-xs text-muted-foreground text-center leading-relaxed">
              No sessions yet.
            </p>
          </SidebarGroup>
        ) : (
          <>
            {/* Active sessions — grouped by project (sidebar-04 nav group pattern) */}
            <SidebarGroup>
              <SidebarMenu className="gap-2">
                {projectGroups.map((group) => (
                  <SidebarMenuItem key={group.key}>
                    <SidebarMenuButton
                      onClick={() => toggleProjectCollapse(group.key)}
                      className="font-semibold text-xs text-foreground/80 gap-1.5"
                    >
                      <ChevronRight
                        className={`w-2.5 h-2.5 text-muted-foreground transition-transform ${collapsedProjects.has(group.key) ? "" : "rotate-90"}`}
                      />
                      <Folder className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <span className="truncate">{group.label}</span>
                      {/* Status dots */}
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        {group.runningCount > 0 && (
                          <span className="w-1 h-1 rounded-full bg-success" title={`${group.runningCount} running`} />
                        )}
                        {group.permCount > 0 && (
                          <span className="w-1 h-1 rounded-full bg-warning" title={`${group.permCount} waiting`} />
                        )}
                      </span>
                      {/* Count badge */}
                      <span className="text-[10px] bg-accent rounded-full px-1.5 py-0.5 text-muted-foreground shrink-0">
                        {group.sessions.length}
                      </span>
                    </SidebarMenuButton>

                    {/* Collapsed preview */}
                    {collapsedProjects.has(group.key) && (
                      <div className="text-[10px] text-muted-foreground/70 truncate pl-7 pb-1">
                        {group.sessions
                          .slice(0, 2)
                          .map((s) => sessionNames.get(s.id) || s.model || s.id.slice(0, 8))
                          .join(", ") + (group.sessions.length > 2 ? ", ..." : "")}
                      </div>
                    )}

                    {/* Session sub-items (sidebar-04 sub-menu pattern) */}
                    {!collapsedProjects.has(group.key) && (
                      <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
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
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            {/* Cron (Scheduled Runs) section */}
            {cronSessions.length > 0 && (
              <SidebarGroup>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setShowCronSessions(!showCronSessions)}
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${showCronSessions ? "rotate-90" : ""}`} />
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                        <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L9 7.586V5z" />
                      </svg>
                      Scheduled Runs ({cronSessions.length})
                    </SidebarMenuButton>
                    {showCronSessions && (
                      <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
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
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            )}

            {/* Agent Runs section */}
            {agentSessions.length > 0 && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setShowAgentSessions(!showAgentSessions)}
                        className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${showAgentSessions ? "rotate-90" : ""}`} />
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                          <path d="M8 1.5a2.5 2.5 0 00-2.5 2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S9.38 1.5 8 1.5zM4 8a4 4 0 00-4 4v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V12a4 4 0 00-4-4H4z" />
                        </svg>
                        Agent Runs ({agentSessions.length})
                      </SidebarMenuButton>
                      {showAgentSessions && (
                        <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
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
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}

            {/* Archived section */}
            {archivedSessions.length > 0 && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <div className="flex items-center">
                        <SidebarMenuButton
                          onClick={() => setShowArchived(!showArchived)}
                          className="flex-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                          Archived ({archivedSessions.length})
                        </SidebarMenuButton>
                        {showArchived && archivedSessions.length > 1 && (
                          <Button
                            onClick={handleDeleteAllArchived}
                            variant="ghost"
                            size="xs"
                            className="mr-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete all archived sessions"
                          >
                            Delete all
                          </Button>
                        )}
                      </div>
                      {showArchived && (
                        <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
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
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}
          </>
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
