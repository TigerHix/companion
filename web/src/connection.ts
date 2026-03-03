export interface StoredConnection {
  version: 1;
  serverUrl: string;
  authToken: string;
}

export interface PublicBackendInfo {
  name: string;
  backendVersion: string;
  authMode: "bearer_token";
  deploymentMode: "tailscale-hosted-frontend";
  frontendUrl: string;
  canonicalBackendUrl: string | null;
  allowedWebOrigins: string[];
  capabilities: {
    clientQrBootstrap: boolean;
    inAppEditor: boolean;
    hostedFrontendOnly: boolean;
  };
}

export const CONNECTION_STORAGE_KEY = "moku_connection";
export const LAST_SERVER_URL_STORAGE_KEY = "moku_last_server_url";
export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "moku_auth_token";
export const DEFAULT_FRONTEND_URL = "https://moku.sh";

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function isDevelopmentMode(): boolean {
  return !!import.meta.env.DEV;
}

function getWindowOrigin(): string | null {
  if (!canUseWindow()) return null;
  return window.location.origin;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname === "[::1]";
}

function canUseInsecureHttp(hostname: string): boolean {
  return isLoopbackHostname(hostname);
}

export function canonicalizeServerUrl(rawServerUrl: string): string {
  const trimmed = rawServerUrl.trim();
  if (!trimmed) {
    throw new Error("Please enter a backend URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid backend URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Backend URL must use http:// or https://");
  }

  if (parsed.protocol === "http:" && !canUseInsecureHttp(parsed.hostname)) {
    throw new Error("Production backends must use https://");
  }

  return `${parsed.protocol}//${parsed.host}`;
}

function normalizeConnection(
  connection: Partial<StoredConnection> | null | undefined,
): StoredConnection | null {
  if (!connection) return null;
  if (connection.version !== 1 && connection.version !== undefined) return null;
  if (typeof connection.authToken !== "string") return null;
  const authToken = connection.authToken.trim();
  if (!authToken && !isDevelopmentMode()) return null;

  if (typeof connection.serverUrl !== "string") return null;

  try {
    return {
      version: 1,
      serverUrl: canonicalizeServerUrl(connection.serverUrl),
      authToken,
    };
  } catch {
    return null;
  }
}

export function getRememberedServerUrl(): string | null {
  if (!canUseWindow()) return null;
  const raw = window.localStorage.getItem(LAST_SERVER_URL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return canonicalizeServerUrl(raw);
  } catch {
    window.localStorage.removeItem(LAST_SERVER_URL_STORAGE_KEY);
    return null;
  }
}

export function rememberServerUrl(serverUrl: string): string {
  const canonical = canonicalizeServerUrl(serverUrl);
  if (canUseWindow()) {
    window.localStorage.setItem(LAST_SERVER_URL_STORAGE_KEY, canonical);
  }
  return canonical;
}

export function clearRememberedServerUrl(): void {
  if (!canUseWindow()) return;
  window.localStorage.removeItem(LAST_SERVER_URL_STORAGE_KEY);
}

export function getStoredConnection(): StoredConnection | null {
  if (!canUseWindow()) return null;
  const raw = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConnection>;
    const normalized = normalizeConnection(parsed);
    if (!normalized) {
      window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
    return null;
  }
}

function getLegacyAuthToken(): string | null {
  if (!canUseWindow()) return null;
  const token = window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed || null;
}

function getDevelopmentConnection(): StoredConnection | null {
  if (!canUseWindow() || !isDevelopmentMode()) return null;
  const origin = getWindowOrigin();
  if (!origin) return null;
  const serverUrl = canonicalizeServerUrl(origin);
  return {
    version: 1,
    serverUrl,
    authToken: getLegacyAuthToken() ?? "",
  };
}

export function loadInitialConnection(): StoredConnection | null {
  const stored = getStoredConnection();
  if (stored) return stored;
  return getDevelopmentConnection();
}

export function getConnection(): StoredConnection | null {
  return getStoredConnection() ?? getDevelopmentConnection();
}

export function saveConnection(connection: Omit<StoredConnection, "version"> | StoredConnection): StoredConnection {
  const normalized = normalizeConnection({ ...connection, version: 1 });
  if (!normalized) {
    throw new Error("Connection is invalid");
  }

  if (canUseWindow()) {
    window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.setItem(LAST_SERVER_URL_STORAGE_KEY, normalized.serverUrl);
  }

  return normalized;
}

export function clearConnection(options?: { forgetServerUrl?: boolean }): void {
  if (!canUseWindow()) return;
  const current = getStoredConnection();
  if (!options?.forgetServerUrl && current) {
    window.localStorage.setItem(LAST_SERVER_URL_STORAGE_KEY, current.serverUrl);
  }
  if (options?.forgetServerUrl) {
    window.localStorage.removeItem(LAST_SERVER_URL_STORAGE_KEY);
  }
  window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
}

function getConnectionOrThrow(connection?: StoredConnection | null): StoredConnection {
  const active = connection ?? getConnection();
  if (!active) {
    throw new Error("No backend connection configured");
  }
  return active;
}

export function getApiBaseUrl(connection?: StoredConnection | null): string {
  return `${getConnectionOrThrow(connection).serverUrl}/api`;
}

function getWebSocketProtocol(serverUrl: string): "ws:" | "wss:" {
  const parsed = new URL(serverUrl);
  return parsed.protocol === "https:" ? "wss:" : "ws:";
}

export function getBrowserWebSocketUrl(sessionId: string, connection?: StoredConnection | null): string {
  const active = getConnectionOrThrow(connection);
  const parsed = new URL(active.serverUrl);
  return `${getWebSocketProtocol(active.serverUrl)}//${parsed.host}/ws/browser/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(active.authToken)}`;
}

export function getTerminalWebSocketUrl(terminalId: string, connection?: StoredConnection | null): string {
  const active = getConnectionOrThrow(connection);
  const parsed = new URL(active.serverUrl);
  return `${getWebSocketProtocol(active.serverUrl)}//${parsed.host}/ws/terminal/${encodeURIComponent(terminalId)}?token=${encodeURIComponent(active.authToken)}`;
}

export function buildBackendUrl(path: string, connection?: StoredConnection | null): string {
  return `${getConnectionOrThrow(connection).serverUrl}${path}`;
}

export function buildBootstrapUrl(frontendUrl: string, connection: Pick<StoredConnection, "serverUrl" | "authToken">): string {
  const url = new URL(frontendUrl);
  const params = new URLSearchParams({
    server: canonicalizeServerUrl(connection.serverUrl),
    token: connection.authToken.trim(),
  });
  url.hash = `/connect?${params.toString()}`;
  return url.toString();
}

export function canShowBrowserLocalLinks(connection?: StoredConnection | null): boolean {
  const active = connection ?? getConnection();
  if (!active) return false;
  try {
    const hostname = new URL(active.serverUrl).hostname;
    return isLoopbackHostname(hostname);
  } catch {
    return false;
  }
}
