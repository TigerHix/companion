import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { sendMcpGetStatus, sendMcpToggle, sendMcpReconnect, sendMcpSetServers } from "../ws.js";
import type { McpServerDetail, McpServerConfig } from "../types.js";
import { Button } from "@/components/ui/button";

const EMPTY_SERVERS: McpServerDetail[] = [];
const EMPTY_MCP_INIT: { name: string; status: string }[] = [];

const STATUS_STYLES: Record<string, { label: string; badge: string; dot: string }> = {
  connected:  { label: "Connected",  badge: "text-success bg-success/10", dot: "bg-success" },
  connecting: { label: "Connecting", badge: "text-warning bg-warning/10", dot: "bg-warning animate-pulse" },
  failed:     { label: "Failed",     badge: "text-destructive bg-destructive/10",     dot: "bg-destructive" },
  disabled:   { label: "Disabled",   badge: "text-muted-foreground bg-accent",        dot: "bg-muted-foreground opacity-40" },
};
const DEFAULT_STATUS = { label: "Unknown", badge: "text-muted-foreground bg-accent", dot: "bg-muted-foreground opacity-40" };

function McpServerRow({
  server,
  sessionId,
}: {
  server: McpServerDetail;
  sessionId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[server.status] || DEFAULT_STATUS;
  const isEnabled = server.status !== "disabled";
  const toolCount = server.tools?.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />

        {/* Name + expand toggle */}
        <Button
          type="button"
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          className="min-w-0 flex-1 h-auto justify-start px-0 py-0 text-left"
        >
          <span className="text-[12px] font-medium text-foreground truncate block">
            {server.name}
          </span>
        </Button>

        <span className={`text-[9px] font-medium px-1.5 rounded-full leading-[16px] shrink-0 ${style.badge}`}>
          {style.label}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Toggle enable/disable */}
          <Button
            type="button"
            onClick={() => sendMcpToggle(sessionId, server.name, !isEnabled)}
            variant="ghost"
            size="icon-xs"
            className={`transition-colors ${
              isEnabled
                ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                : "text-muted-foreground/50 hover:text-success hover:bg-success/10"
            }`}
            title={isEnabled ? "Disable server" : "Enable server"}
          >
            {isEnabled ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <circle cx="8" cy="8" r="6" />
                <path d="M5 8h6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v6M5 8h6" strokeLinecap="round" />
              </svg>
            )}
          </Button>

          {/* Reconnect */}
          {(server.status === "failed" || server.status === "connected") && (
            <Button
              type="button"
              onClick={() => sendMcpReconnect(sessionId, server.name)}
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              title="Reconnect server"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M2.5 8a5.5 5.5 0 019.78-3.5M13.5 8a5.5 5.5 0 01-9.78 3.5" strokeLinecap="round" />
                <path d="M12.5 2v3h-3M3.5 14v-3h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 pt-2">
          {/* Config info */}
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/60">Type:</span>
              <span>{server.config.type}</span>
            </div>
            {server.config.command && (
              <div className="flex items-start gap-1">
                <span className="text-muted-foreground/60 shrink-0">Cmd:</span>
                <span className="font-mono text-[10px] break-all">
                  {server.config.command}
                  {server.config.args?.length ? ` ${server.config.args.join(" ")}` : ""}
                </span>
              </div>
            )}
            {server.config.url && (
              <div className="flex items-start gap-1">
                <span className="text-muted-foreground/60 shrink-0">URL:</span>
                <span className="font-mono text-[10px] break-all">{server.config.url}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/60">Scope:</span>
              <span>{server.scope}</span>
            </div>
          </div>

          {/* Error */}
          {server.error && (
            <div className="text-[11px] text-destructive bg-destructive/5 rounded px-2 py-1">
              {server.error}
            </div>
          )}

          {/* Tools */}
          {toolCount > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Tools ({toolCount})
              </span>
              <div className="flex flex-wrap gap-1">
                {server.tools!.map((tool) => (
                  <span
                    key={tool.name}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent text-foreground"
                    title={
                      tool.annotations
                        ? Object.entries(tool.annotations)
                            .filter(([, v]) => v)
                            .map(([k]) => k)
                            .join(", ") || undefined
                        : undefined
                    }
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ServerType = "stdio" | "sse" | "http";

function AddServerForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [serverType, setServerType] = useState<ServerType>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");

  const canSubmit =
    name.trim() &&
    (serverType === "stdio" ? command.trim() : url.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const config: McpServerConfig = { type: serverType };
    if (serverType === "stdio") {
      config.command = command.trim();
      if (args.trim()) config.args = args.trim().split(/\s+/);
    } else {
      config.url = url.trim();
    }

    sendMcpSetServers(sessionId, { [name.trim()]: config });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-2.5 rounded-lg border border-border bg-background">
      {/* Server name */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
          Server Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-mcp-server"
          className="w-full text-[12px] bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Server type */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
          Type
        </label>
        <div className="flex gap-1">
          {(["stdio", "sse", "http"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              onClick={() => setServerType(t)}
              variant="outline"
              size="xs"
              className={`text-[11px] ${
                serverType === t
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Stdio fields */}
      {serverType === "stdio" && (
        <>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
              Command
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx -y @modelcontextprotocol/server-memory"
              className="w-full text-[12px] bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
              Args (space-separated, optional)
            </label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="--port 3000"
              className="w-full text-[12px] bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 font-mono focus:outline-none focus:border-primary"
            />
          </div>
        </>
      )}

      {/* URL field for sse/http */}
      {(serverType === "sse" || serverType === "http") && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
            URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000/mcp"
            className="w-full text-[12px] bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 font-mono focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        <Button
          type="submit"
          disabled={!canSubmit}
          className={`flex-1 text-[11px] ${
            canSubmit
              ? "bg-primary text-white hover:bg-primary/90 cursor-pointer"
              : "bg-accent text-muted-foreground cursor-not-allowed"
          }`}
        >
          Add Server
        </Button>
        <Button
          type="button"
          onClick={onDone}
          variant="ghost"
          size="xs"
          className="text-[11px] text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function McpSection({ sessionId }: { sessionId: string }) {
  const servers = useStore((s) => s.mcpServers.get(sessionId) || EMPTY_SERVERS);
  const cliConnected = useStore((s) => s.cliConnected.get(sessionId) ?? false);
  const [showAddForm, setShowAddForm] = useState(false);

  // The session_init mcp_servers gives us basic info (name + status).
  // We can detect if MCP servers exist from session state to show the section.
  const sessionMcpServers = useStore(
    (s) => s.sessions.get(sessionId)?.mcp_servers ?? EMPTY_MCP_INIT,
  );

  const hasMcp = servers.length > 0 || sessionMcpServers.length > 0;

  // Auto-fetch detailed status when connected.
  // For Codex sessions, session_init may not include MCP server hints, so
  // we must fetch regardless of current hasMcp detection.
  useEffect(() => {
    if (cliConnected) {
      sendMcpGetStatus(sessionId);
    }
  }, [sessionId, cliConnected]);

  // If we have detailed servers, use those; otherwise fall back to basic info
  const displayServers: McpServerDetail[] =
    servers.length > 0
      ? servers
      : sessionMcpServers.map((s) => ({
          name: s.name,
          status: s.status as McpServerDetail["status"],
          config: { type: "unknown" },
          scope: "",
        }));

  return (
    <>
      {/* MCP section header */}
      <div className="shrink-0 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted-foreground">
            <path d="M1.5 3A1.5 1.5 0 013 1.5h10A1.5 1.5 0 0114.5 3v1A1.5 1.5 0 0113 5.5H3A1.5 1.5 0 011.5 4V3zm0 5A1.5 1.5 0 013 6.5h10A1.5 1.5 0 0114.5 8v1A1.5 1.5 0 0113 10.5H3A1.5 1.5 0 011.5 9V8zm0 5A1.5 1.5 0 013 11.5h10a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5H3A1.5 1.5 0 011.5 14v-1z" />
          </svg>
          MCP Servers
        </span>
        <div className="flex items-center gap-1">
          {/* Add server button */}
          <Button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={!cliConnected}
            variant="ghost"
            size="icon-xs"
            className={`text-[11px] font-medium ${
              cliConnected
                ? "text-muted-foreground hover:text-foreground cursor-pointer"
                : "text-muted-foreground/30 cursor-not-allowed"
            }`}
            title="Add MCP server"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
          </Button>
          {/* Refresh button */}
          <Button
            type="button"
            onClick={() => sendMcpGetStatus(sessionId)}
            disabled={!cliConnected}
            variant="ghost"
            size="icon-xs"
            className={`text-[11px] font-medium ${
              cliConnected
                ? "text-muted-foreground hover:text-foreground cursor-pointer"
                : "text-muted-foreground/30 cursor-not-allowed"
            }`}
            title="Refresh MCP server status"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M2.5 8a5.5 5.5 0 019.78-3.5M13.5 8a5.5 5.5 0 01-9.78 3.5" strokeLinecap="round" />
              <path d="M12.5 2v3h-3M3.5 14v-3h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Add server form */}
      {showAddForm && (
        <div className="px-3 py-2">
          <AddServerForm
            sessionId={sessionId}
            onDone={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Server list */}
      {displayServers.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          {displayServers.map((server) => (
            <McpServerRow
              key={server.name}
              server={server}
              sessionId={sessionId}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!showAddForm && displayServers.length === 0 && (
        <div className="px-3 py-3">
          <p className="text-[11px] text-muted-foreground text-center">
            No MCP servers configured.{" "}
            {cliConnected && (
              <Button
                type="button"
                onClick={() => setShowAddForm(true)}
                variant="link"
                size="xs"
                className="h-auto px-0 py-0 align-baseline"
              >
                Add one
              </Button>
            )}
          </p>
        </div>
      )}
    </>
  );
}
