// Свои записи хранятся на устройстве (IndexedDB): переживают перезагрузку и закрытие приложения.
// Звук лежит как есть — моно-отсчёты и частота, без кодирования: так его не нужно расшифровывать.

export type Saved = {
  id: string;
  kind: "post" | "reply";
  to?: string; // id голоса, на который ответ
  title: string; // подпись в списке
  at: number; // когда записано
  rate: number;
  pcm: Float32Array;
};

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

export async function saveRec(rec: Saved) {
  const d = await open();
  if (!d) return false;
  return new Promise<boolean>((resolve) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve(true);
    tx.onerror = tx.onabort = () => resolve(false);
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
  buf.copyToChannel(rec.pcm as Float32Array<ArrayBuffer>, 0);
  return buf;
}
