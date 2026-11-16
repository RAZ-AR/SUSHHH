// События воронки для PostHog (plan-v3, этап 0): открыл → дослушал → начал запись → опубликовал.
// Выключено, пока не задан ключ VITE_POSTHOG_KEY. Без библиотеки: одно событие — один POST.
// Только название события и пара чисел. Ни голоса, ни подписей, ни имени, ни id аккаунта:
// человек в аналитике — случайный id этого устройства, «удалить все данные» стирает и его.

import { lang } from "./i18n";

const KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? "";
const HOST: string = import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const ID = "sushhh.v2.aid";

let id = "";
function deviceId() {
  if (id) return id;
  try {
    id = localStorage.getItem(ID) ?? "";
    if (!id) localStorage.setItem(ID, (id = crypto.randomUUID()));
  } catch {
    id ||= crypto.randomUUID(); // без хранилища — id только на этот запуск
  }
  return id;
}

export type TrackEvent = "opened" | "listened_full" | "record_started" | "published" | "reply_published";

export function track(event: TrackEvent, props: Record<string, string | number | boolean> = {}) {
  if (!KEY || !navigator.onLine) return;
  const body = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: deviceId(),
    properties: { ...props, lang, standalone: matchMedia("(display-mode: standalone)").matches, $process_person_profile: false },
  });
  void fetch(`${HOST}/i/v0/e/`, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
