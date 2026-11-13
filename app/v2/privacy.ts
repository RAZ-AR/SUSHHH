// Голос — личные данные. Перед первой записью человек видит, что с ней будет, подтверждает возраст
// и соглашается с правилами эфира. Согласие хранится с номером версии: поменяются правила — спросим снова.
// Здесь же — «удалить все мои данные»: всё, что приложение хранит на этом телефоне, кроме языка.

import { eraseRemote } from "./remote";
import { wipe } from "./store";

const CONSENT = "sushhh.v2.consent";
const VERSION = 2; // 2 — записи теперь уходят на сервер. Поднять, когда меняются правила или то, что происходит с записями
export const MIN_AGE = 16; // возраст согласия на обработку данных в ЕС по умолчанию (GDPR, ст. 8)

export function hasConsent() {
  try {
    return (JSON.parse(localStorage.getItem(CONSENT) ?? "null") as { v?: number } | null)?.v === VERSION;
  } catch {
    return false;
  }
}

export function giveConsent() {
  try {
    localStorage.setItem(CONSENT, JSON.stringify({ v: VERSION, at: Date.now() }));
  } catch {
    // без хранилища спросим ещё раз в следующий раз — запись это не останавливает
  }
}

// всё своё: на сервере (голоса, псевдоним, реакции) и с этого телефона: записи, согласие, тема, скрытое и заблокированное, очередь жалоб.
// Язык остаётся — без него экран удаления стал бы непонятным. Потом приложение начинается заново
export async function eraseAll() {
  await eraseRemote(); // голоса, псевдоним и реакции на сервере — тоже
  await wipe();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("sushhh.v2.") || k === "sushhh.proto.theme" || k === "sushhh.name") localStorage.removeItem(k);
  } catch {
    // нечего стирать
  }
  location.reload();
}
