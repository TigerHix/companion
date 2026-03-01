import { useState, useMemo, type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Lightbulb, Copy, Check } from "lucide-react";
import type { ChatMessage, ContentBlock } from "../types.js";
import { ToolBlock, getToolIcon, getToolLabel, getPreview, ToolIcon } from "./ToolBlock.js";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex items-center gap-3 py-1 min-w-0 overflow-hidden">
        <Separator className="flex-1 shrink-[2]" />
        <span className="text-xs text-muted-foreground italic font-mono shrink min-w-0 truncate px-1">
          {message.content}
        </span>
        <Separator className="flex-1 shrink-[2]" />
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-[fadeSlideIn_0.2s_ease-out]">
        <div className="max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2.5 rounded-[14px] rounded-br-[4px] bg-primary text-primary-foreground">
          {message.images && message.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.media_type};base64,${img.data}`}
                  alt="attachment"
                  className="max-w-[150px] sm:max-w-[200px] max-h-[120px] sm:max-h-[150px] rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          <div className="text-base sm:text-sm leading-relaxed break-words">
            <MarkdownContent text={message.content} />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <AssistantMessage message={message} />
    </div>
  );
}

interface ToolGroupItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolUseInfo {
  name: string;
  input: Record<string, unknown>;
}

type GroupedBlock =
  | { kind: "content"; block: ContentBlock }
  | { kind: "tool_group"; name: string; items: ToolGroupItem[] };

function groupContentBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = [];

  for (const block of blocks) {
    if (block.type === "tool_use") {
      const last = groups[groups.length - 1];
      if (last?.kind === "tool_group" && last.name === block.name) {
        last.items.push({ id: block.id, name: block.name, input: block.input });
      } else {
        groups.push({
          kind: "tool_group",
          name: block.name,
          items: [{ id: block.id, name: block.name, input: block.input }],
        });
      }
    } else {
      groups.push({ kind: "content", block });
    }
  }

  return groups;
}

function mapToolUsesById(blocks: ContentBlock[]): Map<string, ToolUseInfo> {
  const map = new Map<string, ToolUseInfo>();
  for (const block of blocks) {
    if (block.type === "tool_use") {
      map.set(block.id, { name: block.name, input: block.input });
    }
  }
  return map;
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const blocks = message.contentBlocks || [];

  const grouped = useMemo(() => groupContentBlocks(blocks), [blocks]);
  const toolUseById = useMemo(() => mapToolUsesById(blocks), [blocks]);

  if (blocks.length === 0 && message.content) {
    return (
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          <MarkdownContent text={message.content} showCursor={!!message.isStreaming} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 space-y-3">
        {grouped.map((group, i) => {
          if (group.kind === "content") {
            return <ContentBlockRenderer key={i} block={group.block} toolUseById={toolUseById} />;
          }
          // Single tool_use renders as before
          if (group.items.length === 1) {
            const item = group.items[0];
            return <ToolBlock key={i} name={item.name} input={item.input} toolUseId={item.id} />;
          }
          // Grouped tool_uses
          return <ToolGroupBlock key={i} name={group.name} items={group.items} />;
        })}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  // Placeholder — avatar may be restored later
  return null;
}

function MarkdownContent({ text, showCursor = false }: { text: string; showCursor?: boolean }) {
  return (
    <div className="markdown-body text-base sm:text-sm text-foreground leading-relaxed overflow-hidden">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-foreground mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-3 mb-1">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground">{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          hr: () => (
            <Separator className="my-4" />
          ),
          code: (props: ComponentProps<"code">) => {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = match || (typeof children === "string" && children.includes("\n"));

            if (isBlock) {
              const lang = match?.[1] || "";
              return (
                <div className="my-2 rounded-lg overflow-hidden border border-border">
                  {lang && (
                    <div className="px-3 py-1.5 bg-code-bg/80 border-b border-border text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                      {lang}
                    </div>
                  )}
                  <pre className="px-2 sm:px-3 py-2 sm:py-2.5 bg-code-bg text-code-fg text-xs font-mono leading-relaxed overflow-x-auto">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-xs font-mono text-foreground/80">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-code-bg/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-foreground border-b border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-xs text-foreground border-b border-border">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </Markdown>
      {showCursor && (
        <span
          data-testid="assistant-stream-cursor"
          className="stream-cursor"
        />
      )}
    </div>
  );
}

function ContentBlockRenderer({
  block,
  toolUseById,
}: {
  block: ContentBlock;
  toolUseById: Map<string, ToolUseInfo>;
}) {
  if (block.type === "text") {
    return <MarkdownContent text={block.text} />;
  }

  if (block.type === "thinking") {
    return <ThinkingBlock text={block.thinking} />;
  }

  if (block.type === "tool_use") {
    return <ToolBlock name={block.name} input={block.input} toolUseId={block.id} />;
  }

  if (block.type === "tool_result") {
    const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
    const linkedTool = toolUseById.get(block.tool_use_id);
    const toolName = linkedTool?.name;
    const isError = block.is_error ?? false;
    if (toolName === "Bash") {
      return <BashResultBlock text={content} isError={isError} />;
    }
    return (
      <div className={cn(
        "text-xs font-mono rounded-lg px-3 py-2 border max-h-40 overflow-y-auto whitespace-pre-wrap",
        isError
          ? "bg-destructive/5 border-destructive/20 text-destructive"
          : "bg-card border-border text-muted-foreground"
      )}>
        {content}
      </div>
    );
  }

  return null;
}

function BashResultBlock({ text, isError }: { text: string; isError: boolean }) {
  const lines = text.split(/\r?\n/);
  const hasMore = lines.length > 20;
  const [showFull, setShowFull] = useState(false);
  const rendered = showFull || !hasMore ? text : lines.slice(-20).join("\n");

  return (
    <div className={cn(
      "rounded-lg border",
      isError
        ? "bg-destructive/5 border-destructive/20"
        : "bg-card border-border"
    )}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className={cn(
          "text-[10px] font-medium",
          isError ? "text-destructive" : "text-muted-foreground"
        )}>
          {hasMore && !showFull ? "Output (last 20 lines)" : "Output"}
        </span>
        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowFull(!showFull)}
            className="h-auto px-0 py-0 text-primary"
          >
            {showFull ? "Show tail" : "Show full"}
          </Button>
        )}
      </div>
      <pre className={cn(
        "text-xs font-mono px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto",
        isError ? "text-destructive" : "text-muted-foreground"
      )}>
        {rendered}
      </pre>
    </div>
  );
}

function ToolGroupBlock({ name, items }: { name: string; items: ToolGroupItem[] }) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(name);
  const label = getToolLabel(name);

  return (
    <div className="border border-border rounded-[10px] overflow-hidden card-moku">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-9 w-full justify-start gap-3 rounded-none px-3 text-left hover:bg-accent/50"
      >
        <ChevronRight
          className={cn(
            "size-3 text-muted-foreground transition-transform shrink-0",
            open && "rotate-90"
          )}
        />
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-foreground">{label}</span>
        <Badge variant="secondary" className="text-[10px] tabular-nums px-1.5 py-0.5 h-auto">
          {items.length}
        </Badge>
      </Button>

      {open && (
        <div className="border-t border-border px-3 py-1.5">
          {items.map((item, i) => {
            const preview = getPreview(item.name, item.input);
            return (
              <div key={item.id || i} className="flex items-center gap-2 py-1 text-xs text-muted-foreground font-mono truncate">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="truncate">{preview || JSON.stringify(item.input).slice(0, 80)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const normalized = text.trim();
  const preview = normalized.replace(/\s+/g, " ").slice(0, 90);
  const [open, setOpen] = useState(Boolean(normalized));

  return (
    <div className="border border-border rounded-[10px] overflow-hidden card-moku">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-9 w-full justify-start gap-3 rounded-none px-3 text-xs text-muted-foreground hover:bg-accent/50"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-primary shrink-0">
          <Lightbulb className="size-3" />
        </span>
        <span className="font-medium text-foreground">Reasoning</span>
        <span className="text-muted-foreground/60">{text.length} chars</span>
        {!open && preview && (
          <span className="text-muted-foreground truncate max-w-[55%]">{preview}</span>
        )}
      </Button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          <div className="border border-border/70 rounded-lg px-3 py-2 bg-background/60 max-h-60 overflow-y-auto">
            <div className="markdown-body text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-foreground/80 font-mono text-xs">
                      {children}
                    </code>
                  ),
                }}
              >
                {normalized || "No thinking text captured."}
              </Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
