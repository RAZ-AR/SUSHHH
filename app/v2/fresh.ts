// Свежая версия. Service worker у сайта общий со старой версией: новая версия скачивается, но ждёт
// разрешения включиться (так задумано для v1 — чтобы обновление не оборвало запись). v2 этого
// разрешения раньше никогда не давала, и с экрана «Домой» открывалась старая v2 из кэша — навсегда.
// Теперь v2 включает новую версию сама: при запуске сразу, а позже — когда ничего не записывается
// и не звучит, или когда приложение ушло в фон. Страница перезагружается уже с новой версией.

export function keepFresh(busy: () => boolean) {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  const hadController = !!sw.controller; // при первой установке перезагружаться не нужно
  let reloading = false;
  sw.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  void sw.getRegistration().then((reg) => {
    if (!reg) return;
    const activate = (force = false) => {
      const next = reg.waiting;
      if (!next) return;
      if (!force && busy()) return void setTimeout(() => activate(), 5000); // запись или голос звучит — подождём
      next.postMessage({ type: "SKIP_WAITING" });
    };
    activate(); // при запуске человек ещё ничего не начал — включаем сразу
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => nw.state === "installed" && activate());
    });
    // ушли в фон — самое незаметное время для обновления (если не идёт запись)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") activate(!busy());
      else void reg.update().catch(() => {});
    });
    setInterval(() => void reg.update().catch(() => {}), 30 * 60 * 1000);
  });
}
