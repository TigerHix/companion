import { Shield } from "lucide-react";
import type { PermissionRequest } from "../types.js";

interface AiValidationBadgeProps {
  entry: {
    request: PermissionRequest;
    behavior: "allow" | "deny";
    reason: string;
    timestamp: number;
  };
}

/** Compact inline notification for AI auto-resolved permissions. */
export function AiValidationBadge({ entry }: AiValidationBadgeProps) {
  const { request, behavior, reason } = entry;
  const isAllow = behavior === "allow";

  // Build a short description of what was auto-resolved
  let toolDesc = request.tool_name;
  if (request.tool_name === "Bash" && typeof request.input.command === "string") {
    const cmd = request.input.command;
    toolDesc = cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
  } else if ((request.tool_name === "Read" || request.tool_name === "Write" || request.tool_name === "Edit") && typeof request.input.file_path === "string") {
    toolDesc = `${request.tool_name} ${request.input.file_path}`;
  } else if (request.tool_name === "Glob" && typeof request.input.pattern === "string") {
    toolDesc = `Glob ${request.input.pattern}`;
  } else if (request.tool_name === "Grep" && typeof request.input.pattern === "string") {
    toolDesc = `Grep ${request.input.pattern}`;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
      isAllow ? "text-success" : "text-destructive"
    }`}>
      <Shield className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span>
        AI auto-{isAllow ? "approved" : "denied"}:
        {" "}
        <span className="font-mono opacity-80">{toolDesc}</span>
        {reason && (
          <span className="text-muted-foreground ml-1">({reason})</span>
        )}
      </span>
    </div>
  );
}
