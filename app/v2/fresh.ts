// Свежая версия. Service worker у сайта общий со старой версией: новая версия скачивается, но ждёт
// разрешения включиться (так задумано для v1 — чтобы обновление не оборвало запись). v2 этого
// разрешения раньше никогда не давала, и с экрана «Домой» открывалась старая v2 из кэша — навсегда.
// Теперь v2 включает новую версию сама: при запуске сразу, а позже — когда ничего не записывается
// и не звучит, или когда приложение ушло в фон. Страница перезагружается уже с новой версией.
//
// Осторожно с тремя вещами:
// - без сети не включаем: страницу v2 новая версия не хранит, и перезагрузка открыла бы пустоту;
// - перезагружаемся, только когда страница не занята — даже если включила версию другая вкладка;
// - открытая рядом v1 при этом не перезагружается: она обновляется только по своей кнопке,
//   поэтому её запись не обрывается.

export function keepFresh(busy: () => boolean) {
  const sw = navigator.serviceWorker;
  if (!sw) return;
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

  void sw.getRegistration().then(async (reg) => {
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
