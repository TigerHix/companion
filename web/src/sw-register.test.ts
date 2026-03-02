/**
 * @vitest-environment jsdom
 *
 * Tests for the Service Worker registration module.
 *
 * Validates that:
 * - registerSW is called with the correct callbacks
 * - Registrations are checked immediately and on a short cadence
 * - Focus / visibility changes trigger update checks
 * - Missing registration (undefined) is handled gracefully
 * - The offline-ready callback logs a message
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Mock the virtual:pwa-register module before importing sw-register
const mockRegisterSW: ReturnType<typeof vi.fn<AnyFn>> = vi.fn(() => vi.fn());
vi.mock("virtual:pwa-register", () => ({
  registerSW: mockRegisterSW,
}));

describe("sw-register", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRegisterSW.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls registerSW with immediate registration and callbacks", async () => {
    const { registerAppServiceWorker } = await import("./sw-register.js");
    registerAppServiceWorker();

    expect(mockRegisterSW).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = mockRegisterSW.mock.calls[0]![0] as any;
    expect(config.immediate).toBe(true);
    expect(config).toHaveProperty("onRegisteredSW");
    expect(config).toHaveProperty("onOfflineReady");
    expect(config).toHaveProperty("onRegisterError");
    expect(typeof config.onRegisteredSW).toBe("function");
    expect(typeof config.onOfflineReady).toBe("function");
  });

  it("checks for updates on an interval and when the page regains attention", async () => {
    const { attachServiceWorkerUpdateChecks, SW_UPDATE_INTERVAL_MS } = await import("./sw-register.js");
    const mockRegistration = { update: vi.fn() };
    const cleanup = attachServiceWorkerUpdateChecks(mockRegistration);

    expect(mockRegistration.update).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS);
    expect(mockRegistration.update).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("focus"));
    expect(mockRegistration.update).toHaveBeenCalledTimes(3);

    let visibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockRegistration.update).toHaveBeenCalledTimes(3);

    visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockRegistration.update).toHaveBeenCalledTimes(4);

    cleanup();
  });

  it("handles missing registration gracefully", async () => {
    const { registerAppServiceWorker } = await import("./sw-register.js");
    registerAppServiceWorker();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = mockRegisterSW.mock.calls[0]![0] as any;
    // Calling with undefined registration should not throw
    expect(() => config.onRegisteredSW("/sw.js", undefined)).not.toThrow();
  });

  it("logs offline-ready message", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { registerAppServiceWorker } = await import("./sw-register.js");
    registerAppServiceWorker();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = mockRegisterSW.mock.calls[0]![0] as any;
    config.onOfflineReady();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Offline-ready"),
    );
  });
});
