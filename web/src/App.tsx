import { lazy, Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useStore } from "./store.js";
import { connectSession } from "./ws.js";
import { api } from "./api.js";
import { navigateToConnect, navigateToSession, parseHash } from "./utils/routing.js";
import { LoginPage } from "./components/LoginPage.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { TopBar } from "./components/TopBar.js";
import { HomePage } from "./components/HomePage.js";
import { DiffPanel } from "./components/DiffPanel.js";
import { SessionLaunchOverlay } from "./components/SessionLaunchOverlay.js";
import { SessionTerminalDock } from "./components/SessionTerminalDock.js";
import { SessionEditorPane } from "./components/SessionEditorPane.js";
import { MobileViewportBackdrop } from "./components/MobileViewportBackdrop.js";
import { SafariTintProbe } from "./components/SafariTintProbe.js";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
// Lazy-loaded route-level pages (not needed for initial render)
const Playground = lazy(() => import("./components/Playground.js").then((m) => ({ default: m.Playground })));
const SettingsPage = lazy(() => import("./components/SettingsPage.js").then((m) => ({ default: m.SettingsPage })));
const EnvManager = lazy(() => import("./components/EnvManager.js").then((m) => ({ default: m.EnvManager })));
const DockerBuilderPage = lazy(() => import("./components/DockerBuilderPage.js").then((m) => ({ default: m.DockerBuilderPage })));
const CronManager = lazy(() => import("./components/CronManager.js").then((m) => ({ default: m.CronManager })));
const AgentsPage = lazy(() => import("./components/AgentsPage.js").then((m) => ({ default: m.AgentsPage })));
const ProcessPanel = lazy(() => import("./components/ProcessPanel.js").then((m) => ({ default: m.ProcessPanel })));


function LazyFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  );
}

function useHash() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => window.location.hash,
  );
}

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const darkMode = useStore((s) => s.darkMode);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const homeResetKey = useStore((s) => s.homeResetKey);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const sessionCreating = useStore((s) => s.sessionCreating);
  const sessionCreatingBackend = useStore((s) => s.sessionCreatingBackend);
  const creationProgress = useStore((s) => s.creationProgress);
  const creationError = useStore((s) => s.creationError);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const isSettingsPage = route.page === "settings";
  const isConnectPage = route.page === "connect";
  const isEnvironmentsPage = route.page === "environments";
  const isDockerBuilderPage = route.page === "docker-builder";
  const isScheduledPage = route.page === "scheduled";
  const isAgentsPage = route.page === "agents" || route.page === "agent-detail";
  const isSessionWorkspace = route.page === "session" || route.page === "home";
  const selectedSessionId = route.page === "session" ? route.sessionId : null;
  const themeColor = darkMode ? "#1b1714" : "#f8f4ef";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.backgroundColor = themeColor;
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    document.body.style.backgroundColor = themeColor;

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", themeColor);
    });
  }, [darkMode, themeColor]);

  // Migrate legacy "files" tab to "editor"
  useEffect(() => {
    if ((activeTab as string) === "files") {
      setActiveTab("editor");
    }
  }, [activeTab, setActiveTab]);

  // Capture the remembered session during render so first-mount restoration can
  // redirect to the session route before we drop the ref.
  const restoredIdRef = useRef(useStore.getState().lastSessionId);

  // Sync hash → remembered-session state. On mount, restore the remembered
  // session into the URL first when loading the bare home route.
  useEffect(() => {
    if (!isAuthenticated) {
      if (route.page !== "connect") {
        navigateToConnect(undefined, true);
      }
      return;
    }
    if (restoredIdRef.current !== null && route.page === "home") {
      navigateToSession(restoredIdRef.current, true);
      restoredIdRef.current = null;
      return; // navigateToSession triggers hashchange → this effect re-runs with the session route
    }
    restoredIdRef.current = null;

    if (route.page === "session") {
      const store = useStore.getState();
      if (store.lastSessionId !== route.sessionId) {
        store.setLastSessionId(route.sessionId);
      }
      connectSession(route.sessionId);
    }
    // Home means "no selected session", but we keep the remembered session
    // unless the user explicitly started a fresh session flow.
    // Other pages preserve the remembered session for restore/back-navigation.
  }, [isAuthenticated, route]);

  // Keep git changed-files count in sync for the badge regardless of which tab is active.
  // DiffPanel does the same when mounted; this covers the case where the diff tab is closed.
  const changedFilesTick = useStore((s) => selectedSessionId ? s.changedFilesTick.get(selectedSessionId) ?? 0 : 0);
  const diffBase = useStore((s) => s.diffBase);
  const setGitChangedFilesCount = useStore((s) => s.setGitChangedFilesCount);
  const sessionCwd = useStore((s) => {
    if (!selectedSessionId) return null;
    return s.sessions.get(selectedSessionId)?.cwd
      || s.sdkSessions.find((sdk) => sdk.sessionId === selectedSessionId)?.cwd
      || null;
  });
  useEffect(() => {
    if (!selectedSessionId || !sessionCwd) return;
    let cancelled = false;
    api.getChangedFiles(sessionCwd, diffBase).then(({ files }) => {
      if (cancelled) return;
      const prefix = `${sessionCwd}/`;
      const count = files.filter((f) => f.path === sessionCwd || f.path.startsWith(prefix)).length;
      setGitChangedFilesCount(selectedSessionId, count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedSessionId, sessionCwd, diffBase, changedFilesTick, setGitChangedFilesCount]);

  // Auth gate: show login page when not authenticated
  if (!isAuthenticated || isConnectPage) {
    return <LoginPage route={isConnectPage ? route : null} />;
  }

  if (route.page === "playground") {
    return <Suspense fallback={<LazyFallback />}><Playground /></Suspense>;
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
      className="fixed inset-0 font-sans bg-background text-foreground antialiased pt-safe overflow-hidden overscroll-none"
    >
      <SafariTintProbe />
      <MobileViewportBackdrop />

      {/* Sidebar — shadcn sidebar-04 floating variant */}
      <Sidebar />

      {/* App shell — main area */}
      <SidebarInset className="flex flex-col overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-hidden relative">
          {isSettingsPage && (
            <div className="absolute inset-0 overflow-y-auto">
              <Suspense fallback={<LazyFallback />}><SettingsPage /></Suspense>
            </div>
          )}

          {isEnvironmentsPage && (
            <div className="absolute inset-0 overflow-y-auto">
              <Suspense fallback={<LazyFallback />}><EnvManager /></Suspense>
            </div>
          )}

          {isDockerBuilderPage && (
            <div className="absolute inset-0">
              <Suspense fallback={<LazyFallback />}><DockerBuilderPage /></Suspense>
            </div>
          )}

          {isScheduledPage && (
            <div className="absolute inset-0 overflow-y-auto">
              <Suspense fallback={<LazyFallback />}><CronManager /></Suspense>
            </div>
          )}

          {isAgentsPage && (
            <div className="absolute inset-0 overflow-y-auto">
              <Suspense fallback={<LazyFallback />}><AgentsPage route={route} /></Suspense>
            </div>
          )}

          {isSessionWorkspace && (
            <>
              <div className="absolute inset-0">
                {selectedSessionId ? (
                  activeTab === "terminal"
                    ? (
                      <SessionTerminalDock
                        sessionId={selectedSessionId}
                        terminalOnly
                        onClosePanel={() => useStore.getState().setActiveTab("chat")}
                      />
                    )
                    : activeTab === "processes"
                      ? <Suspense fallback={<LazyFallback />}><ProcessPanel sessionId={selectedSessionId} /></Suspense>
                      : activeTab === "editor"
                        ? <SessionEditorPane sessionId={selectedSessionId} />
                        : (
                        <SessionTerminalDock sessionId={selectedSessionId} suppressPanel>
                          {activeTab === "diff"
                            ? <DiffPanel sessionId={selectedSessionId} />
                            : <ChatView sessionId={selectedSessionId} />}
                        </SessionTerminalDock>
                      )
                ) : (
                  <HomePage key={homeResetKey} />
                )}
              </div>

              {/* Session launch overlay — shown during creation */}
              {sessionCreating && creationProgress && creationProgress.length > 0 && (
                <SessionLaunchOverlay
                  steps={creationProgress}
                  error={creationError}
                  backend={sessionCreatingBackend ?? undefined}
                  onCancel={() => useStore.getState().clearCreation()}
                />
              )}
            </>
          )}
        </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
