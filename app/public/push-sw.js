// Уведомления «Тебе ответили голосом». Подключается в сгенерированный service worker через
// workbox.importScripts (vite.config.ts). Касание уведомления открывает ветку этого голоса в v2.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "SUSHHH", {
      body: data.body || "",
      icon: "pwa-192x192.png",
      badge: "pwa-64x64.png",
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "v2/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "v2/", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.includes("/v2/"));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
