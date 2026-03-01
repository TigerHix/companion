import { useState, type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  ListTree,
} from "lucide-react";
import { useStore } from "../store.js";
import { sendToSession } from "../ws.js";
import type { PermissionRequest } from "../types.js";
import type { PermissionUpdate, AiValidationInfo } from "../../server/session-types.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiffViewer } from "./DiffViewer.js";

/** Human-readable label for a permission suggestion */
function suggestionLabel(s: PermissionUpdate): string {
  if (s.type === "setMode") return `Set mode to "${s.mode}"`;
  const dest = s.destination;
  const scope = dest === "session" ? "for session" : "always";
  if (s.type === "addRules" || s.type === "replaceRules") {
    const rule = s.rules[0];
    if (rule?.ruleContent) return `Allow "${rule.ruleContent}" ${scope}`;
    if (rule?.toolName) return `Allow ${rule.toolName} ${scope}`;
  }
  if (s.type === "addDirectories") {
    return `Trust ${s.directories[0] || "directory"} ${scope}`;
  }
  return `Allow ${scope}`;
}

export function PermissionBanner({
  permission,
  sessionId,
}: {
  permission: PermissionRequest;
  sessionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const removePermission = useStore((s) => s.removePermission);

  function handleAllow(updatedInput?: Record<string, unknown>, updatedPermissions?: PermissionUpdate[]) {
    setLoading(true);
    sendToSession(sessionId, {
      type: "permission_response",
      request_id: permission.request_id,
      behavior: "allow",
      updated_input: updatedInput,
      ...(updatedPermissions?.length ? { updated_permissions: updatedPermissions } : {}),
    });
    removePermission(sessionId, permission.request_id);
  }

  function handleDeny() {
    setLoading(true);
    sendToSession(sessionId, {
      type: "permission_response",
      request_id: permission.request_id,
      behavior: "deny",
      message: "Denied by user",
    });
    removePermission(sessionId, permission.request_id);
  }

  const isAskUser = permission.tool_name === "AskUserQuestion";
  const suggestions = permission.permission_suggestions;

  return (
    <div className="px-2 sm:px-4 py-3 border-b border-border animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Icon */}
          <div className={cn(
            "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isAskUser
              ? "bg-primary/10 border border-primary/20"
              : "bg-warning/10 border border-warning/20"
          )}>
            {isAskUser ? (
              <AlertCircle className="size-4 text-primary" />
            ) : (
              <AlertTriangle className="size-4 text-warning" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                "text-xs font-semibold",
                isAskUser ? "text-primary" : "text-warning"
              )}>
                {isAskUser ? "Question" : "Permission Request"}
              </span>
              {!isAskUser && (
                <span className="text-xs text-muted-foreground font-mono">{permission.tool_name}</span>
              )}
            </div>

            {isAskUser ? (
              <AskUserQuestionDisplay
                input={permission.input}
                onSelect={(answers) => handleAllow({ ...permission.input, answers })}
                disabled={loading}
              />
            ) : (
              <ToolInputDisplay toolName={permission.tool_name} input={permission.input} description={permission.description} />
            )}

            {/* AI validation recommendation (shown for "uncertain" verdicts that fall through to manual) */}
            {permission.ai_validation && !isAskUser && (
              <AiValidationBadge validation={permission.ai_validation} />
            )}

            {/* Actions - only for non-AskUserQuestion tools */}
            {!isAskUser && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button
                  onClick={() => handleAllow()}
                  disabled={loading}
                  size="sm"
                  className="bg-success/90 hover:bg-success text-white border-0"
                >
                  <Check className="size-3" />
                  Allow
                </Button>

                {/* Permission suggestion buttons — only when CLI provides them */}
                {suggestions?.map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAllow(undefined, [suggestion])}
                    disabled={loading}
                    title={`${suggestion.type}: ${JSON.stringify(suggestion)}`}
                    className="text-primary border-primary/20 bg-primary/10 hover:bg-primary/20"
                  >
                    <Check className="size-3" />
                    {suggestionLabel(suggestion)}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeny}
                  disabled={loading}
                >
                  <X className="size-3" />
                  Deny
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function isServiceFailure(reason: string): boolean {
  const failurePatterns = [
    /^Invalid Anthropic/i,
    /^Anthropic .*(rate limit|overloaded|unavailable|error|lacks permission)/i,
    /^AI service/i,
    /^AI evaluation timed out/i,
    /^Model not found/i,
    /^No Anthropic API key/i,
  ];
  return failurePatterns.some((pattern) => pattern.test(reason));
}

function AiValidationBadge({ validation }: { validation: AiValidationInfo }) {
  const isFailure = validation.verdict === "uncertain" && isServiceFailure(validation.reason);
  const label = isFailure ? "AI analysis unavailable — manual review:" : "AI analysis:";

  return (
    <div className={cn(
      "mt-2 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md",
      validation.verdict === "safe"
        ? "bg-success/10 text-success"
        : validation.verdict === "dangerous"
          ? "bg-destructive/10 text-destructive"
          : "bg-warning/10 text-warning",
    )}>
      <AlertCircle className="size-3 shrink-0" />
      <span className="font-medium">{label}</span>
      <span>{validation.reason}</span>
    </div>
  );
}

function ToolInputDisplay({
  toolName,
  input,
  description,
}: {
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}) {
  if (toolName === "Bash") {
    return <BashDisplay input={input} />;
  }
  if (toolName === "Edit") {
    return <EditDisplay input={input} />;
  }
  if (toolName === "Write") {
    return <WriteDisplay input={input} />;
  }
  if (toolName === "Read") {
    return <ReadDisplay input={input} />;
  }
  if (toolName === "Glob") {
    return <GlobDisplay input={input} />;
  }
  if (toolName === "Grep") {
    return <GrepDisplay input={input} />;
  }
  if (toolName === "ExitPlanMode") {
    return <ExitPlanModeDisplay input={input} />;
  }

  // Fallback: formatted key-value display
  return <GenericDisplay input={input} description={description} />;
}

function BashDisplay({ input }: { input: Record<string, unknown> }) {
  const command = typeof input.command === "string" ? input.command : "";
  const desc = typeof input.description === "string" ? input.description : "";

  return (
    <div className="space-y-1.5">
      {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      <pre className="text-xs text-foreground font-mono bg-code-bg/30 rounded-lg px-2 sm:px-3 py-2 max-h-32 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words">
        <span className="text-muted-foreground select-none">$ </span>{command}
      </pre>
    </div>
  );
}

function AskUserQuestionDisplay({
  input,
  onSelect,
  disabled,
}: {
  input: Record<string, unknown>;
  onSelect: (answers: Record<string, string>) => void;
  disabled: boolean;
}) {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({});

  function handleOptionClick(questionIdx: number, label: string) {
    const key = String(questionIdx);
    setSelections((prev) => ({ ...prev, [key]: label }));
    setShowCustom((prev) => ({ ...prev, [key]: false }));

    // Auto-submit if single question
    if (questions.length <= 1) {
      onSelect({ [key]: label });
    }
  }

  function handleCustomSubmit(questionIdx: number) {
    const key = String(questionIdx);
    const text = customText[key]?.trim();
    if (!text) return;
    setSelections((prev) => ({ ...prev, [key]: text }));

    if (questions.length <= 1) {
      onSelect({ [key]: text });
    }
  }

  function handleCustomChange(questionIdx: number, value: string) {
    const key = String(questionIdx);
    setCustomText((prev) => ({ ...prev, [key]: value }));
    const trimmed = value.trim();
    setSelections((prev) => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: trimmed };
    });
  }

  function handleCustomToggle(questionIdx: number) {
    const key = String(questionIdx);
    setShowCustom((prev) => {
      const wasOpen = Boolean(prev[key]);
      const next = { ...prev, [key]: !wasOpen };
      if (wasOpen) {
        setSelections((s) => {
          const cleared = { ...s };
          delete cleared[key];
          return cleared;
        });
        setCustomText((t) => {
          const cleared = { ...t };
          delete cleared[key];
          return cleared;
        });
      }
      return next;
    });
  }

  function handleSubmitAll() {
    onSelect(selections);
  }

  if (questions.length === 0) {
    // Fallback for simple question string
    const question = typeof input.question === "string" ? input.question : "";
    if (question) {
      return (
        <div className="text-sm text-foreground bg-code-bg/30 rounded-lg px-3 py-2">
          {question}
        </div>
      );
    }
    return <GenericDisplay input={input} />;
  }

  return (
    <div className="space-y-3">
      {questions.map((q: Record<string, unknown>, i: number) => {
        const header = typeof q.header === "string" ? q.header : "";
        const text = typeof q.question === "string" ? q.question : "";
        const options = Array.isArray(q.options) ? q.options : [];
        const key = String(i);
        const selected = selections[key];
        const isCustom = showCustom[key];

        return (
          <div key={i} className="space-y-2">
            {header && (
              <Badge variant="secondary" className="text-[10px] text-primary bg-primary/10">
                {header}
              </Badge>
            )}
            {text && (
              <p className="text-sm text-foreground leading-relaxed">{text}</p>
            )}
            {options.length > 0 && (
              <div className="space-y-1.5">
                {options.map((opt: Record<string, unknown>, j: number) => {
                  const label = typeof opt.label === "string" ? opt.label : String(opt);
                  const desc = typeof opt.description === "string" ? opt.description : "";
                  const isSelected = selected === label;

                  return (
                    <Button
                      key={j}
                      type="button"
                      onClick={() => handleOptionClick(i, label)}
                      disabled={disabled}
                      className={cn(
                        "h-auto w-full justify-start whitespace-normal rounded-lg border px-3 py-2 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-accent/50 hover:bg-accent hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-primary" : "border-muted-foreground/40"
                        )}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </span>
                        <div>
                          <span className="text-xs font-medium text-foreground">{label}</span>
                          {desc && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>}
                        </div>
                      </div>
                    </Button>
                  );
                })}

                {/* "Other" option */}
                <Button
                  type="button"
                  onClick={() => handleCustomToggle(i)}
                  disabled={disabled}
                  className={cn(
                    "h-auto w-full justify-start whitespace-normal rounded-lg border px-3 py-2 text-left transition-all",
                    isCustom
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-accent/50 hover:bg-accent hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      isCustom ? "border-primary" : "border-muted-foreground/40"
                    )}>
                      {isCustom && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Other...</span>
                  </div>
                </Button>

                {isCustom && (
                  <div className="pl-6">
                    <input
                      type="text"
                      value={customText[key] || ""}
                      onChange={(e) => handleCustomChange(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(i); }}
                      placeholder="Type your answer..."
                      className="w-full px-2.5 py-1.5 text-xs input-moku rounded-lg text-foreground placeholder:text-muted-foreground"
                      autoFocus
                    />
                    {questions.length <= 1 && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Press Enter to submit</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Submit all for multi-question */}
      {questions.length > 1 && Object.keys(selections).length > 0 && (
        <Button
          onClick={handleSubmitAll}
          disabled={disabled}
        >
          Submit answers
        </Button>
      )}
    </div>
  );
}

function EditDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");

  return (
    <DiffViewer
      oldText={oldStr}
      newText={newStr}
      fileName={filePath}
      mode="compact"
    />
  );
}

function WriteDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const content = String(input.content || "");

  return (
    <DiffViewer
      newText={content}
      fileName={filePath}
      mode="compact"
    />
  );
}

function ReadDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  return (
    <div className="text-xs text-muted-foreground font-mono bg-code-bg/30 rounded-lg px-3 py-2">
      {filePath}
    </div>
  );
}

function GlobDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : "";
  const path = typeof input.path === "string" ? input.path : "";
  return (
    <div className="text-xs font-mono bg-code-bg/30 rounded-lg px-3 py-2 space-y-0.5">
      <div className="text-foreground">{pattern}</div>
      {path && <div className="text-muted-foreground">{path}</div>}
    </div>
  );
}

function GrepDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : "";
  const path = typeof input.path === "string" ? input.path : "";
  const glob = typeof input.glob === "string" ? input.glob : "";
  return (
    <div className="text-xs font-mono bg-code-bg/30 rounded-lg px-3 py-2 space-y-0.5">
      <div className="text-foreground">{pattern}</div>
      {path && <div className="text-muted-foreground">{path}</div>}
      {glob && <div className="text-muted-foreground">{glob}</div>}
    </div>
  );
}

function ExitPlanModeDisplay({ input }: { input: Record<string, unknown> }) {
  const plan = typeof input.plan === "string" ? input.plan : "";
  const allowedPrompts = Array.isArray(input.allowedPrompts) ? input.allowedPrompts : [];

  return (
    <div className="space-y-2">
      {plan && (
        <div className="rounded-xl border border-border overflow-hidden card-moku">
          <div className="px-3 py-2 border-b border-border bg-primary/[0.04] flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary/15 text-primary shrink-0">
              <ListTree className="size-3" />
            </span>
            <span className="text-xs text-primary font-semibold tracking-wide uppercase">Plan</span>
          </div>
          <div className="px-3 py-3 max-h-72 overflow-y-auto markdown-body text-sm text-foreground leading-relaxed">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-base font-semibold text-foreground mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mb-1.5 mt-3 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium text-foreground mb-1.5 mt-2">{children}</h3>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>
                ),
                code: (props: ComponentProps<"code">) => {
                  const { children, className } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = match || (typeof children === "string" && children.includes("\n"));

                  if (isBlock) {
                    return (
                      <pre className="my-2 px-2.5 py-2 rounded-lg bg-code-bg text-code-fg text-xs font-mono leading-relaxed overflow-x-auto border border-border">
                        <code>{children}</code>
                      </pre>
                    );
                  }

                  return (
                    <code className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-code-fg font-mono text-xs">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic my-2">{children}</blockquote>
                ),
              }}
            >
              {plan}
            </Markdown>
          </div>
        </div>
      )}
      {allowedPrompts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Requested permissions</div>
          <div className="space-y-1">
            {allowedPrompts.map((p: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono bg-code-bg/30 rounded-lg px-2.5 py-1.5">
                <span className="text-muted-foreground shrink-0">{String(p.tool || "")}</span>
                <span className="text-foreground">{String(p.prompt || "")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!plan && allowedPrompts.length === 0 && (
        <div className="text-xs text-muted-foreground">Plan approval requested</div>
      )}
    </div>
  );
}

function GenericDisplay({
  input,
  description,
}: {
  input: Record<string, unknown>;
  description?: string;
}) {
  const entries = Object.entries(input).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  if (entries.length === 0 && description) {
    return <div className="text-xs text-foreground">{description}</div>;
  }

  return (
    <div className="space-y-1">
      {description && <div className="text-xs text-muted-foreground mb-1">{description}</div>}
      <div className="bg-code-bg/30 rounded-lg px-3 py-2 space-y-1">
        {entries.map(([key, value]) => {
          const displayValue = typeof value === "string"
            ? value.length > 200 ? value.slice(0, 200) + "..." : value
            : JSON.stringify(value);
          return (
            <div key={key} className="flex gap-2 text-xs font-mono">
              <span className="text-muted-foreground shrink-0">{key}:</span>
              <span className="text-foreground break-all">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
