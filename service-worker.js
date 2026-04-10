const CACHE_NAME = "ai-chart-v2"; // ←バージョン変えると強制更新

const urlsToCache = [
  "./",
  "./index.html",
  "./ima.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  console.log("SW install");
  self.skipWaiting(); // 即更新
});

self.addEventListener("activate", (event) => {
  console.log("SW activate");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim(); // 即反映
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});