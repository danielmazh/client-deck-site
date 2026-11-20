/* client-deck service worker: precache everything (the payload stays encrypted), serve cache first, work offline. */
const VERSION = "51193fd635ff";
const FILES = ["./","index.html","app.css","app.js","payload.bin","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","favicon.svg","fonts/ibm-plex-mono-latin-500-normal.woff2","fonts/ibm-plex-mono-latin-600-normal.woff2","fonts/ibm-plex-sans-hebrew-hebrew-400-normal.woff2","fonts/ibm-plex-sans-hebrew-hebrew-500-normal.woff2","fonts/ibm-plex-sans-hebrew-hebrew-600-normal.woff2","fonts/ibm-plex-sans-hebrew-hebrew-700-normal.woff2","fonts/ibm-plex-sans-hebrew-latin-400-normal.woff2","fonts/ibm-plex-sans-hebrew-latin-500-normal.woff2","fonts/ibm-plex-sans-hebrew-latin-600-normal.woff2","fonts/ibm-plex-sans-hebrew-latin-700-normal.woff2"];
const CACHE = "client-deck-" + VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("client-deck-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // offers under /o/ are separate pages, never served from the deck cache
  if (new URL(req.url).pathname.includes("/o/")) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const url = new URL(req.url);
      url.search = "";
      const hit = await c.match(req.mode === "navigate" ? new URL("./", self.registration.scope).href : url.href);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        return res;
      } catch (err) {
        if (req.mode === "navigate") return c.match(new URL("./", self.registration.scope).href);
        throw err;
      }
    })
  );
});
