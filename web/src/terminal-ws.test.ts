// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./connection.js", () => ({
  getTerminalWebSocketUrl: vi.fn(() => "wss://backend.example.ts.net/ws/terminal/term-1?token=test-token"),
}));

const mockSend = vi.fn();
const mockClose = vi.fn();
const mockWebSocketConstructor = vi.fn().mockImplementation(function MockSocket(this: {
  binaryType: string;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send: typeof mockSend;
  close: typeof mockClose;
}) {
  this.binaryType = "";
  this.readyState = 1;
  this.onopen = null;
  this.onmessage = null;
  this.onerror = null;
  this.onclose = null;
  this.send = mockSend;
  this.close = mockClose;
});

vi.stubGlobal("WebSocket", mockWebSocketConstructor as unknown as typeof WebSocket);
(globalThis.WebSocket as typeof WebSocket & { OPEN: number }).OPEN = 1;

import { createTerminalConnection } from "./terminal-ws.js";

describe("createTerminalConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects using the configured backend WebSocket URL", () => {
    const connection = createTerminalConnection("term-1", {
      onData: vi.fn(),
      onExit: vi.fn(),
    });

    expect(mockWebSocketConstructor).toHaveBeenCalledWith(
      "wss://backend.example.ts.net/ws/terminal/term-1?token=test-token",
    );
    connection.disconnect();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
