import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { Button } from "@/components/ui/button";
import { DiffViewer } from "./DiffViewer.js";

type FileChangeStatus = "created" | "updated" | "deleted";

function FileStatusIcon({ status }: { status: FileChangeStatus }) {
  if (status === "created") {
    return (
      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded-sm text-[10px] font-bold leading-none bg-git-added/15 text-git-added">
        A
      </span>
    );
  }
  if (status === "deleted") {
    return (
      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded-sm text-[10px] font-bold leading-none bg-git-removed/15 text-git-removed">
        D
      </span>
    );
  }
  return (
    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded-sm text-[10px] font-bold leading-none bg-git-modified/15 text-git-modified">
      M
    </span>
  );
}

export function DiffPanel({ sessionId }: { sessionId: string }) {
  const session = useStore((s) => s.sessions.get(sessionId));
  const sdkSession = useStore((s) => s.sdkSessions.find((sdk) => sdk.sessionId === sessionId));
  const selectedFile = useStore((s) => s.diffPanelSelectedFile.get(sessionId) ?? null);
  const setSelectedFile = useStore((s) => s.setDiffPanelSelectedFile);
  const diffBase = useStore((s) => s.diffBase);
  const setDiffBase = useStore((s) => s.setDiffBase);
  // changedFilesTick used only as a refresh trigger (bumped when agent edits files)
  const changedFilesTick = useStore((s) => s.changedFilesTick.get(sessionId) ?? 0);

  const cwd = session?.cwd || sdkSession?.cwd;

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const [gitFiles, setGitFiles] = useState<Array<{ abs: string; rel: string; status: FileChangeStatus }>>([]);
  const [diffsByPath, setDiffsByPath] = useState<Record<string, string>>({});
  const [diffErrorsByPath, setDiffErrorsByPath] = useState<Record<string, string>>({});

  const setGitChangedFilesCount = useStore((s) => s.setGitChangedFilesCount);

  // Fetch changed file list from git whenever cwd, base, or agent edits change
  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    api.getChangedFiles(cwd, diffBase).then(({ files }) => {
      if (cancelled) return;
      const cwdPrefix = `${cwd}/`;
      const result = files
        .filter((f) => f.path === cwd || f.path.startsWith(cwdPrefix))
        .map((f) => ({
          abs: f.path,
          rel: f.path.startsWith(cwdPrefix) ? f.path.slice(cwdPrefix.length) : f.path,
          status: (f.status === "A" || f.status === "?" ? "created" : f.status === "D" ? "deleted" : "updated") as FileChangeStatus,
        }))
        .sort((a, b) => a.rel.localeCompare(b.rel));
      setGitFiles(result);
      setGitChangedFilesCount(sessionId, result.length);
    }).catch(() => { if (!cancelled) { setGitFiles([]); setGitChangedFilesCount(sessionId, 0); } });
    return () => { cancelled = true; };
  }, [cwd, diffBase, changedFilesTick, sessionId, setGitChangedFilesCount]);

  const relativeChangedFiles = gitFiles;
  const activeFile = relativeChangedFiles.find((file) => file.abs === selectedFile) ?? relativeChangedFiles[0] ?? null;

  useEffect(() => {
    if (relativeChangedFiles.length === 0) {
      setDiffsByPath({});
      setDiffErrorsByPath({});
      return;
    }

    let cancelled = false;
    setDiffsByPath({});
    setDiffErrorsByPath({});

    Promise.all(relativeChangedFiles.map(async ({ abs }) => {
      try {
        const result = await api.getFileDiff(abs, diffBase);
        return { abs, diff: result.diff, error: null as string | null };
      } catch {
        return { abs, diff: "", error: "Unable to load diff." };
      }
    })).then((results) => {
      if (cancelled) return;

      const nextDiffs: Record<string, string> = {};
      const nextErrors: Record<string, string> = {};
      for (const result of results) {
        nextDiffs[result.abs] = result.diff;
        if (result.error) {
          nextErrors[result.abs] = result.error;
        }
      }
      setDiffsByPath(nextDiffs);
      setDiffErrorsByPath(nextErrors);
    });

    return () => {
      cancelled = true;
    };
  }, [relativeChangedFiles, diffBase]);

  useEffect(() => {
    if (relativeChangedFiles.length === 0) {
      if (selectedFile !== null) {
        setSelectedFile(sessionId, null);
      }
      return;
    }
    if (selectedFile && relativeChangedFiles.some((f) => f.abs === selectedFile)) return;
    setSelectedFile(sessionId, relativeChangedFiles[0].abs);
  }, [selectedFile, relativeChangedFiles, sessionId, setSelectedFile]);

  if (!cwd) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Waiting for session to initialize...</p>
      </div>
    );
  }

  if (relativeChangedFiles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 select-none px-6">
        <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-muted-foreground">
            <path d="M12 3v18M3 12h18" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm text-foreground font-medium mb-1">No changes yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            File changes compared to the base will appear here once the agent edits files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-background relative sm:flex sm:overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Changed files sidebar */}
      <div
        className={`
          ${sidebarOpen ? "w-[220px] translate-x-0" : "w-0 -translate-x-full"}
          fixed sm:relative z-30 sm:z-auto
          ${sidebarOpen ? "sm:w-[220px]" : "sm:w-0 sm:-translate-x-full"}
          shrink-0 h-full min-h-0 flex flex-col bg-sidebar border-r border-border transition-all duration-200 overflow-hidden
        `}
      >
        <div className="w-[220px] px-4 py-3 text-[11px] font-semibold text-foreground uppercase tracking-wider border-b border-border shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span>Changed ({relativeChangedFiles.length})</span>
          </div>
          <Button
            type="button"
            onClick={() => setSidebarOpen(false)}
            variant="ghost"
            size="icon-sm"
            className="sm:hidden text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {relativeChangedFiles.map(({ abs, rel, status }) => (
            <Button
              key={abs}
              type="button"
              onClick={() => {
                setSelectedFile(sessionId, abs);
                if (typeof window !== "undefined" && window.innerWidth < 640) {
                  setSidebarOpen(false);
                }
              }}
              variant="ghost"
              className={`mx-1 h-auto w-full justify-start gap-2 px-2 py-2.5 text-[13px] whitespace-nowrap ${
                abs === selectedFile ? "bg-accent text-foreground" : "text-foreground/70"
              }`}
              style={{ width: "calc(100% - 8px)" }}
            >
              <FileStatusIcon status={status} />
              <span className="truncate leading-snug">{rel}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Diff area */}
      <div className="flex min-h-full min-w-0 flex-1 flex-col sm:min-h-0 sm:h-full">
        {/* Top bar */}
        <div className="sticky top-0 z-10 shrink-0 flex items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-2.5 bg-card border-b border-border sm:static">
            {!sidebarOpen && (
              <Button
                type="button"
                onClick={() => setSidebarOpen(true)}
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Show file list"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                </svg>
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-foreground text-[13px] font-medium truncate block">
                {activeFile ? activeFile.rel : "Changed files"}
              </span>
              <span className="text-muted-foreground truncate text-[11px] hidden sm:block">
                Single-file rendered diff with sidebar switching to keep mobile scrolling fast
              </span>
            </div>
            <Button
              type="button"
              onClick={() => setDiffBase(diffBase === "last-commit" ? "default-branch" : "last-commit")}
              variant="ghost"
              size="xs"
              className="hidden shrink-0 h-auto px-0 py-0 text-[11px] text-muted-foreground hover:text-foreground sm:inline-flex"
              title={`Switch to ${diffBase === "last-commit" ? "default branch" : "last commit"} comparison`}
            >
              {diffBase === "default-branch" ? "vs default branch" : "vs last commit"}
            </Button>
          </div>

        {/* Diff content */}
        <div className="flex-1 min-h-0 overflow-visible sm:overflow-y-auto sm:overscroll-contain">
          <div className="min-h-full p-4 pb-8">
            {activeFile && (
              <div className="rounded-[10px] border border-primary/40 bg-accent p-3">
                <div className="flex items-start gap-3">
                  <FileStatusIcon status={activeFile.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">{activeFile.rel}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{activeFile.abs}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-border/70 bg-background px-3 py-2">
                  {diffErrorsByPath[activeFile.abs] ? (
                    <p className="text-[12px] text-warning">{diffErrorsByPath[activeFile.abs]}</p>
                  ) : diffsByPath[activeFile.abs] !== undefined ? (
                    <DiffViewer
                      unifiedDiff={diffsByPath[activeFile.abs]}
                      fileName={activeFile.rel}
                      mode="full"
                    />
                  ) : (
                    <p className="text-[12px] text-muted-foreground">Loading diff...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
