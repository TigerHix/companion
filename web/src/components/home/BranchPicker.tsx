import { useState, useEffect, useRef } from "react";
import { api, type GitRepoInfo, type GitBranchInfo } from "../../api.js";
import { Button } from "@/components/ui/button";

interface BranchPickerProps {
  cwd: string;
  gitRepoInfo: GitRepoInfo | null;
  selectedBranch: string;
  isNewBranch: boolean;
  useWorktree: boolean;
  onBranchChange: (branch: string, isNew: boolean) => void;
  onWorktreeChange: (useWorktree: boolean) => void;
  /** Expose branches + pull check to parent for session creation */
  onBranchesLoaded: (branches: GitBranchInfo[]) => void;
}

export function BranchPicker({
  cwd,
  gitRepoInfo,
  selectedBranch,
  isNewBranch,
  useWorktree,
  onBranchChange,
  onWorktreeChange,
  onBranchesLoaded,
}: BranchPickerProps) {
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");

  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  // Fetch branches when git repo changes
  useEffect(() => {
    if (gitRepoInfo) {
      api.listBranches(gitRepoInfo.repoRoot).then((b) => {
        setBranches(b);
        onBranchesLoaded(b);
      }).catch(() => {
        setBranches([]);
        onBranchesLoaded([]);
      });
    } else {
      setBranches([]);
      onBranchesLoaded([]);
    }
  }, [gitRepoInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gitRepoInfo) return null;

  return (
    <>
      {/* Branch picker */}
      <div className="relative" ref={branchDropdownRef}>
        <Button
          type="button"
          aria-expanded={showBranchDropdown}
          onClick={() => {
            if (!showBranchDropdown && gitRepoInfo) {
              api.gitFetch(gitRepoInfo.repoRoot)
                .catch(() => {})
                .finally(() => {
                  api.listBranches(gitRepoInfo.repoRoot).then((b) => {
                    setBranches(b);
                    onBranchesLoaded(b);
                  }).catch(() => {
                    setBranches([]);
                    onBranchesLoaded([]);
                  });
                });
            }
            setShowBranchDropdown(!showBranchDropdown);
            setBranchFilter("");
          }}
          variant="ghost"
          size="xs"
          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
            <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.378A2.5 2.5 0 007.5 8h1a1 1 0 010 2h-1A2.5 2.5 0 005 12.5v.128a2.25 2.25 0 101.5 0V12.5a1 1 0 011-1h1a2.5 2.5 0 000-5h-1a1 1 0 01-1-1V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
          </svg>
          <span className="max-w-[100px] sm:max-w-[160px] truncate font-mono">
            {selectedBranch || gitRepoInfo.currentBranch}
          </span>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </Button>
        {showBranchDropdown && (
          <div className="absolute left-0 bottom-full mb-1 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-[10px] shadow-lg z-10 overflow-hidden">
            {/* Search/filter input */}
            <div className="px-2 py-2 border-b border-border">
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="Filter or create branch..."
                className="w-full px-2 py-1 text-base sm:text-xs bg-card border border-border rounded-md text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowBranchDropdown(false);
                  }
                }}
              />
            </div>
            {/* Branch list */}
            <div className="max-h-[240px] overflow-y-auto py-1">
              {(() => {
                const filter = branchFilter.toLowerCase().trim();
                const localBranches = branches.filter((b) => !b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                const remoteBranches = branches.filter((b) => b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                const exactMatch = branches.some((b) => b.name.toLowerCase() === filter);
                const hasResults = localBranches.length > 0 || remoteBranches.length > 0;

                return (
                  <>
                    {/* Local branches */}
                    {localBranches.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">Local</div>
                        {localBranches.map((b) => (
                          <Button
                            key={b.name}
                            type="button"
                            onClick={() => {
                              onBranchChange(b.name, false);
                              setShowBranchDropdown(false);
                            }}
                            variant="ghost"
                            className={`w-full justify-start gap-2 rounded-none px-3 py-1.5 text-xs ${
                              b.name === selectedBranch ? "text-primary font-medium" : "text-foreground"
                            }`}
                          >
                            <span className="truncate font-mono">{b.name}</span>
                            <span className="ml-auto flex items-center gap-1.5 shrink-0">
                              {b.ahead > 0 && (
                                <span className="text-[9px] text-git-ahead">{b.ahead}&#8593;</span>
                              )}
                              {b.behind > 0 && (
                                <span className="text-[9px] text-git-behind">{b.behind}&#8595;</span>
                              )}
                              {b.worktreePath && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground">wt</span>
                              )}
                              {b.isCurrent && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-git-added/12 text-git-added">current</span>
                              )}
                            </span>
                          </Button>
                        ))}
                      </>
                    )}
                    {/* Remote branches */}
                    {remoteBranches.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Remote</div>
                        {remoteBranches.map((b) => (
                          <Button
                            key={`remote-${b.name}`}
                            type="button"
                            onClick={() => {
                              onBranchChange(b.name, false);
                              setShowBranchDropdown(false);
                            }}
                            variant="ghost"
                            className={`w-full justify-start gap-2 rounded-none px-3 py-1.5 text-xs ${
                              b.name === selectedBranch ? "text-primary font-medium" : "text-foreground"
                            }`}
                          >
                            <span className="truncate font-mono">{b.name}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground ml-auto shrink-0">remote</span>
                          </Button>
                        ))}
                      </>
                    )}
                    {/* No results */}
                    {!hasResults && filter && (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">No matching branches</div>
                    )}
                    {/* Create new branch option */}
                    {filter && !exactMatch && (
                      <div className="border-t border-border mt-1 pt-1">
                        <Button
                          type="button"
                          onClick={() => {
                            onBranchChange(branchFilter.trim(), true);
                            setShowBranchDropdown(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-2 rounded-none px-3 py-1.5 text-xs text-primary hover:text-primary"
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                          </svg>
                          <span>Create <span className="font-mono font-medium">{branchFilter.trim()}</span></span>
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Worktree toggle */}
      <Button
        type="button"
        onClick={() => onWorktreeChange(!useWorktree)}
        variant="ghost"
        size="xs"
        className={`px-2 py-1 text-xs ${
          useWorktree
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        title="Create an isolated worktree for this session"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
          <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v5.256a2.25 2.25 0 101.5 0V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zm7.5-9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V7A2.5 2.5 0 0010 9.5H6a1 1 0 000 2h4a2.5 2.5 0 012.5 2.5v.628a2.25 2.25 0 11-1.5 0V14a1 1 0 00-1-1H6a2.5 2.5 0 01-2.5-2.5V10a2.5 2.5 0 012.5-2.5h4a1 1 0 001-1V5.372a2.25 2.25 0 01-1.5-2.122z" />
        </svg>
        <span>Worktree</span>
      </Button>
    </>
  );
}
