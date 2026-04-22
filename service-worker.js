const CACHE_NAME = "ai-chart-v3";

const urlsToCache = [
  "/ai-chart/",
  "/ai-chart/index.html",
  "/ai-chart/ima.html",
  "/ai-chart/manifest.json",
  "/ai-chart/icon.png"
];

// インストール時：キャッシュする
self.addEventListener("install", (event) => {
  console.log("SW install");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 有効化：古いキャッシュ削除
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

  self.clients.claim();
});

// fetch：キャッシュ優先 + ネット更新
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((res) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      );
    })
  );
});