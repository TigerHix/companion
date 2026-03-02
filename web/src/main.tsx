import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { AppErrorBoundary } from "./components/AppErrorBoundary.js";
import { bootstrapServiceWorker } from "./service-worker.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

// Production registers the app SW. Development actively unregisters any
// stale worker/caches so localhost does not get pinned to an old build.
void bootstrapServiceWorker().catch(() => {});
