// Service worker — INSTALL-ONLY, zero caching.
//
// Why so minimal: this site needs Cloudflare's COOP/COEP response headers to
// reach the browser on EVERY request so that SharedArrayBuffer (and thus the
// multithreaded ffmpeg.wasm core) stays available. A caching service worker
// that synthesizes Responses can silently drop those headers and break
// cross-origin isolation. So we deliberately do NOT cache anything and do NOT
// intercept/synthesize any response — we let every fetch go straight to the
// network exactly as the browser would without an SW.
//
// The SW exists only so the app is installable as a PWA (standalone icon,
// start_url /app/). It claims clients immediately and otherwise stays out of
// the way. Nothing about the video ever touches this file — compression
// happens in the page's own ffmpeg worker, fully in memory.

self.addEventListener("install", () => {
  // Activate this version immediately; no asset pre-cache.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of open clients so the PWA is controlled on first load.
  event.waitUntil(self.clients.claim());
});

// Intentionally NO "fetch" handler.
//
// With no fetch listener registered, the browser performs every request
// directly against the network/HTTP cache, preserving all Cloudflare-served
// headers (COOP/COEP/CORP) byte-for-byte. This is the safest possible SW for
// a cross-origin-isolated app: present enough to satisfy PWA install
// criteria, passive enough to never interfere with header delivery.
