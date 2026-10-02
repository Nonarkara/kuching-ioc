// Deliberately do not cache data, tiles, or the dashboard shell. Municipal
// observations must retain the existing loader's source and freshness rules.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kuching IOC · Offline</title><body style="font:18px/1.6 Helvetica,Arial,sans-serif;padding:24px;background:#f6f5f2;color:#2f4961"><h1>Kuching IOC</h1><p>You are offline. Reconnect to view the dashboard and check observation times.</p><p lang="ms">Anda di luar talian. Sambung semula internet untuk melihat papan pemuka dan menyemak masa pemerhatian.</p><p lang="zh-Hans">当前离线。请重新连接互联网，查看仪表板并检查观测时间。</p><a href="/">Try again · Cuba lagi · 重试</a></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});
