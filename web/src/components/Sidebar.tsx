import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, X, ChevronRight, AlertTriangle, Trash2 } from "lucide-react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, connectAllSessions, disconnectSession } from "../ws.js";
import { navigateToSession, navigateHome, parseHash } from "../utils/routing.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectGroup } from "./ProjectGroup.js";
import { SessionItem } from "./SessionItem.js";
import { groupSessionsByProject, type SessionItem as SessionItemType } from "../utils/project-grouping.js";

interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  hash: string;
  viewBox: string;
  iconPath: string;
  activePages?: string[];
  fillRule?: "evenodd";
  clipRule?: "evenodd";
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "prompts",
    label: "Prompts",
    shortLabel: "Prompts",
    hash: "#/prompts",
    viewBox: "0 0 16 16",
    iconPath: "M3 2.5A1.5 1.5 0 014.5 1h5.879c.398 0 .779.158 1.06.44l1.621 1.62c.281.282.44.663.44 1.061V13.5A1.5 1.5 0 0112 15H4.5A1.5 1.5 0 013 13.5v-11zM4.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H12a.5.5 0 00.5-.5V4.121a.5.5 0 00-.146-.353l-1.621-1.621A.5.5 0 0010.379 2H4.5zm1.25 4.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5H6.5a.75.75 0 01-.75-.75z",
  },
  {
    id: "terminal",
    label: "Terminal",
    shortLabel: "Terminal",
    hash: "#/terminal",
    viewBox: "0 0 16 16",
    iconPath: "M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1.5l3 2.5-3 2.5V4.5zM8.5 10h3v1h-3v-1z",
  },
  {
    id: "environments",
    label: "Environments",
    shortLabel: "Envs",
    hash: "#/environments",
    viewBox: "0 0 16 16",
    iconPath: "M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z",
  },
  {
    id: "agents",
    label: "Agents",
    shortLabel: "Agents",
    hash: "#/agents",
    viewBox: "0 0 16 16",
    iconPath: "M8 1.5a2.5 2.5 0 00-2.5 2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S9.38 1.5 8 1.5zM4 8a4 4 0 00-4 4v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V12a4 4 0 00-4-4H4z",
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "Settings",
    hash: "#/settings",
    viewBox: "0 0 20 20",
    iconPath: "M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.35-.8-2.92.77-2.12 2.12.54.9.07 2.04-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.39.95 2.29-.8 1.35.77 2.92 2.12 2.12.9-.54 2.04-.07 2.29.95.38 1.56 2.6 1.56 2.98 0 .25-1.02 1.39-1.49 2.29-.95 1.35.8 2.92-.77 2.12-2.12-.54-.9-.07-2.04.95-2.29 1.56-.38 1.56-2.6 0-2.98-1.02-.25-1.49-1.39-.95-2.29.8-1.35-.77-2.92-2.12-2.12-.9.54-2.04.07-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z",
    fillRule: "evenodd",
    clipRule: "evenodd",
  },
];

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const editInputRef = useRef<HTMLInputElement>(null);
  const sessions = useStore((s) => s.sessions);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const removeSession = useStore((s) => s.removeSession);
  const sessionNames = useStore((s) => s.sessionNames);
  const recentlyRenamed = useStore((s) => s.recentlyRenamed);
  const clearRecentlyRenamed = useStore((s) => s.clearRecentlyRenamed);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const collapsedProjects = useStore((s) => s.collapsedProjects);
  const toggleProjectCollapse = useStore((s) => s.toggleProjectCollapse);
  const route = parseHash(hash);

  // Poll for SDK sessions on mount
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const list = await api.listSessions();
        if (active) {
          useStore.getState().setSdkSessions(list);
          // Connect all active sessions so we receive notifications for all of them
          connectAllSessions(list);
          // Hydrate session names from server (server is source of truth for auto-generated names)
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

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function handleSelectSession(sessionId: string) {
    useStore.getState().closeTerminal();
    // Navigate to session hash — App.tsx hash effect handles setCurrentSession + connectSession
    navigateToSession(sessionId);
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

  function handleNewSession() {
    useStore.getState().closeTerminal();
    navigateHome();
    useStore.getState().newSession();
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
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
    // Get fresh list of archived session IDs
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
    // Check if session uses a container — if so, ask for confirmation
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

  // Shared props for SessionItem / ProjectGroup
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
    <aside className="w-full md:w-[260px] h-full flex flex-col bg-sidebar">
      {/* Header */}
      <div className="p-3.5 pb-2">
        <div className="flex items-center gap-2.5">
          <img src={logoSrc} alt="" className="w-6 h-6" />
          <span className="text-[13px] font-semibold text-foreground tracking-tight">Moku</span>
          <Button
            onClick={handleNewSession}
            title="New Session"
            aria-label="New Session"
            size="icon-sm"
            className="ml-auto hidden md:inline-flex"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Button>
          {/* Close button — mobile only (sidebar is full-width on mobile, so no backdrop to tap) */}
          <Button
            onClick={() => useStore.getState().setSidebarOpen(false)}
            aria-label="Close sidebar"
            variant="ghost"
            size="icon-sm"
            className="ml-auto md:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Container archive confirmation */}
      {confirmArchiveId && (
        <div className="mx-2 mb-1 rounded-[10px] border border-warning/20 bg-warning/10 p-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-foreground leading-snug">
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2">
        {activeSessions.length === 0 && cronSessions.length === 0 && archivedSessions.length === 0 ? (
          <p className="px-3 py-8 text-xs text-muted-foreground text-center leading-relaxed">
            No sessions yet.
          </p>
        ) : (
          <>
            {projectGroups.map((group, i) => (
              <ProjectGroup
                key={group.key}
                group={group}
                isCollapsed={collapsedProjects.has(group.key)}
                onToggleCollapse={toggleProjectCollapse}
                currentSessionId={currentSessionId}
                sessionNames={sessionNames}
                pendingPermissions={pendingPermissions}
                recentlyRenamed={recentlyRenamed}
                isFirst={i === 0}
                {...sessionItemProps}
              />
            ))}

            {cronSessions.length > 0 && (
              <div className="mt-2 pt-2">
                <Button
                  onClick={() => setShowCronSessions(!showCronSessions)}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${showCronSessions ? "rotate-90" : ""}`} />
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                    <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L9 7.586V5z" />
                  </svg>
                  Scheduled Runs ({cronSessions.length})
                </Button>
                {showCronSessions && (
                  <div className="space-y-0.5 mt-1">
                    {cronSessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isActive={currentSessionId === s.id}
                        sessionName={sessionNames.get(s.id)}
                        permCount={pendingPermissions.get(s.id)?.size ?? 0}
                        isRecentlyRenamed={recentlyRenamed.has(s.id)}
                        {...sessionItemProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {agentSessions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <Button
                  onClick={() => setShowAgentSessions(!showAgentSessions)}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${showAgentSessions ? "rotate-90" : ""}`} />
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                    <path d="M8 1.5a2.5 2.5 0 00-2.5 2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S9.38 1.5 8 1.5zM4 8a4 4 0 00-4 4v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V12a4 4 0 00-4-4H4z" />
                  </svg>
                  Agent Runs ({agentSessions.length})
                </Button>
                {showAgentSessions && (
                  <div className="space-y-0.5 mt-1">
                    {agentSessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isActive={currentSessionId === s.id}
                        sessionName={sessionNames.get(s.id)}
                        permCount={pendingPermissions.get(s.id)?.size ?? 0}
                        isRecentlyRenamed={recentlyRenamed.has(s.id)}
                        {...sessionItemProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {archivedSessions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center">
                  <Button
                    onClick={() => setShowArchived(!showArchived)}
                    variant="ghost"
                    size="sm"
                    className="h-auto flex-1 justify-start px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                    Archived ({archivedSessions.length})
                  </Button>
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
                  <div className="space-y-0.5 mt-1">
                    {archivedSessions.map((s) => (
                      <SessionItem
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
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile FAB — New Session button in thumb zone */}
      <div className="md:hidden flex justify-end px-4 pb-2">
        <Button
          onClick={handleNewSession}
          title="New Session"
          aria-label="New Session"
          size="icon-lg"
          className="size-12 rounded-full shadow-lg"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </Button>
      </div>

      {/* Footer */}
      <div className="p-2 pb-safe bg-sidebar">
        <div className="grid grid-cols-3 gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.activePages
              ? item.activePages.some((p) => route.page === p)
              : route.page === item.id;
            return (
              <Button
                type="button"
                key={item.id}
                onClick={() => {
                  if (item.id !== "terminal") {
                    useStore.getState().closeTerminal();
                  }
                  window.location.hash = item.hash;
                  // Close sidebar on mobile so the navigated page is visible
                  if (window.innerWidth < 768) {
                    useStore.getState().setSidebarOpen(false);
                  }
                }}
                title={item.label}
                variant="ghost"
                className={`min-h-[44px] h-auto flex-col gap-0.5 px-1.5 py-2.5 ${
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <svg viewBox={item.viewBox} fill="currentColor" className="w-4 h-4">
                  <path d={item.iconPath} fillRule={item.fillRule} clipRule={item.clipRule} />
                </svg>
                <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Dialog
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
        <DialogContent showCloseButton={false} className="max-w-[280px] p-5">
          <div className="mb-3 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
          </div>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-[13px] font-semibold text-foreground">
              {confirmDeleteAll ? "Delete all archived?" : "Delete session?"}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {confirmDeleteAll
                ? `This will permanently delete ${archivedSessions.length} archived session${archivedSessions.length === 1 ? "" : "s"}. This cannot be undone.`
                : "This will permanently delete this session and its history. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-row gap-2.5 sm:flex-row">
            <Button
              onClick={confirmDeleteAll ? cancelDeleteAll : cancelDelete}
              variant="secondary"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
