const CACHE_NAME = "ai-chart-v1";

const urlsToCache = [
  "./",
  "./ima.html",
  "./manifest.json",
  "./js/",
  "./generated/",
  "./final_json/"
];

// インストール
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// リクエスト時
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});