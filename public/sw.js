/*
 * Minimal service worker for Homemade Uno.
 *
 * Purpose: enable PWA installability and give the app shell an offline-ready
 * cache. Intentionally small — the full app is server-authoritative and needs
 * the network to play, so this only precaches the shell and serves navigations
 * with a network-first / cache-fallback strategy.
 *
 * Registered from src/main.tsx (production builds only) so it never interferes
 * with Vite's dev HMR. Bump CACHE_VERSION to invalidate old caches.
 */
const CACHE_VERSION = "uno-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GETs; let everything else (Supabase, fonts, POSTs)
  // hit the network untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first so players always get the latest app, falling
  // back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html"))),
    );
    return;
  }

  // Other same-origin GETs (assets, icon): cache-first with a network fill.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});
