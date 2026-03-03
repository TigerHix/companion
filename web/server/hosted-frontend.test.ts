import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFileSync = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFileSync: mockExecFileSync,
}));

import {
  buildHostedConnectUrl,
  getAllowedWebOrigins,
  getHostedFrontendInfo,
  getFrontendUrl,
  parseTailscaleDnsName,
  reconcileTailscaleServe,
} from "./hosted-frontend.js";

describe("hosted-frontend", () => {
  const originalEnv = {
    MOKU_FRONTEND_URL: process.env.MOKU_FRONTEND_URL,
    MOKU_ALLOWED_WEB_ORIGINS: process.env.MOKU_ALLOWED_WEB_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    if (originalEnv.MOKU_FRONTEND_URL === undefined) delete process.env.MOKU_FRONTEND_URL;
    else process.env.MOKU_FRONTEND_URL = originalEnv.MOKU_FRONTEND_URL;
    if (originalEnv.MOKU_ALLOWED_WEB_ORIGINS === undefined) delete process.env.MOKU_ALLOWED_WEB_ORIGINS;
    else process.env.MOKU_ALLOWED_WEB_ORIGINS = originalEnv.MOKU_ALLOWED_WEB_ORIGINS;
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;
  });

  it("uses the hosted frontend default and local dev origins when no overrides are configured", () => {
    // This keeps local development working while production still defaults to the hosted frontend origin.
    delete process.env.MOKU_FRONTEND_URL;
    delete process.env.MOKU_ALLOWED_WEB_ORIGINS;
    process.env.NODE_ENV = "test";

    expect(getFrontendUrl()).toBe("https://moku.sh");
    expect(getAllowedWebOrigins()).toEqual([
      "https://moku.sh",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://[::1]:5174",
    ]);
  });

  it("normalizes a configured allowlist and ignores blank entries", () => {
    // This validates the explicit CORS contract so operator-provided origin lists stay canonical.
    process.env.MOKU_ALLOWED_WEB_ORIGINS = " https://moku.sh/ , https://app.example.com ,, https://moku.sh ";
    process.env.NODE_ENV = "production";

    expect(getAllowedWebOrigins()).toEqual([
      "https://moku.sh",
      "https://app.example.com",
    ]);
  });

  it("parses the tailscale DNS name and strips the trailing dot", () => {
    // Tailscale reports the node name with a trailing dot; the browser-facing URL must not keep it.
    expect(parseTailscaleDnsName(JSON.stringify({
      Self: {
        DNSName: "backend-name.tailnet.ts.net.",
      },
    }))).toBe("backend-name.tailnet.ts.net");
  });

  it("reconciles tailscale serve and returns the canonical backend URL", () => {
    // This covers the intended startup flow: discover the node DNS name, then publish Bun at the HTTPS root.
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({
        Self: {
          DNSName: "backend-name.tailnet.ts.net.",
        },
      }))
      .mockReturnValueOnce("");

    expect(reconcileTailscaleServe(3456)).toEqual({
      available: true,
      backendUrl: "https://backend-name.tailnet.ts.net",
    });
    expect(mockExecFileSync).toHaveBeenNthCalledWith(1, "tailscale", ["status", "--json"], expect.any(Object));
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      2,
      "tailscale",
      ["serve", "--bg", "--yes", "http://127.0.0.1:3456"],
      expect.any(Object),
    );
  });

  it("does not rerun tailscale discovery when hosted mode is already known to be unavailable", () => {
    // The server caches startup discovery; the public info endpoint should reuse that result instead of shelling out again.
    const info = getHostedFrontendInfo(3456, null);

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(info.canonicalBackendUrl).toBeNull();
    expect(info.deploymentMode).toBe("tailscale-hosted-frontend");
  });

  it("builds connect URLs in the fragment so the token never hits the static host", () => {
    // Bootstrap data belongs in the hash route, not the query string, to avoid leaking tokens to frontend hosting logs.
    expect(buildHostedConnectUrl(
      "https://moku.sh",
      "https://backend-name.tailnet.ts.net",
      "secret-token",
    )).toBe(
      "https://moku.sh/#/connect?server=https%3A%2F%2Fbackend-name.tailnet.ts.net&token=secret-token",
    );
  });
});
