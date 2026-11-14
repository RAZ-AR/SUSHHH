// Свежая версия. Service worker сайта (Workbox) ставит новую версию, но включает её только по
// команде — чтобы обновление не оборвало запись. Раньше его регистрировала старая версия («прибор»,
// удалена), теперь — сама v2. Новую версию v2 включает сама: при запуске сразу, а позже — когда
// ничего не записывается и не звучит, или когда приложение ушло в фон. Страница перезагружается уже с новой версией.
//
// Осторожно с тремя вещами:
// - без сети не включаем: версии до 14.11.2026 не хранили страницу v2, и перезагрузка открыла бы пустоту;
// - перезагружаемся, только когда страница не занята — даже если включила версию другая вкладка;
// - у кого ещё открыта старая версия, тот перейдёт на v2 после её кнопки «обновить» или перезапуска.

export function keepFresh(busy: () => boolean) {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  // в разработке service worker не собирается — регистрировать нечего
  const base = import.meta.env.BASE_URL;
  const registered = import.meta.env.PROD ? sw.register(`${base}sw.js`, { scope: base }).catch(() => sw.getRegistration()) : sw.getRegistration();
  let controlled = !!sw.controller; // самая первая установка — не повод перезагружаться
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    if (busy() || !navigator.onLine) return void setTimeout(reload, 3000); // занято или нет сети — позже
    reloading = true;
    location.reload();
  };
  sw.addEventListener("controllerchange", () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    reload();
  });

  void registered.then(async (reg) => {
    if (!reg) return;
    const activate = async (force = false) => {
      const next = reg.waiting;
      if (!next) return;
      if (!navigator.onLine || (!force && busy())) return void setTimeout(() => void activate(), 5000);
      next.postMessage({ type: "SKIP_WAITING" });
    };
    // новая версия могла уже ставиться или поставиться, пока мы подписывались
    const watch = (w: ServiceWorker | null) => w?.addEventListener("statechange", () => w.state === "installed" && void activate());
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    await activate(); // при запуске человек ещё ничего не начал — включаем сразу
    // ушли в фон — самое незаметное время для обновления (если не идёт запись)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void activate(!busy());
      else void reg.update().catch(() => {});
    });
    setInterval(() => void reg.update().catch(() => {}), 30 * 60 * 1000);
  });
}
