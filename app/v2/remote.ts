// Общий эфир для v2 — тот же сервер, что у v1 (src/backend.ts, Supabase): анонимный вход под
// псевдонимом, голоса в Storage, записи и реакции в Postgres. Всё необязательно: без сети v2
// работает на устройстве, а свои записи ждут в очереди и уходят, когда связь вернулась.
// Реальное время — только уведомление: при возвращении в приложение эфир догружается целиком,
// поэтому пропущенное, пока телефон спал, не теряется.

import { audioUrl, connect, countPlay, eraseAccount, fetchFeed, myUid, onNewPost, publish, removePost, sendReaction, sendReport, type RemotePost, type RemoteReaction } from "../src/backend";
import { encode } from "./encode";
import { langTag } from "./langs";
import { pendingReports } from "./safety";
import { getRec, loadRecs, markSent, toBuffer, type Meta } from "./store";

export type Incoming = { posts: RemotePost[]; reactions: RemoteReaction[] };

let live = false; // вошли и эфир загружен
let syncing: Promise<boolean> | undefined;
let retryMs = 5000;
let retryTimer = 0;
let onData: (d: Incoming) => void = () => {};
let onSent: (id: string) => void = () => {};

export const isLive = () => live;
export const uid = () => myUid();
export const urlOf = (path: string) => audioUrl(path);

// подключиться и загрузить эфир; не вышло — пробуем снова (5 с, 10 с … не реже раза в минуту)
export function start(name: string, data: (d: Incoming) => void, sent: (id: string) => void) {
  onData = data;
  onSent = sent;
  const wake = () => void sync(name);
  addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && wake());
  wake();
}

function sync(name: string): Promise<boolean> {
  syncing ??= (async () => {
    clearTimeout(retryTimer);
    const ok = (await connect(name).catch(() => false)) && (await refresh());
    if (!ok) {
      retryTimer = window.setTimeout(() => void sync(name), retryMs);
      retryMs = Math.min(retryMs * 2, 60_000);
      return false;
    }
    retryMs = 5000;
    if (!live) {
      live = true;
      // новые голоса и ответы — сразу, без перезагрузки
      onNewPost((p) => onData({ posts: [p], reactions: [] }));
    }
    for (const r of pendingReports()) sendReport(r.id, r.reason); // жалобы, накопленные без сети
    void flush();
    return true;
  })().finally(() => (syncing = undefined));
  return syncing;
}

// весь эфир заново: что появилось, пока приложение спало, встанет на место (повторы отсеются по id)
async function refresh() {
  const feed = await fetchFeed().catch(() => null);
  if (!feed) return false;
  onData(feed);
  return true;
}

// ---------- свои записи → в эфир ----------

let flushing: Promise<void> = Promise.resolve();
// отправить всё, что ещё не ушло; по очереди, чтобы один голос не ушёл дважды
export function flush() {
  flushing = flushing.then(flushOnce, flushOnce);
  return flushing;
}
async function flushOnce() {
  if (!live || !navigator.onLine) return;
  for (const rec of await loadRecs()) {
    if (rec.sent || !rec.publish) continue; // старые записи без отметки — только на телефоне
    const ok = await send(rec, toBuffer(rec)).catch(() => false);
    if (ok) {
      await markSent(rec.id);
      onSent(rec.id);
    }
  }
}

// запись не сохранилась на устройстве — отправляем прямо из памяти, иначе она пропала бы
export async function sendNow(meta: Meta, buf: AudioBuffer) {
  if (!live) return false;
  const ok = await send(meta, buf).catch(() => false);
  if (ok) onSent(meta.id);
  return ok;
}

// идёт отправка — приложение не должно перезагружаться ради обновления, иначе запись из памяти пропадёт
let inFlight = 0;
export const uploading = () => inFlight > 0;

async function send(meta: Meta, buf: AudioBuffer) {
  inFlight++;
  try {
    return await upload(meta, buf);
  } finally {
    inFlight--;
  }
}
async function upload(meta: Meta, buf: AudioBuffer) {
  const blob = await encode(buf);
  return publish(
    { id: meta.id, blob, replyTo: meta.kind === "reply" ? meta.to : undefined, text: meta.title, env: envOf(buf), palette: 0, tags: [langTag()] }, // язык голоса — язык интерфейса автора
    myName,
  );
}

// огибающая на 40 точек — по ней v1 рисует «портрет» голоса
function envOf(buf: AudioBuffer, n = 40) {
  const ch = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / n));
  const env = Array.from({ length: n }, (_, i) => {
    let sum = 0;
    for (let j = i * step; j < (i + 1) * step && j < ch.length; j += 8) sum += ch[j] * ch[j];
    return Math.sqrt(sum / (step / 8));
  });
  const max = Math.max(...env, 1e-4);
  return env.map((v) => Math.round((v / max) * 1000) / 1000);
}

let myName = "";
export const setName = (n: string) => (myName = n);

// ---------- реакции, жалобы, прослушивания, удаление ----------

export const react = (postId: string, emoji: string, at: number) => sendReaction(postId, emoji, at);
export const report = (postId: string, reason: string) => sendReport(postId, reason);
export const played = (postId: string) => countPlay(postId);

// своя запись удалена на устройстве — и из эфира, если уже ушла
export async function unpublish(id: string) {
  const rec = await getRec(id);
  if (rec?.sent || live) await removePost(id).catch(() => {});
}

// «удалить все мои данные»: голоса, псевдоним и реакции на сервере, затем выход
export async function eraseRemote() {
  if (live) await eraseAccount().catch(() => {});
}
