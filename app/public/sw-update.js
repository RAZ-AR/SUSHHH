// Подключается в service worker (vite.config.ts → importScripts).
// Новая версия обычно ждёт команды: приложение включает её само, когда ничего не записывает и не
// играет (v2/fresh.ts). Но у кого ещё открыта удалённая старая версия («прибор»), та команду даст
// только по своей кнопке — и человек застрял бы в старом дизайне.
// Поэтому при установке спрашиваем открытые страницы «вы приложение?». Ответило хоть одно (или
// открыта страница с прежнего адреса /v2/, где отвечать ещё не умели) — ждём его команды.
// Не ответил никто — включаемся сразу, и старая страница сама перезагрузится в овал.
const ASK_MS = 1000;

function isApp(client) {
  if (new URL(client.url).pathname.includes("/v2/")) return Promise.resolve(true);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(false), ASK_MS);
    ch.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    client.postMessage({ type: "sushhh:app?" }, [ch.port2]);
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      const answers = await Promise.all(list.map(isApp));
      if (!answers.some(Boolean)) return self.skipWaiting();
    }),
  );
});
