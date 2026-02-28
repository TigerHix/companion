import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ClaudeMdFile {
  path: string;
  content: string;
}

interface ClaudeMdEditorProps {
  cwd: string;
  open: boolean;
  onClose: () => void;
}

export function ClaudeMdEditor({ cwd, open, onClose }: ClaudeMdEditorProps) {
  const [files, setFiles] = useState<ClaudeMdFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<null | string>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getClaudeMdFiles(cwd)
      .then((res) => {
        setFiles(res.files);
        if (res.files.length > 0) {
          setSelectedIdx(0);
          setEditContent(res.files[0].content);
          setCreateMode(null);
        } else {
          setCreateMode(null);
        }
        setDirty(false);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [cwd]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleSelect = (idx: number) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSelectedIdx(idx);
    setEditContent(files[idx].content);
    setDirty(false);
    setCreateMode(null);
  };

  const handleSave = async () => {
    const path = createMode || files[selectedIdx]?.path;
    if (!path) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveClaudeMd(path, editContent);
      setDirty(false);
      // Reload to pick up new file
      if (createMode) {
        load();
      } else {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === selectedIdx ? { ...f, content: editContent } : f,
          ),
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = (location: "root" | "dotclaude") => {
    const path =
      location === "root" ? `${cwd}/CLAUDE.md` : `${cwd}/.claude/CLAUDE.md`;
    setCreateMode(path);
    setEditContent("# CLAUDE.md\n\n");
    setDirty(true);
  };

  const handleClose = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onClose();
  };

  if (!open) return null;

  const relPath = (p: string) =>
    p.startsWith(cwd + "/") ? p.slice(cwd.length + 1) : p;

  // Check which locations already have files
  const hasRoot = files.some((f) => f.path === `${cwd}/CLAUDE.md`);
  const hasDotClaude = files.some(
    (f) => f.path === `${cwd}/.claude/CLAUDE.md`,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="left-4 top-4 right-4 bottom-4 h-auto w-auto max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:left-8 sm:top-8 sm:right-8 sm:bottom-8 sm:max-w-none md:left-[10%] md:top-[5%] md:right-[10%] md:bottom-[5%]"
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 text-primary"
              >
                <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13zm1 .5v12h8V4h-1.5a.5.5 0 01-.5-.5V2H5zm6 0v1h1l-1-1z" />
              </svg>
            </div>
            <div>
              <DialogHeader className="gap-0">
                <DialogTitle className="text-sm font-semibold text-foreground">CLAUDE.md</DialogTitle>
                <DialogDescription className="mt-0 text-[11px]">
                  Project instructions for Claude Code
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleClose}
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* File tabs sidebar */}
              <div className="shrink-0 w-[180px] sm:w-[200px] border-r border-border bg-sidebar flex flex-col">
                <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  Files
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {files.map((f, i) => (
                    <Button
                      type="button"
                      key={f.path}
                      onClick={() => handleSelect(i)}
                      variant="ghost"
                      size="sm"
                      className={`flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] transition-colors cursor-pointer ${
                        !createMode && selectedIdx === i
                          ? "bg-accent text-foreground"
                          : "text-foreground/70 hover:bg-accent"
                      }`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-3 h-3 text-primary shrink-0"
                      >
                        <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13z" />
                      </svg>
                      <span className="truncate font-mono">
                        {relPath(f.path)}
                      </span>
                    </Button>
                  ))}
                  {createMode && (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-[12px] bg-accent text-foreground">
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-3 h-3 text-success shrink-0"
                      >
                        <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
                      </svg>
                      <span className="truncate font-mono">
                        {relPath(createMode)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Create new file button */}
                {(!hasRoot || !hasDotClaude) && !createMode && (
                  <div className="shrink-0 border-t border-border p-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
                      Create new
                    </div>
                    {!hasRoot && (
                      <Button
                        type="button"
                        onClick={() => handleCreate("root")}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start px-2 py-1.5 text-[11px] text-foreground/70"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3 h-3 text-success shrink-0"
                        >
                          <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
                        </svg>
                        <span className="font-mono">CLAUDE.md</span>
                      </Button>
                    )}
                    {!hasDotClaude && (
                      <Button
                        type="button"
                        onClick={() => handleCreate("dotclaude")}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start px-2 py-1.5 text-[11px] text-foreground/70"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3 h-3 text-success shrink-0"
                        >
                          <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
                        </svg>
                        <span className="font-mono">
                          .claude/CLAUDE.md
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Editor area */}
              <div className="flex-1 flex flex-col min-w-0">
                {files.length === 0 && !createMode ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-6 h-6 text-muted-foreground"
                      >
                        <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-foreground font-medium mb-1">
                        No CLAUDE.md found
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                        Create a CLAUDE.md file to give Claude Code project-specific instructions, coding conventions, and context.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => handleCreate("root")}
                        size="sm"
                        className="text-xs"
                      >
                        Create CLAUDE.md
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleCreate("dotclaude")}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Create .claude/CLAUDE.md
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* File path bar */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                      <span className="text-[12px] text-muted-foreground font-mono truncate">
                        {createMode
                          ? relPath(createMode)
                          : relPath(files[selectedIdx]?.path ?? "")}
                      </span>
                      <div className="flex items-center gap-2">
                        {dirty && (
                        <span className="text-[10px] text-warning font-medium">
                          Unsaved
                        </span>
                      )}
                        <Button
                          type="button"
                          onClick={handleSave}
                          disabled={!dirty || saving}
                          size="sm"
                          className="h-7 text-[11px]"
                        >
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>

                    {/* Textarea */}
                    <Textarea
                      value={editContent}
                      onChange={(e) => {
                        setEditContent(e.target.value);
                        setDirty(true);
                      }}
                      spellCheck={false}
                      className="min-h-0 flex-1 w-full rounded-none border-0 bg-background p-4 text-[13px] font-mono leading-relaxed shadow-none ring-0 focus-visible:ring-0"
                      placeholder="Write your project instructions here..."
                    />
                  </>
                )}

                {/* Error bar */}
                {error && (
                  <div className="shrink-0 px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-xs text-destructive">
                    {error}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
