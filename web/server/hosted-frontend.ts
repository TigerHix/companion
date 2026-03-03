import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, "..", "package.json");
const packageVersion: string = JSON.parse(readFileSync(packageJsonPath, "utf-8")).version;

export const DEFAULT_FRONTEND_URL = "https://moku.sh";

export interface HostedFrontendInfo {
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

export interface TailscaleServeInfo {
  available: boolean;
  backendUrl: string | null;
  error?: string;
}

function canonicalizeOrigin(value: string): string {
  return new URL(value.trim()).origin;
}

function getDevelopmentOrigins(): string[] {
  return [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://[::1]:5174",
  ];
}

export function getFrontendUrl(): string {
  const raw = process.env.MOKU_FRONTEND_URL?.trim();
  return raw ? canonicalizeOrigin(raw) : DEFAULT_FRONTEND_URL;
}

export function getAllowedWebOrigins(): string[] {
  const configured = process.env.MOKU_ALLOWED_WEB_ORIGINS?.trim();
  const base = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean).map((origin) => canonicalizeOrigin(origin))
    : [getFrontendUrl()];

  if (process.env.NODE_ENV !== "production") {
    return Array.from(new Set([...base, ...getDevelopmentOrigins()]));
  }

  return Array.from(new Set(base));
}

export function isAllowedWebOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const canonical = canonicalizeOrigin(origin);
    return getAllowedWebOrigins().includes(canonical);
  } catch {
    return false;
  }
}

export function parseTailscaleDnsName(statusJson: string): string | null {
  try {
    const parsed = JSON.parse(statusJson) as {
      Self?: {
        DNSName?: string;
      };
    };
    const dnsName = parsed.Self?.DNSName?.trim();
    if (!dnsName) return null;
    return dnsName.endsWith(".") ? dnsName.slice(0, -1) : dnsName;
  } catch {
    return null;
  }
}

function runTailscaleCommand(args: string[]): string {
  return execFileSync("tailscale", args, {
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

export function reconcileTailscaleServe(localPort: number): TailscaleServeInfo {
  try {
    const statusJson = runTailscaleCommand(["status", "--json"]);
    const dnsName = parseTailscaleDnsName(statusJson);
    if (!dnsName) {
      return {
        available: false,
        backendUrl: null,
        error: "Tailscale is running but did not report a node DNS name.",
      };
    }

    runTailscaleCommand(["serve", "--bg", "--yes", `http://127.0.0.1:${localPort}`]);
    return {
      available: true,
      backendUrl: `https://${dnsName}`,
    };
  } catch (error) {
    return {
      available: false,
      backendUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getHostedFrontendInfo(localPort: number, canonicalBackendUrl?: string | null): HostedFrontendInfo {
  const hosted = canonicalBackendUrl === undefined
    ? reconcileTailscaleServe(localPort)
    : {
      available: canonicalBackendUrl !== null,
      backendUrl: canonicalBackendUrl,
    };

  return {
    name: "Moku",
    backendVersion: packageVersion,
    authMode: "bearer_token",
    deploymentMode: "tailscale-hosted-frontend",
    frontendUrl: getFrontendUrl(),
    canonicalBackendUrl: hosted.available ? hosted.backendUrl : null,
    allowedWebOrigins: getAllowedWebOrigins(),
    capabilities: {
      clientQrBootstrap: true,
      inAppEditor: true,
      hostedFrontendOnly: true,
    },
  };
}

export function buildHostedConnectUrl(
  frontendUrl: string,
  backendUrl: string,
  authToken: string,
): string {
  const url = new URL(frontendUrl);
  const params = new URLSearchParams({
    server: backendUrl,
    token: authToken,
  });
  url.hash = `/connect?${params.toString()}`;
  return url.toString();
}
