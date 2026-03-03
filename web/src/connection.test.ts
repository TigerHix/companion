// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONNECTION_STORAGE_KEY,
  LAST_SERVER_URL_STORAGE_KEY,
  buildBootstrapUrl,
  canShowBrowserLocalLinks,
  canonicalizeServerUrl,
  clearConnection,
  getApiBaseUrl,
  getBrowserWebSocketUrl,
  getRememberedServerUrl,
  getTerminalWebSocketUrl,
  saveConnection,
} from "./connection.js";

describe("connection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("canonicalizes server URLs to origins without trailing slashes or paths", () => {
    expect(canonicalizeServerUrl(" https://backend.example.ts.net/app/ ")).toBe(
      "https://backend.example.ts.net",
    );
    expect(canonicalizeServerUrl("https://backend.example.ts.net:4443/")).toBe(
      "https://backend.example.ts.net:4443",
    );
  });

  it("rejects insecure non-local production URLs", () => {
    expect(() => canonicalizeServerUrl("http://backend.example.ts.net")).toThrow(
      "Production backends must use https://",
    );
  });

  it("allows localhost http URLs for local workflows", () => {
    expect(canonicalizeServerUrl("http://localhost:3457/")).toBe("http://localhost:3457");
  });

  it("persists connections and remembers the backend URL", () => {
    const connection = saveConnection({
      serverUrl: "https://backend.example.ts.net/",
      authToken: "test-token",
    });

    expect(connection).toEqual({
      version: 1,
      serverUrl: "https://backend.example.ts.net",
      authToken: "test-token",
    });
    expect(JSON.parse(localStorage.getItem(CONNECTION_STORAGE_KEY) || "{}")).toEqual(connection);
    expect(localStorage.getItem(LAST_SERVER_URL_STORAGE_KEY)).toBe(
      "https://backend.example.ts.net",
    );
  });

  it("preserves the last backend URL on implicit logout", () => {
    saveConnection({
      serverUrl: "https://backend.example.ts.net",
      authToken: "token",
    });

    clearConnection();

    expect(localStorage.getItem(CONNECTION_STORAGE_KEY)).toBeNull();
    expect(getRememberedServerUrl()).toBe("https://backend.example.ts.net");
  });

  it("forgets the backend URL on explicit disconnect", () => {
    saveConnection({
      serverUrl: "https://backend.example.ts.net",
      authToken: "token",
    });

    clearConnection({ forgetServerUrl: true });

    expect(localStorage.getItem(CONNECTION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_SERVER_URL_STORAGE_KEY)).toBeNull();
  });

  it("derives API and WebSocket URLs from the saved backend origin", () => {
    const connection = saveConnection({
      serverUrl: "https://backend.example.ts.net",
      authToken: "secret token",
    });

    expect(getApiBaseUrl(connection)).toBe("https://backend.example.ts.net/api");
    expect(getBrowserWebSocketUrl("session-1", connection)).toBe(
      "wss://backend.example.ts.net/ws/browser/session-1?token=secret%20token",
    );
    expect(getTerminalWebSocketUrl("terminal-1", connection)).toBe(
      "wss://backend.example.ts.net/ws/terminal/terminal-1?token=secret%20token",
    );
  });

  it("builds hosted connect URLs in the hash fragment", () => {
    const url = buildBootstrapUrl("https://moku.sh", {
      serverUrl: "https://backend.example.ts.net",
      authToken: "secret token",
    });

    expect(url).toBe(
      "https://moku.sh/#/connect?server=https%3A%2F%2Fbackend.example.ts.net&token=secret+token",
    );
  });

  it("only allows localhost browser links for local backends", () => {
    expect(canShowBrowserLocalLinks({
      version: 1,
      serverUrl: "http://localhost:3457",
      authToken: "",
    })).toBe(true);

    expect(canShowBrowserLocalLinks({
      version: 1,
      serverUrl: "https://backend.example.ts.net",
      authToken: "token",
    })).toBe(false);
  });
});
