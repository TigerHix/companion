/**
 * Service Worker registration for production builds.
 *
 * Uses vite-plugin-pwa's autoUpdate mode: when a new SW is detected,
 * it downloads, installs, and activates immediately (skipWaiting + clientsClaim).
 *
 * In dev mode the virtual:pwa-register module is a no-op, so importing
 * this file has no effect during development.
 *
 * Edge cases:
 * - Multiple tabs: skipWaiting activates the new SW across all tabs immediately.
 *   WebSocket connections are unaffected (SW never intercepts /ws/* routes).
 * - First-time visitors: app loads from network; SW installs in background.
 * - SW update during active session: only static assets are cached. API calls
 *   and WebSocket connections go directly to network.
 */
import { registerSW } from "virtual:pwa-register";

export const SW_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function attachServiceWorkerUpdateChecks(
  registration: Pick<ServiceWorkerRegistration, "update">,
  win: Pick<Window, "addEventListener" | "clearInterval" | "removeEventListener" | "setInterval"> = window,
  doc: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState"> = document,
) {
  const updateRegistration = () => {
    void Promise.resolve(registration.update()).catch(() => {});
  };

  updateRegistration();

  const intervalId = win.setInterval(updateRegistration, SW_UPDATE_INTERVAL_MS);
  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") {
      updateRegistration();
    }
  };

  win.addEventListener("focus", updateRegistration);
  doc.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    win.clearInterval(intervalId);
    win.removeEventListener("focus", updateRegistration);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

let stopUpdateChecks: (() => void) | null = null;

export function registerAppServiceWorker() {
  return registerSW({
    immediate: true,
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) {
        return;
      }

      stopUpdateChecks?.();
      stopUpdateChecks = attachServiceWorkerUpdateChecks(registration);
    },
    onOfflineReady() {
      console.log("[SW] Offline-ready: app shell cached");
    },
    onRegisterError(error: unknown) {
      console.error("[SW] Registration failed", error);
    },
  });
}
