/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Activate updates immediately so old cached shells do not linger across tabs.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const appShellFallback = createHandlerBoundToURL("index.html");
const navigationStrategy = new NetworkFirst({
  cacheName: "moku-navigation",
  networkTimeoutSeconds: 3,
});

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly(),
  "GET",
);

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate"
    && !url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/ws/"),
  async ({ event, request, url }) => {
    try {
      const response = await navigationStrategy.handle({ event, request });
      if (response) {
        return response;
      }
    } catch {
      // Fall back to the precached app shell when offline or when the server
      // is unreachable, but prefer fresh HTML whenever the network works.
    }

    return appShellFallback({ event, request, url });
  },
);
