/*
 * Offline, and nothing else.
 *
 * This app is local-first: the data never leaves the device, and needing a
 * network to reach your own term is the one thing that could stop you opening
 * it on a bus. So the shell is cached and served when the network is not
 * there.
 *
 * It deliberately does NOT do push. Push needs a server to push from and this
 * app has none on purpose — the reminders are a timer in an open tab, and no
 * service worker changes that.
 */

const CACHE = "steady-v1";

/*
 * Navigations go to the network first and fall back to the cache. That way a
 * new build is picked up on the next load rather than being shadowed by a
 * stale page for ever, which is the classic way an offline app breaks.
 */
async function navigate(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const home = await caches.match("/");
    if (home) return home;
    throw new Error("offline and nothing cached");
  }
}

/*
 * Everything else — the hashed build assets, the fonts — is content-addressed,
 * so a cache hit is always correct and revalidating in the background keeps
 * the next visit current.
 */
async function asset(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only plain GETs over http(s). Anything else is left entirely alone.
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (/\/_next\/static\//.test(request.url) || /\.(png|svg|webmanifest|woff2?)$/.test(request.url)) {
    event.respondWith(asset(request));
  }
});
