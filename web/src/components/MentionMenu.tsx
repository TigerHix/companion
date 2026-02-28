import type { SavedPrompt } from "../api.js";
import { Button } from "@/components/ui/button";

interface MentionMenuProps {
  open: boolean;
  loading: boolean;
  prompts: SavedPrompt[];
  selectedIndex: number;
  onSelect: (prompt: SavedPrompt) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function MentionMenu({
  open,
  loading,
  prompts,
  selectedIndex,
  onSelect,
  menuRef,
  className = "",
}: MentionMenuProps) {
  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className={`max-h-[240px] overflow-y-auto bg-card border border-border rounded-[10px] shadow-lg z-20 py-1 ${className}`}
    >
      {loading ? (
        <div className="px-3 py-2 text-[12px] text-muted-foreground">
          Searching prompts...
        </div>
      ) : prompts.length > 0 ? (
        prompts.map((prompt, i) => (
          <Button
            key={prompt.id}
            type="button"
            data-prompt-index={i}
            onClick={() => onSelect(prompt)}
            variant="ghost"
            className={`h-auto w-full justify-start gap-2.5 rounded-none px-3 py-2 text-left ${
              i === selectedIndex
                ? "bg-accent"
                : "hover:bg-accent/50"
            }`}
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-accent text-muted-foreground shrink-0">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M2.5 8a5.5 5.5 0 1111 0v3a2.5 2.5 0 01-2.5 2.5h-1" strokeLinecap="round" />
                <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">@{prompt.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{prompt.content}</div>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{prompt.scope}</span>
          </Button>
        ))
      ) : (
        <div className="px-3 py-2 text-[12px] text-muted-foreground">
          No prompts found.
        </div>
      )}
    </div>
  );
}
