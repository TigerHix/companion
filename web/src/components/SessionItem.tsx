import { useState, useEffect, useCallback, useRef, type RefObject } from "react";
import { Clock, Archive, MoreVertical } from "lucide-react";
import type { SessionItem as SessionItemType } from "../utils/project-grouping.js";
import { Badge } from "@/components/ui/badge";
import { BackendBadge } from "@/components/ui/backend-badge";
import { Button } from "@/components/ui/button";

interface SessionItemProps {
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
  editInputRef: RefObject<HTMLInputElement | null>;
}

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

export function SessionItem({
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
}: SessionItemProps) {
  const shortId = s.id.slice(0, 8);
  const label = sessionName || s.model || shortId;
  const isEditing = editingSessionId === s.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLDivElement>(null);

  const derivedStatus = archived ? ("exited" as DerivedStatus) : deriveStatus(s);

  // Show the full cwd path below the session name
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

  return (
    <div className="relative group">
      {isEditing ? (
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
            className="text-[13px] font-medium flex-1 min-w-0 text-foreground bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSelect(s.id)}
          onDoubleClick={(e) => {
            e.preventDefault();
            onStartRename(s.id, label);
          }}
          className={`w-full min-h-[44px] h-auto justify-start gap-1.5 rounded-lg py-2 pl-1 pr-12 transition-colors duration-100 ${
            isActive ? "bg-accent" : "hover:bg-accent"
          }`}
        >
          <StatusDot status={derivedStatus} />
          <div className="flex-1 min-w-0">
            <span
              className={`text-[13px] font-medium truncate text-foreground leading-snug block ${
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
        </Button>
      )}

      {/* Archive button — hover reveal (desktop), always visible (mobile) */}
      {!archived && !isEditing && !menuOpen && (
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
          <Archive className="w-3 h-3" />
        </Button>
      )}

      {/* Three-dot menu button */}
      <div
        ref={menuBtnRef}
      >
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
              className="w-full justify-start rounded-none px-3 py-1.5 text-[12px] text-foreground"
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
                className="w-full justify-start rounded-none px-3 py-1.5 text-[12px] text-foreground"
              >
                Restore
              </Button>
              <Button
                type="button"
                onClick={(e) => handleMenuAction(() => onDelete(e, s.id))}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-none px-3 py-1.5 text-[12px] text-destructive hover:text-destructive"
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
              className="w-full justify-start rounded-none px-3 py-1.5 text-[12px] text-foreground"
            >
              Archive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
