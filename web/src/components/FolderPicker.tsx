import { useState, useEffect, useCallback } from "react";
import { api, type DirEntry } from "../api.js";
import { getRecentDirs, addRecentDir } from "../utils/recent-dirs.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FolderPickerProps {
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPicker({ initialPath, onSelect, onClose }: FolderPickerProps) {
  const [browsePath, setBrowsePath] = useState("");
  const [browseDirs, setBrowseDirs] = useState<DirEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [dirInput, setDirInput] = useState("");
  const [showDirInput, setShowDirInput] = useState(false);
  const [recentDirs] = useState<string[]>(() => getRecentDirs());

  const loadDirs = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const result = await api.listDirs(path);
      setBrowsePath(result.path);
      setBrowseDirs(result.dirs);
    } catch {
      setBrowseDirs([]);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirs(initialPath || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectDir(path: string) {
    addRecentDir(path);
    onSelect(path);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="top-auto left-0 bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-[14px] rounded-b-none p-0 sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[14px]"
      >
      <div
        className="w-full max-w-lg h-[min(480px,90dvh)] mx-0 sm:mx-4 flex flex-col bg-background border border-border rounded-t-[14px] sm:rounded-[14px] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4 shrink-0">
          <DialogTitle className="text-sm font-semibold text-foreground">Select Folder</DialogTitle>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </Button>
        </DialogHeader>

        {/* Recent directories */}
        {recentDirs.length > 0 && (
          <div className="border-b border-border shrink-0">
            <div className="px-4 pt-2.5 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider">Recent</div>
            {recentDirs.map((dir) => (
              <Button
                key={dir}
                type="button"
                onClick={() => selectDir(dir)}
                variant="ghost"
                className="w-full justify-start gap-2 rounded-none px-4 py-2 text-xs text-foreground sm:py-1.5"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0">
                  <path d="M8 3.5a.5.5 0 00-1 0V8a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 7.71V3.5z" />
                  <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z" />
                </svg>
                <span className="font-medium truncate">{dir.split("/").pop() || dir}</span>
                <span className="text-muted-foreground font-mono text-[10px] truncate ml-auto">{dir}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Path bar */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
          {showDirInput ? (
            <input
              type="text"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirInput.trim()) {
                  selectDir(dirInput.trim());
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setShowDirInput(false);
                }
              }}
              placeholder="/path/to/project"
              className="flex-1 px-2 py-1 text-base sm:text-xs bg-card border border-border rounded-md text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              autoFocus
            />
          ) : (
            <>
              {/* Go up button */}
              {browsePath && browsePath !== "/" && (
                <Button
                  type="button"
                  onClick={() => {
                    const parent = browsePath.split("/").slice(0, -1).join("/") || "/";
                    loadDirs(parent);
                  }}
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Go to parent directory"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M8 12l-4-4h2.5V4h3v4H12L8 12z" transform="rotate(180 8 8)" />
                  </svg>
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground font-mono truncate flex-1">{browsePath}</span>
              <Button
                type="button"
                onClick={() => { setShowDirInput(true); setDirInput(browsePath); }}
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Type path manually"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.098a.25.25 0 00-.064.108l-.563 1.97 1.971-.564a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.354l-1.098-1.097z" />
                </svg>
              </Button>
            </>
          )}
        </div>

        {/* Directory browser */}
        {!showDirInput && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Select current directory */}
            <Button
              type="button"
              onClick={() => selectDir(browsePath)}
              variant="ghost"
              className="w-full justify-start gap-2 rounded-none border-b border-border px-4 py-2 text-xs text-primary font-medium hover:text-primary"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" />
              </svg>
              <span className="truncate font-mono">Select: {browsePath.split("/").pop() || "/"}</span>
            </Button>

            {/* Subdirectories */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {browseLoading ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">Loading...</div>
              ) : browseDirs.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">No subdirectories</div>
              ) : (
                browseDirs.map((d) => (
                  <div
                    key={d.path}
                    className="flex items-center hover:bg-accent transition-colors"
                  >
                    <Button
                      type="button"
                      onClick={() => loadDirs(d.path)}
                      onDoubleClick={() => selectDir(d.path)}
                      variant="ghost"
                      className="min-w-0 flex-1 justify-start gap-2 rounded-none px-4 py-2 text-xs font-mono text-foreground sm:py-1.5"
                      title={d.path}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40 shrink-0">
                        <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                      </svg>
                      <span className="truncate">{d.name}</span>
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0 ml-auto">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => selectDir(d.path)}
                      variant="ghost"
                      size="icon-xs"
                      className="mr-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-primary sm:h-6 sm:w-6"
                      title={`Select ${d.name}`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                        <path d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" />
                      </svg>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
}
