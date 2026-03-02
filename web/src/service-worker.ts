type ServiceWorkerRegistrationLike = Pick<ServiceWorkerRegistration, "unregister">;
type ServiceWorkerContainerLike = Pick<ServiceWorkerContainer, "getRegistrations">;
type CacheStorageLike = Pick<CacheStorage, "keys" | "delete">;

interface BootstrapOptions {
  cacheStorage?: CacheStorageLike;
  isProd?: boolean;
  registerProductionServiceWorker?: () => Promise<unknown> | unknown;
  serviceWorkerContainer?: ServiceWorkerContainerLike;
}

export async function cleanupDevOfflineState(
  serviceWorkerContainer?: ServiceWorkerContainerLike,
  cacheStorage?: CacheStorageLike,
) {
  if (!serviceWorkerContainer) {
    return { deletedCaches: 0, unregistered: 0 };
  }

  const registrations = await serviceWorkerContainer.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (!cacheStorage) {
    return { deletedCaches: 0, unregistered: registrations.length };
  }

  const cacheNames = await cacheStorage.keys();
  await Promise.all(cacheNames.map((cacheName) => cacheStorage.delete(cacheName)));

  return { deletedCaches: cacheNames.length, unregistered: registrations.length };
}

export async function registerProductionServiceWorker() {
  const { registerAppServiceWorker } = await import("./sw-register.js");
  return registerAppServiceWorker();
}

export async function bootstrapServiceWorker(options: BootstrapOptions = {}) {
  const {
    cacheStorage = typeof caches === "undefined" ? undefined : caches,
    isProd = import.meta.env.PROD,
    registerProductionServiceWorker: registerProduction = registerProductionServiceWorker,
    serviceWorkerContainer = typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : undefined,
  } = options;

  if (isProd) {
    await registerProduction();
    return "registered";
  }

  await cleanupDevOfflineState(serviceWorkerContainer, cacheStorage);
  return "cleaned";
}
