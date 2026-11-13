// Свои записи хранятся на устройстве (IndexedDB): переживают перезагрузку и закрытие приложения.
// Звук лежит моно-отсчётами без кодека — его не нужно расшифровывать. Чтобы не занимать лишнего,
// голос сохраняется с частотой 24 кГц в 16 битах: около 1,4 МБ на 30 секунд вместо 5–6.

export type Meta = {
  id: string;
  kind: "post" | "reply";
  to?: string; // id голоса, на который ответ
  title: string; // подпись в списке
  at: number; // когда записано
  sent?: boolean; // уже в общем эфире; без сети запись ждёт на устройстве и уйдёт сама
  // человек нажал «опубликовать», когда записи уже уходили в эфир (после согласия v2). Записи без этой
  // отметки сделаны, когда приложение обещало «другим людям пока не отправляется», — они остаются на телефоне
  publish?: boolean;
};
export type Saved = Meta & {
  rate: number;
  pcm: Int16Array | Float32Array; // Float32 — записи, сохранённые до сжатия
};

const RATE = 24000; // голосу хватает: всё, что выше 12 кГц, речи почти не добавляет

// звук → компактный вид для хранения
export async function pack(buf: AudioBuffer): Promise<{ rate: number; pcm: Int16Array }> {
  let ch = buf.getChannelData(0);
  let rate = buf.sampleRate;
  if (rate > RATE) {
    const off = new OfflineAudioContext(1, Math.ceil(buf.duration * RATE), RATE);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    ch = (await off.startRendering()).getChannelData(0);
    rate = RATE;
  }
  const pcm = new Int16Array(ch.length);
  for (let i = 0; i < ch.length; i++) pcm[i] = Math.max(-1, Math.min(1, ch[i])) * 32767;
  return { rate, pcm };
}

const DB = "sushhh-v2";
const STORE = "recordings";

let db: Promise<IDBDatabase | null> | undefined;
function open() {
  db ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // приватный режим или хранилище запрещено — живём без него
    } catch {
      resolve(null);
    }
  });
  return db;
}

// стереть все свои записи с устройства: закрыть базу и удалить её целиком
export async function wipe() {
  const d = await open();
  d?.close();
  db = undefined;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

// "ok" — сохранено; "full" — на устройстве кончилось место; "fail" — хранилище недоступно (приватный режим) или сбой
export type SaveResult = "ok" | "full" | "fail";
const isFull = (e: unknown) => (e as DOMException | null)?.name === "QuotaExceededError";

let persisted = false;
export async function saveRec(rec: Saved): Promise<SaveResult> {
  const d = await open();
  if (!d) return "fail";
  const res = await new Promise<SaveResult>((resolve) => {
    try {
      const tx = d.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve("ok");
      tx.onerror = tx.onabort = () => resolve(isFull(tx.error) ? "full" : "fail");
    } catch (e) {
      resolve(isFull(e) ? "full" : "fail");
    }
  });
  // первая сохранённая запись: просим браузер не стирать хранилище сам (Safari чистит неиспользуемые сайты)
  if (res === "ok" && !persisted) {
    persisted = true;
    void navigator.storage?.persist?.().catch(() => {});
  }
  return res;
}

export async function deleteRec(id: string) {
  const d = await open();
  if (!d) return;
  await new Promise<void>((resolve) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
  });
}

// запись ушла в эфир — отмечаем, чтобы очередь не отправила её второй раз
export async function markSent(id: string) {
  const rec = await getRec(id);
  if (rec && !rec.sent) await saveRec({ ...rec, sent: true });
}

// одна запись целиком — когда её играют
export async function getRec(id: string): Promise<Saved | undefined> {
  const d = await open();
  if (!d) return undefined;
  return new Promise((resolve) => {
    const req = d.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Saved | undefined);
    req.onerror = () => resolve(undefined);
  });
}

export async function loadRecs(): Promise<Saved[]> {
  const d = await open();
  if (!d) return [];
  return new Promise((resolve) => {
    const req = d.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Saved[]).sort((a, b) => a.at - b.at));
    req.onerror = () => resolve([]);
  });
}

// записанное — обратно в звук
export function toBuffer(rec: Saved) {
  const buf = new AudioBuffer({ length: rec.pcm.length, sampleRate: rec.rate, numberOfChannels: 1 });
  const ch = buf.getChannelData(0);
  if (rec.pcm instanceof Int16Array) for (let i = 0; i < ch.length; i++) ch[i] = rec.pcm[i] / 32767;
  else ch.set(rec.pcm);
  return buf;
}
