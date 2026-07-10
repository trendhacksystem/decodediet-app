// 最小構成のService Worker（インストール可能条件を満たすため）
// キャッシュは持たず常にネットワークへ（更新が即反映されるように）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => new Response("オフラインです", { status: 503 })));
});
