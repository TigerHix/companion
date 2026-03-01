import { useMemo } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { Button } from "@/components/ui/button";

import { MessageFeed } from "./MessageFeed.js";
import { Composer } from "./Composer.js";
import { PermissionBanner } from "./PermissionBanner.js";
import { AiValidationBadge } from "./AiValidationBadge.js";

export function ChatView({ sessionId }: { sessionId: string }) {
  const sessionPerms = useStore((s) => s.pendingPermissions.get(sessionId));
  const aiResolved = useStore((s) => s.aiResolvedPermissions.get(sessionId));
  const connStatus = useStore(
    (s) => s.connectionStatus.get(sessionId) ?? "disconnected"
  );
  const cliConnected = useStore((s) => s.cliConnected.get(sessionId) ?? false);

  const perms = useMemo(
    () => (sessionPerms ? Array.from(sessionPerms.values()) : []),
    [sessionPerms]
  );

  return (
    <div className="flex flex-col h-full min-h-0 pb-14 md:pb-0">
      {/* CLI disconnected banner */}
      {connStatus === "connected" && !cliConnected && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 text-center flex items-center justify-center gap-3">
          <span className="text-xs text-warning font-medium">
            CLI disconnected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => api.relaunchSession(sessionId).catch(() => {})}
            className="text-xs font-medium px-3 py-1 border-warning/50 bg-warning/20 hover:bg-warning/30 text-warning"
          >
            Reconnect
          </Button>
        </div>
      )}

      {/* WebSocket disconnected banner */}
      {connStatus === "disconnected" && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 text-center">
          <span className="text-xs text-warning font-medium">
            Reconnecting to session...
          </span>
        </div>
      )}

      {/* Message feed */}
      <MessageFeed sessionId={sessionId} />

      {/* AI auto-resolved notifications */}
      {aiResolved && aiResolved.length > 0 && (
        <div className="shrink-0 border-t border-border bg-card">
          {aiResolved.slice(-5).map((entry, i) => (
            <AiValidationBadge key={`${entry.request.request_id}-${i}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Permission banners */}
      {perms.length > 0 && (
        <div className="shrink-0 max-h-[60dvh] overflow-y-auto border-t border-border bg-card">
          {perms.map((p) => (
            <PermissionBanner key={p.request_id} permission={p} sessionId={sessionId} />
          ))}
        </div>
      )}

      {/* Composer */}
      <Composer sessionId={sessionId} />
    </div>
  );
}
