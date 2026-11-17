import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource-variable/inter";
import "./index.css";

import { startAppServices } from "./appInit";
import { AppRoot } from "./AppRoot";
import { whenLocaleReady } from "./i18n/runtime";
import { reloadOnceForChunkLoadError } from "./lib/chunkReloadGuard";

const router = startAppServices();

let reloadScheduled = false;
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForChunkLoadError()) {
    reloadScheduled = true;
    event.preventDefault();
  }
});

const app = <AppRoot router={router} />;

// The index.html boot splash lives inside #root, and React's first commit
// clears it. Resolve everything that first commit needs, the initial route's
// split chunks, before rendering, so the splash holds until real UI paints
// instead of dropping to a blank window while chunks download.
export const startup = router
  .load()
  // Chained so settings have usually hydrated; English resolves without a chunk load.
  .then(whenLocaleReady)
  .then(() => {
    // A route chunk failure still resolves router.load(): the error is parked in
    // the lazy component and surfaces through the route error boundary.
    if (reloadScheduled) return;
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>{app}</React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    if (reloadScheduled) return;
    throw error;
  });
