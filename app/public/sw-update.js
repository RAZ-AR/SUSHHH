// Подключается в service worker (vite.config.ts → importScripts).
// Новая версия обычно ждёт команды: v2 включает её сама, когда ничего не записывает и не играет
// (v2/fresh.ts). Но старая версия («прибор») удалена, а у кого она ещё открыта или стоит на экране
// «Домой», та сама команду даст только по кнопке — и человек застрял бы в старом дизайне.
// Поэтому: если открытых страниц v2 нет — включаемся сразу; старая страница перезагрузится в овал.
self.addEventListener("install", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (!list.some((c) => new URL(c.url).pathname.includes("/v2/"))) return self.skipWaiting();
    }),
  );
});
