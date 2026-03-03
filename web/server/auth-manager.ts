import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const AUTH_FILE = join(homedir(), ".moku", "auth.json");
const TOKEN_BYTES = 32; // 64 hex characters

interface AuthData {
  token: string;
  createdAt: number;
}

let cachedToken: string | null = null;

/**
 * Get the auth token. Priority:
 * 1. MOKU_AUTH_TOKEN env var
 * 2. Persisted token from ~/.moku/auth.json
 * 3. Auto-generate and persist a new token
 */
export function getToken(): string {
  // Env var override (always takes priority)
  const envToken = process.env.MOKU_AUTH_TOKEN;
  if (envToken && envToken.trim()) {
    cachedToken = envToken.trim();
    return cachedToken;
  }

  // Return cached token if available
  if (cachedToken) return cachedToken;

  // Try reading from file
  try {
    if (existsSync(AUTH_FILE)) {
      const raw = readFileSync(AUTH_FILE, "utf-8");
      const data = JSON.parse(raw) as Partial<AuthData>;
      if (typeof data.token === "string" && data.token.length >= 32) {
        cachedToken = data.token;
        return cachedToken;
      }
    }
  } catch {
    // File corrupt or unreadable — generate new
  }

  // Generate new token
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const data: AuthData = { token, createdAt: Date.now() };
  try {
    mkdirSync(dirname(AUTH_FILE), { recursive: true });
    writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error("[auth] Failed to persist auth token:", err);
  }
  cachedToken = token;
  return token;
}

/**
 * Verify a candidate token using constant-time comparison.
 */
export function verifyToken(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const expected = getToken();
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);
  if (candidateBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(candidateBuf, expectedBuf);
}

/**
 * Regenerate the auth token — creates a new random token, persists it,
 * and returns the new value.  Existing sessions using the old token will
 * be invalidated on their next request.
 */
export function regenerateToken(): string {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const data: AuthData = { token, createdAt: Date.now() };
  try {
    mkdirSync(dirname(AUTH_FILE), { recursive: true });
    writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error("[auth] Failed to persist regenerated token:", err);
  }
  cachedToken = token;
  return token;
}

/** Reset cached state — for testing only */
export function _resetForTest(): void {
  cachedToken = null;
}
