/* Distribution Prime PWA — required for Chrome/Edge “Install app” prompt */
const CACHE_NAME = "distribution-prime-v4";
const PRECACHE = ["/index.html", "/manifest.json", "/distribution-prime-icon-512.png", "/distribution-prime-icon.svg", "/login"];

function isLegalPagePath(path) {
  const p = String(path || "").replace(/\/$/, "");
  return (
    p === "/legal/privacy-policy" ||
    p === "/legal/terms-of-service" ||
    p === "/privacy-policy" ||
    p === "/terms-of-service" ||
    p.endsWith("/legal/privacy-policy.html") ||
    p.endsWith("/legal/terms-of-service.html") ||
    p.endsWith("/privacy-policy.html") ||
    p.endsWith("/terms-of-service.html")
  );
}

async function fetchLegalPage(request, path) {
  const candidates = [path];
  const normalized = path.replace(/\/$/, "");
  if (!normalized.endsWith(".html")) {
    candidates.push(`${normalized}.html`);
    candidates.push(`${normalized}/index.html`);
  }
  for (const target of candidates) {
    try {
      const url = new URL(target, request.url);
      const response = await fetch(url.toString(), { credentials: "same-origin" });
      if (response && response.ok) return response;
    } catch {
      /* try next */
    }
  }
  return fetch(request);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE).catch((err) => {
        console.warn("PWA precache partial failure:", err);
      })
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  if (isLegalPagePath(path)) {
    event.respondWith(fetchLegalPage(event.request, path));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match(event.request).then((r) => r || caches.match("/index.html"));
        }
        return caches.match(event.request);
      })
  );
});
