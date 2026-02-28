import { useState } from "react";
import {
  Terminal,
  File,
  FilePlus,
  FileEdit,
  Search,
  Globe,
  MessageSquare,
  List,
  UserRound,
  CheckSquare,
  NotebookPen,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DiffViewer } from "./DiffViewer.js";

const TOOL_ICONS: Record<string, string> = {
  Bash: "terminal",
  Read: "file",
  Write: "file-plus",
  Edit: "file-edit",
  Glob: "search",
  Grep: "search",
  WebFetch: "globe",
  WebSearch: "globe",
  NotebookEdit: "notebook",
  Task: "agent",
  TodoWrite: "checklist",
  TaskCreate: "list",
  TaskUpdate: "list",
  SendMessage: "message",
  // Codex tool types (mapped by codex-adapter)
  web_search: "globe",
  mcp_tool_call: "tool",
};

export function getToolIcon(name: string): string {
  return TOOL_ICONS[name] || "tool";
}

export function getToolLabel(name: string): string {
  if (name === "Bash") return "Terminal";
  if (name === "Read") return "Read File";
  if (name === "Write") return "Write File";
  if (name === "Edit") return "Edit File";
  if (name === "Glob") return "Find Files";
  if (name === "Grep") return "Search Content";
  if (name === "WebSearch") return "Web Search";
  if (name === "WebFetch") return "Web Fetch";
  if (name === "Task") return "Subagent";
  if (name === "TodoWrite") return "Tasks";
  if (name === "NotebookEdit") return "Notebook";
  if (name === "SendMessage") return "Message";
  if (name === "web_search") return "Web Search";
  if (name === "mcp_tool_call") return "MCP Tool";
  // Codex MCP tools come as "mcp:server:tool"
  if (name.startsWith("mcp:")) return name.split(":").slice(1).join(":");
  return name;
}

export function ToolBlock({
  name,
  input,
  toolUseId,
}: {
  name: string;
  input: Record<string, unknown>;
  toolUseId: string;
}) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(name);
  const label = getToolLabel(name);

  // Extract the most useful preview
  const preview = getPreview(name, input);

  return (
    <div className="border border-border rounded-[10px] overflow-hidden card-moku">
      <Button
        type="button"
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="sm"
        className="h-auto w-full justify-start gap-2.5 rounded-none px-3 py-2 text-left hover:bg-accent/50"
      >
        <ChevronRight
          className={cn(
            "size-3 text-muted-foreground transition-transform shrink-0",
            open && "rotate-90"
          )}
        />
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-foreground">{label}</span>
        {preview && (
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
            {preview}
          </span>
        )}
      </Button>

      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-border">
          <div className="mt-2">
            <ToolDetail name={name} input={input} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Route to custom detail renderer per tool type */
function ToolDetail({ name, input }: { name: string; input: Record<string, unknown> }) {
  switch (name) {
    case "Bash":
      return <BashDetail input={input} />;
    case "Edit":
      return <EditToolDetail input={input} />;
    case "Write":
      return <WriteToolDetail input={input} />;
    case "Read":
      return <ReadToolDetail input={input} />;
    case "Glob":
      return <GlobDetail input={input} />;
    case "Grep":
      return <GrepDetail input={input} />;
    case "WebSearch":
    case "web_search":
      return <WebSearchDetail input={input} />;
    case "WebFetch":
      return <WebFetchDetail input={input} />;
    case "Task":
      return <TaskDetail input={input} />;
    case "TodoWrite":
      return <TodoWriteDetail input={input} />;
    case "NotebookEdit":
      return <NotebookEditDetail input={input} />;
    case "SendMessage":
      return <SendMessageDetail input={input} />;
    default:
      return (
        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      );
  }
}

// ─── Per-tool detail components ─────────────────────────────────────────────

function BashDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {!!input.description && (
        <div className="text-[11px] text-muted-foreground italic">{String(input.description)}</div>
      )}
      <pre className="px-3 py-2 rounded-lg bg-code-bg text-code-fg text-[12px] font-mono leading-relaxed overflow-x-auto">
        <span className="text-muted-foreground select-none">$ </span>
        {String(input.command || "")}
      </pre>
      {!!input.timeout && (
        <div className="text-[10px] text-muted-foreground">timeout: {String(input.timeout)}ms</div>
      )}
    </div>
  );
}

function EditToolDetail({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");
  const rawChanges = Array.isArray(input.changes)
    ? input.changes as Array<{ path?: unknown; kind?: unknown }>
    : [];
  const changes = rawChanges
    .map((c) => ({
      path: typeof c.path === "string" ? c.path : "",
      kind: typeof c.kind === "string" ? c.kind : "update",
    }))
    .filter((c) => c.path);

  return (
    <div className="space-y-1.5">
      {!!input.replace_all && (
        <Badge variant="outline" className="text-[10px] text-warning border-warning/30 bg-warning/10">
          replace all
        </Badge>
      )}
      {(oldStr || newStr) ? (
        <DiffViewer oldText={oldStr} newText={newStr} fileName={filePath} mode="compact" />
      ) : changes.length > 0 ? (
        <div className="space-y-1.5">
          {!!filePath && <div className="text-xs text-muted-foreground font-mono">{filePath}</div>}
          {changes.map((change, i) => (
            <div key={`${change.path}-${i}`} className="flex items-center gap-2 text-[11px] text-foreground">
              <Badge variant="secondary" className="text-[10px] text-primary bg-primary/10 min-w-[54px] justify-center">
                {change.kind}
              </Badge>
              <span className="font-mono truncate">{change.path}</span>
            </div>
          ))}
        </div>
      ) : (
        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function WriteToolDetail({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const content = String(input.content || "");

  return <DiffViewer newText={content} fileName={filePath} mode="compact" />;
}

function ReadToolDetail({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || input.path || "");
  const offset = input.offset as number | undefined;
  const limit = input.limit as number | undefined;

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground font-mono">{filePath}</div>
      {(offset != null || limit != null) && (
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          {offset != null && <span>offset: {offset}</span>}
          {limit != null && <span>limit: {limit}</span>}
        </div>
      )}
    </div>
  );
}

function GlobDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-mono text-code-fg">{String(input.pattern || "")}</div>
      {!!input.path && (
        <div className="text-[10px] text-muted-foreground">
          in: <span className="font-mono">{String(input.path)}</span>
        </div>
      )}
    </div>
  );
}

function GrepDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <pre className="px-2 py-1.5 rounded bg-code-bg text-code-fg text-[12px] font-mono overflow-x-auto">
        {String(input.pattern || "")}
      </pre>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {!!input.path && (
          <span>path: <span className="font-mono">{String(input.path)}</span></span>
        )}
        {!!input.glob && (
          <span>glob: <span className="font-mono">{String(input.glob)}</span></span>
        )}
        {!!input.output_mode && <span>mode: {String(input.output_mode)}</span>}
        {!!input.context && <span>context: {String(input.context)}</span>}
        {!!input.head_limit && <span>limit: {String(input.head_limit)}</span>}
      </div>
    </div>
  );
}

function WebSearchDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-foreground font-medium">{String(input.query || "")}</div>
      {Array.isArray(input.allowed_domains) && input.allowed_domains.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          domains: {(input.allowed_domains as string[]).join(", ")}
        </div>
      )}
    </div>
  );
}

function WebFetchDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {!!input.url && (
        <div className="text-xs font-mono text-primary truncate">{String(input.url)}</div>
      )}
      {!!input.prompt && (
        <div className="text-[11px] text-muted-foreground italic line-clamp-2">{String(input.prompt)}</div>
      )}
    </div>
  );
}

function TaskDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {!!input.description && (
        <div className="text-xs text-foreground font-medium">{String(input.description)}</div>
      )}
      {!!input.subagent_type && (
        <Badge variant="secondary" className="text-[10px] text-primary bg-primary/10">
          {String(input.subagent_type)}
        </Badge>
      )}
      {!!input.prompt && (
        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
          {String(input.prompt)}
        </pre>
      )}
    </div>
  );
}

function TodoWriteDetail({ input }: { input: Record<string, unknown> }) {
  const todos = input.todos as Array<{ content?: string; status?: string; activeForm?: string }> | undefined;
  if (!Array.isArray(todos)) {
    return (
      <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
        {JSON.stringify(input, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-0.5">
      {todos.map((todo, i) => {
        const status = todo.status || "pending";
        return (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <span className="shrink-0 mt-0.5">
              {status === "completed" ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-success">
                  <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.708L7 8.586 5.354 6.94a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : status === "in_progress" ? (
                <svg className="w-3.5 h-3.5 text-primary animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-muted-foreground">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </span>
            <span className={cn(
              "text-[11px] leading-snug",
              status === "completed" ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {todo.content || "Task"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NotebookEditDetail({ input }: { input: Record<string, unknown> }) {
  const path = String(input.notebook_path || "");
  const cellType = input.cell_type as string | undefined;
  const editMode = input.edit_mode as string | undefined;

  return (
    <div className="space-y-1">
      <div className="text-xs font-mono text-muted-foreground">{path}</div>
      <div className="flex gap-2 text-[10px] text-muted-foreground">
        {cellType && <span>type: {cellType}</span>}
        {editMode && <span>mode: {editMode}</span>}
        {input.cell_number != null && <span>cell: {String(input.cell_number)}</span>}
      </div>
      {!!input.new_source && (
        <pre className="px-2 py-1.5 rounded bg-code-bg text-code-fg text-[11px] font-mono leading-relaxed max-h-40 overflow-y-auto">
          {String(input.new_source)}
        </pre>
      )}
    </div>
  );
}

function SendMessageDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {!!input.recipient && (
        <div className="text-[11px] text-muted-foreground">
          to: <span className="font-medium text-foreground">{String(input.recipient)}</span>
        </div>
      )}
      {!!input.content && (
        <div className="text-xs text-foreground whitespace-pre-wrap">{String(input.content)}</div>
      )}
    </div>
  );
}

// ─── Preview ────────────────────────────────────────────────────────────────

export function getPreview(name: string, input: Record<string, unknown>): string {
  if (name === "Bash" && typeof input.command === "string") {
    // Prefer description if short enough, otherwise show command
    if (input.description && typeof input.description === "string" && input.description.length <= 60) {
      return input.description;
    }
    return input.command.length > 60 ? input.command.slice(0, 60) + "..." : input.command;
  }
  if ((name === "Read" || name === "Write" || name === "Edit") && input.file_path) {
    const path = String(input.file_path);
    return path.split("/").slice(-2).join("/");
  }
  if (name === "Edit" && Array.isArray(input.changes) && input.changes.length > 0) {
    const first = input.changes[0] as { path?: string };
    if (first?.path) {
      return String(first.path).split("/").slice(-2).join("/");
    }
  }
  if (name === "Glob" && input.pattern) return String(input.pattern);
  if (name === "Grep" && input.pattern) {
    const p = String(input.pattern);
    const suffix = input.path ? ` in ${String(input.path).split("/").slice(-2).join("/")}` : "";
    const full = p + suffix;
    return full.length > 60 ? full.slice(0, 60) + "..." : full;
  }
  if ((name === "WebSearch" || name === "web_search") && input.query) return String(input.query);
  if (name === "WebFetch" && input.url) {
    try {
      const u = new URL(String(input.url));
      return u.hostname + u.pathname;
    } catch {
      return String(input.url).slice(0, 60);
    }
  }
  if (name === "Task" && input.description) return String(input.description);
  if (name === "TodoWrite" && Array.isArray(input.todos)) {
    return `${input.todos.length} task${input.todos.length !== 1 ? "s" : ""}`;
  }
  if (name === "NotebookEdit" && input.notebook_path) {
    return String(input.notebook_path).split("/").pop() || "";
  }
  if (name === "SendMessage" && input.recipient) {
    return `\u2192 ${String(input.recipient)}`;
  }
  return "";
}

// ─── Icons ──────────────────────────────────────────────────────────────────

export function ToolIcon({ type }: { type: string }) {
  const cls = "size-3.5 text-primary shrink-0";

  if (type === "terminal") return <Terminal className={cls} />;
  if (type === "file") return <File className={cls} />;
  if (type === "file-plus") return <FilePlus className={cls} />;
  if (type === "file-edit") return <FileEdit className={cls} />;
  if (type === "search") return <Search className={cls} />;
  if (type === "globe") return <Globe className={cls} />;
  if (type === "message") return <MessageSquare className={cls} />;
  if (type === "list") return <List className={cls} />;
  if (type === "agent") return <UserRound className={cls} />;
  if (type === "checklist") return <CheckSquare className={cls} />;
  if (type === "notebook") return <NotebookPen className={cls} />;
  // Default tool icon
  return <Wrench className={cls} />;
}
