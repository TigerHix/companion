import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  DEFAULT_MOKU_CODEX_HOME,
  getLegacyCodexHome,
  resolveMokuCodexHome,
  resolveMokuCodexSessionHome,
} from "./codex-home.js";

describe("codex-home", () => {
  it("DEFAULT_MOKU_CODEX_HOME points to ~/.moku/codex-home", () => {
    expect(DEFAULT_MOKU_CODEX_HOME).toBe(
      join(homedir(), ".moku", "codex-home"),
    );
  });

  it("getLegacyCodexHome returns ~/.codex", () => {
    expect(getLegacyCodexHome()).toBe(join(homedir(), ".codex"));
  });

  it("resolveMokuCodexHome returns default when no explicit path given", () => {
    expect(resolveMokuCodexHome()).toBe(DEFAULT_MOKU_CODEX_HOME);
  });

  it("resolveMokuCodexHome uses explicit path when provided", () => {
    const custom = "/tmp/my-codex-home";
    expect(resolveMokuCodexHome(custom)).toBe(custom);
  });

  // Regression: resolveMokuCodexHome must NOT read process.env.CODEX_HOME
  // because that points to the user's global ~/.codex and would break per-session isolation.
  it("resolveMokuCodexHome ignores process.env.CODEX_HOME", () => {
    const original = process.env.CODEX_HOME;
    try {
      process.env.CODEX_HOME = "/tmp/global-codex";
      expect(resolveMokuCodexHome()).toBe(DEFAULT_MOKU_CODEX_HOME);
    } finally {
      if (original === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = original;
      }
    }
  });

  it("resolveMokuCodexSessionHome appends sessionId to base", () => {
    const sessionId = "abc-123";
    expect(resolveMokuCodexSessionHome(sessionId)).toBe(
      join(DEFAULT_MOKU_CODEX_HOME, sessionId),
    );
  });

  it("resolveMokuCodexSessionHome uses explicit path", () => {
    const custom = "/tmp/my-codex-home";
    const sessionId = "xyz-789";
    expect(resolveMokuCodexSessionHome(sessionId, custom)).toBe(
      join(custom, sessionId),
    );
  });
});
