import { App } from "@/App";
import "@/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * PWA bootstrap: register the service worker for installability.
 *
 * Guarded so it never runs in dev (where it would fight Vite's HMR) — only
 * production builds register, and only after `load` so registration doesn't
 * compete with initial render. The manifest itself is linked from index.html.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
