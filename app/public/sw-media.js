// Подключается в service worker (vite.config.ts → importScripts), раньше маршрутов Workbox.
// Демо-голоса (seed/*.m4a) лежат в кэше установки целиком. Плеер <audio> просит их кусками
// (заголовок Range), а кэш установки на это отвечает всем файлом. Chrome такое терпит, Safari на
// iPhone — нет: голос «не загружается». Отвечаем нужным куском из того же кэша (206 Partial Content).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const range = req.headers.get("range");
  if (!range || req.method !== "GET" || !/\/seed\/[^/]+\.m4a$/.test(new URL(req.url).pathname)) return;
  event.respondWith(
    (async () => {
      // в кэше установки адрес хранится с ?__WB_REVISION__=…
      const hit = await caches.match(req.url, { ignoreSearch: true });
      if (!hit) return fetch(req);
      const body = await hit.arrayBuffer();
      const size = body.byteLength;
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      let start = 0;
      let end = size - 1;
      if (m && m[1]) {
        start = Number(m[1]);
        if (m[2]) end = Math.min(Number(m[2]), size - 1);
      } else if (m && m[2]) {
        start = Math.max(0, size - Number(m[2])); // bytes=-N — последние N байт
      }
      if (!m || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": hit.headers.get("Content-Type") || "audio/mp4",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
        },
      });
    })(),
  );
});
