// «Тебя услышали» (plan-v3, этап 1). Слушатель: докуда дослушал чужой голос и «я сейчас слушаю».
// Автор: ступени отклика у своих голосов — отправлено → слушают → дослушали → ответили — и честная
// тишина, если дослушали, а ответа пока нет. Каждый сигнал — с сервера, ничего не придумываем.

import { fetchListens, listenHere, saveShowListens, sendProgress, watchListeners } from "../src/backend";
import { tr, trn } from "./i18n";

export type Info = { createdAt: number; plays: number; completed: number; names: string[]; live: number };

const info = new Map<string, Info>();
let changed = () => {};
export const onHeardChange = (cb: () => void) => (changed = cb);
export const infoOf = (id: string) => info.get(id);

// свои голоса: забрать с сервера и следить, кто слушает последние из них прямо сейчас
const LIVE_WATCH = 5;
export async function refreshHeard(myIds: string[]) {
  const rows = await fetchListens().catch(() => null);
  if (!rows) return;
  for (const r of rows) {
    const was = info.get(r.post_id);
    info.set(r.post_id, { createdAt: Date.parse(r.created_at), plays: r.plays, completed: r.completed, names: r.names ?? [], live: was?.live ?? 0 });
  }
  const known = myIds.filter((id) => info.has(id)).slice(-LIVE_WATCH);
  watchListeners(known, (id, n) => {
    const i = info.get(id);
    if (!i || i.live === n) return;
    i.live = n;
    changed();
  });
  changed();
}

// ступень отклика одной строкой; others — сколько ответов от других людей
export function stepOf(id: string, others: number): string {
  const i = info.get(id);
  if (!i) return others ? trn("replies", others) : "";
  if (i.live) return tr("hearNow", { n: i.live });
  if (others) return trn("replies", others);
  if (i.completed) {
    const rest = i.completed - i.names.length;
    return i.names.length ? tr("heardBy", { names: i.names.join(", ") }) + (rest > 0 ? ` +${rest}` : "") : trn("heardFull", i.completed);
  }
  if (i.plays) return trn("plays", i.plays);
  return tr("sentToAir");
}

// честная тишина: голос старше 2 ч, его дослушали, а ответа нет. Не слушали вовсе — молчим
const QUIET_AFTER = 2 * 3600_000;
export function quietNote(id: string, others: number): string {
  const i = info.get(id);
  if (!i || others || !i.completed || Date.now() - i.createdAt < QUIET_AFTER) return "";
  return tr("quietHint", { who: trn("heardFullWho", i.completed) });
}

// ---------- слушатель ----------

let cur: { id: string; max: number } | null = null;

// заиграл чужой голос из общего эфира
export function beginListen(id: string) {
  if (cur?.id !== id) endListen();
  cur ??= { id, max: 0 };
  listenHere(id);
}
// голос ушёл: пауза, другой голос, конец (f = 1) или приложение закрыли
export function endListen(f?: number) {
  if (!cur) return;
  const max = Math.max(cur.max, f ?? 0);
  if (max > 0.02) sendProgress(cur.id, max);
  cur.max = max;
  listenHere(null);
  if (f === 1) cur = null;
}
export const listeningTo = () => cur?.id;

// ---------- показывать ли авторам, что я слушал ----------

const SHOW = "sushhh.v2.showListens";
export function showListens() {
  try {
    return localStorage.getItem(SHOW) !== "0";
  } catch {
    return true;
  }
}
export function setShowListens(on: boolean) {
  try {
    localStorage.setItem(SHOW, on ? "1" : "0");
  } catch {
    // на сервере всё равно сохранится
  }
  void saveShowListens(on);
}
