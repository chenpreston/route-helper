const CACHE_NAME = "route-helper-cache-v0.3.3"; // 更新缓存时修改版本号                               
const urlsToCache = [
  "/",
  "./index.html",
  "./style.css",
  "./script.js",
  "./leaflet.js",
  "./leaflet.css",
  "./stop.geojson",
  "./tauranga.geojson",
  "./images/bus.svg",
  "./images/busstop.svg",
  "./images/layers-2x.png",
  "./images/layers.png",
  "./images/marker-icon-2x.png",
  "./images/marker-icon.png",
  "./images/marker-shadow.png",
];

// 安装事件
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        console.log("route helper Opened cache:", CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch((error) => console.error("route helper Install failed:", error))
  );
});

// 获取事件
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // 缓存命中，直接返回
      if (response) {
        return response;
      }

      // 缓存未命中，发起网络请求
      return fetch(event.request)
        .then(function (networkResponse) {
          // 检查响应是否有效
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          // 克隆响应，因为响应流只能使用一次
          const responseToCache = networkResponse.clone();

          // 将新资源添加到缓存
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(function (error) {
          console.error("route helper Fetch failed:", error);
          // 可以返回一个 fallback 响应
          return new Response("Network error occurred", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

// 激活事件
self.addEventListener("activate", function (event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log("route helper Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
      .catch((error) => console.error("route helper Activation failed:", error))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
