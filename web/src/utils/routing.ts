import { installClipboardWriteFallback } from "./clipboard.js";

export type Route =
  | { page: "home" }
  | { page: "connect"; server?: string; token?: string }
  | { page: "session"; sessionId: string }
  | { page: "settings" }
  | { page: "environments" }
  | { page: "docker-builder" }
  | { page: "scheduled" }
  | { page: "agents" }
  | { page: "agent-detail"; agentId: string }
  | { page: "playground" };

const SESSION_PREFIX = "#/session/";
const AGENT_PREFIX = "#/agents/";
const CONNECT_ROUTE = "#/connect";
let clipboardFallbackInitialized = false;

function ensureClipboardFallbackInstalled(): void {
  if (clipboardFallbackInitialized) return;
  installClipboardWriteFallback();
  clipboardFallbackInitialized = true;
}

/**
 * Parse a window.location.hash string into a typed Route.
 */
export function parseHash(hash: string): Route {
  ensureClipboardFallbackInstalled();

  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const [path, query = ""] = normalized.split("?");
  const params = new URLSearchParams(query);

  if (path === "/connect") {
    const server = params.get("server") || undefined;
    const token = params.get("token") || undefined;
    return { page: "connect", server, token };
  }
  if (path === "/settings") return { page: "settings" };
  if (path === "/environments") return { page: "environments" };
  if (path === "/docker-builder") return { page: "docker-builder" };
  // #/scheduled redirects to #/agents (cron absorbed into agents)
  if (path === "/scheduled") return { page: "agents" };
  if (path === "/agents") return { page: "agents" };
  if (path === "/playground") return { page: "playground" };

  if (hash.startsWith(AGENT_PREFIX)) {
    const agentId = hash.slice(AGENT_PREFIX.length).split("?")[0];
    if (agentId) return { page: "agent-detail", agentId };
  }

  if (hash.startsWith(SESSION_PREFIX)) {
    const sessionId = hash.slice(SESSION_PREFIX.length).split("?")[0];
    if (sessionId) return { page: "session", sessionId };
  }

  return { page: "home" };
}

/**
 * Build a hash string for a given session ID.
 */
export function sessionHash(sessionId: string): string {
  return `#/session/${sessionId}`;
}

export function connectHash(params?: { server?: string; token?: string }): string {
  const search = new URLSearchParams();
  if (params?.server) search.set("server", params.server);
  if (params?.token) search.set("token", params.token);
  const query = search.toString();
  return query ? `${CONNECT_ROUTE}?${query}` : CONNECT_ROUTE;
}

/**
 * Navigate to a session by updating the URL hash.
 * When replace=true, uses replaceState to avoid creating a history entry.
 */
export function navigateToSession(sessionId: string, replace = false): void {
  ensureClipboardFallbackInstalled();

  const newHash = sessionHash(sessionId);
  if (replace) {
    history.replaceState(null, "", newHash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = `/session/${sessionId}`;
  }
}

export function navigateToConnect(
  params?: { server?: string; token?: string },
  replace = false,
): void {
  ensureClipboardFallbackInstalled();
  const newHash = connectHash(params);
  if (replace) {
    history.replaceState(null, "", newHash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = newHash.slice(1);
  }
}

/**
 * Navigate to the home page (no session selected) by clearing the hash.
 * When replace=true, uses replaceState to avoid creating a history entry.
 */
export function navigateHome(replace = false): void {
  ensureClipboardFallbackInstalled();

  if (replace) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = "";
  }
}
