// @vitest-environment jsdom

/**
 * Tests for the service worker bootstrap helpers.
 *
 * Validates that:
 * - dev mode unregisters stale service workers and clears CacheStorage
 * - production delegates to the registration flow without touching dev cleanup
 */
import { describe, expect, it, vi } from "vitest";

describe("service-worker bootstrap", () => {
  it("cleans up stale dev workers and caches", async () => {
    const registrations = [
      { unregister: vi.fn().mockResolvedValue(true) },
      { unregister: vi.fn().mockResolvedValue(true) },
    ];
    const cacheStorage = {
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue(["workbox-precache-v1", "companion-navigation"]),
    };

    const { cleanupDevOfflineState } = await import("./service-worker.js");
    const result = await cleanupDevOfflineState(
      {
        getRegistrations: vi.fn().mockResolvedValue(registrations),
      },
      cacheStorage,
    );

    expect(result).toEqual({ deletedCaches: 2, unregistered: 2 });
    expect(registrations[0]!.unregister).toHaveBeenCalledOnce();
    expect(registrations[1]!.unregister).toHaveBeenCalledOnce();
    expect(cacheStorage.keys).toHaveBeenCalledOnce();
    expect(cacheStorage.delete).toHaveBeenCalledTimes(2);
  });

  it("registers the production worker without dev cleanup", async () => {
    const registerProductionServiceWorker = vi.fn().mockResolvedValue(undefined);
    const getRegistrations = vi.fn();

    const { bootstrapServiceWorker } = await import("./service-worker.js");
    const result = await bootstrapServiceWorker({
      isProd: true,
      registerProductionServiceWorker,
      serviceWorkerContainer: {
        getRegistrations,
      },
    });

    expect(result).toBe("registered");
    expect(registerProductionServiceWorker).toHaveBeenCalledOnce();
    expect(getRegistrations).not.toHaveBeenCalled();
  });
});
