import type { RefObject } from "react";
import { ChevronRight, Folder } from "lucide-react";
import type { ProjectGroup as ProjectGroupType } from "../utils/project-grouping.js";
import { SessionItem } from "./SessionItem.js";
import { Button } from "@/components/ui/button";

interface ProjectGroupProps {
  group: ProjectGroupType;
  isCollapsed: boolean;
  onToggleCollapse: (projectKey: string) => void;
  currentSessionId: string | null;
  sessionNames: Map<string, string>;
  pendingPermissions: Map<string, Map<string, unknown>>;
  recentlyRenamed: Set<string>;
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
  isFirst: boolean;
}

export function ProjectGroup({
  group,
  isCollapsed,
  onToggleCollapse,
  currentSessionId,
  sessionNames,
  pendingPermissions,
  recentlyRenamed,
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
  isFirst,
}: ProjectGroupProps) {
  // Build collapsed preview: first 2 session names
  const collapsedPreview = isCollapsed
    ? group.sessions
        .slice(0, 2)
        .map((s) => sessionNames.get(s.id) || s.model || s.id.slice(0, 8))
        .join(", ") + (group.sessions.length > 2 ? ", ..." : "")
    : "";

  return (
    <div className={!isFirst ? "my-2 pt-2 border-t border-border" : ""}>
      {/* Group header */}
      <Button
        type="button"
        onClick={() => onToggleCollapse(group.key)}
        variant="ghost"
        className="w-full justify-start gap-1.5 px-2 py-1.5"
      >
        <ChevronRight
          className={`w-2.5 h-2.5 text-muted-foreground transition-transform ${isCollapsed ? "" : "rotate-90"}`}
        />
        {/* Folder icon */}
        <Folder className="w-3 h-3 text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-semibold text-foreground/80 truncate">
          {group.label}
        </span>

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
      </Button>

      {/* Collapsed preview */}
      {isCollapsed && collapsedPreview && (
        <div className="text-[10px] text-muted-foreground/70 truncate pl-7 pb-1">
          {collapsedPreview}
        </div>
      )}

      {/* Session list */}
      {!isCollapsed && (
        <div className="space-y-px mt-1">
          {group.sessions.map((s) => {
            const permCount = pendingPermissions.get(s.id)?.size ?? 0;
            return (
              <SessionItem
                key={s.id}
                session={s}
                isActive={currentSessionId === s.id}
                sessionName={sessionNames.get(s.id)}
                permCount={permCount}
                isRecentlyRenamed={recentlyRenamed.has(s.id)}
                onSelect={onSelect}
                onStartRename={onStartRename}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                onClearRecentlyRenamed={onClearRecentlyRenamed}
                editingSessionId={editingSessionId}
                editingName={editingName}
                setEditingName={setEditingName}
                onConfirmRename={onConfirmRename}
                onCancelRename={onCancelRename}
                editInputRef={editInputRef}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
