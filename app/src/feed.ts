// Данные: демо-записи с ветками, собственные записи из IndexedDB,
// реакции, потоки и рейтинг обсуждаемости для сторис.

import type { Loudness } from "./audio";
import { audioUrl, connect, eraseAccount, fetchFeed, myUid, online, publish, removePost, rename, sendReaction, sendReport, type RemoteFeed, type RemotePost } from "./backend";
import { t } from "./i18n";

export type Post = {
  id: string;
  author: string;
  createdAt: number;
  hook: string;
  text?: string;
  tags: string[];
  src: string;
  palette: number;
  synthetic?: boolean;
  mine?: boolean; // запись текущего пользователя
  unsent?: boolean; // моя запись ещё не ушла в общий эфир (ждёт сети)
  env?: ArrayLike<number>; // огибающая для «портрета»
  loud?: Loudness; // выравнивание громкости и края тишины — считаются при первом разборе
  reactions: Record<string, number>;
  moments: Moment[]; // реакции, привязанные к месту в записи
  at?: number; // для ответа: момент исходной записи (0..1), на который он отвечает
  replies: Post[];
};

export type Moment = { at: number; emoji: string; mine?: boolean }; // mine — поставил я: в «зале» свои реакции не повторяются

const H = 3600_000;
const M = 60_000;
const now = Date.now();

type Seed = Omit<Post, "replies" | "reactions" | "moments" | "src" | "synthetic" | "author"> & {
  author?: string; // нет автора — значит запись «моя» (демо раздела «Моё»)
  file: string;
  reactions?: Record<string, number>;
  replies?: Omit<Seed, "replies" | "palette" | "tags" | "hook">[];
};

const SEED: Seed[] = [
  {
    id: "s7", mine: true, createdAt: now - 95 * M, palette: 1, file: "s7",
    hook: "Пять километров без остановки — впервые за год",
    text: "Пять километров без остановки — впервые за год. Медленно, но до конца. Кто ещё бегает по вечерам?",
    tags: ["спорт", "сегодня"], reactions: { "👏": 6, "🔥": 3 },
    replies: [
      { id: "r13", author: "раздан_ран", createdAt: now - 70 * M, file: "r13", text: "Я бегаю вдоль Раздана по утрам. Присоединяйся в субботу!" },
      { id: "r14", author: "лёгкие_ноги", createdAt: now - 35 * M, file: "r14", text: "Поздравляю! Первые пять — самые сложные, дальше легче." },
    ],
  },
  {
    id: "s1", author: "тихий_трамвай", createdAt: now - 24 * M, palette: 0, file: "s1",
    hook: "Впервые за неделю чувствую спокойствие",
    text: "Еду домой на последней маршрутке, и впервые за неделю чувствую спокойствие. Просто смотрю в окно, и мне ничего не нужно.",
    tags: ["сегодня", "настроение"], reactions: { "❤️": 7, "🤗": 3 },
  },
  {
    id: "s2", author: "арам_вечером", createdAt: now - 72 * M, palette: 3, file: "s2",
    hook: "Почему мы так редко говорим, что скучаем?",
    text: "Почему мы так редко говорим людям, что скучаем по ним? Сегодня написал другу, которого не видел три года. Он ответил через минуту.",
    tags: ["мысль", "люди"], reactions: { "❤️": 14, "🤗": 6, "😮": 1 },
    replies: [
      { id: "r1", author: "лимонад", createdAt: now - 60 * M, file: "r1", text: "Ты меня вдохновил. Сейчас напишу бабушке, давно ей не звонил." },
      { id: "r2", author: "сона_м", createdAt: now - 51 * M, file: "r2", text: "У меня так же было с подругой из школы. Теперь видимся каждую неделю." },
      { id: "r3", author: "без_имени", createdAt: now - 40 * M, file: "r3", text: "А я боюсь, что человек меня уже не помнит. Глупо, да?" },
    ],
  },
  {
    id: "s3", author: "мандарин", createdAt: now - 2 * H, palette: 1, file: "s3",
    hook: "Случайно попала на чужую свадьбу",
    text: "Расскажу, как я случайно попала на чужую свадьбу. Перепутала ресторан, меня посадили за стол, и я станцевала с дядей невесты.",
    tags: ["история", "юмор"], reactions: { "😂": 23, "🔥": 5, "👏": 4 },
    replies: [
      { id: "r4", author: "гарик", createdAt: now - 100 * M, file: "r4", text: "Это лучшая история за сегодня. Надеюсь, дядя невесты был не против!" },
      { id: "r5", author: "ann_yer", createdAt: now - 80 * M, file: "r5", text: "Со мной было похожее на чужом дне рождения. Ушла с тортом." },
    ],
  },
  {
    id: "s4", author: "nor_city", createdAt: now - 156 * M, palette: 4, file: "s4",
    hook: "Куда сходить одному вечером? Только не бар",
    text: "Куда сходить одному вечером в Ереване? Только не бар. Хочется чего-то тихого, где можно посидеть и подумать.",
    tags: ["вопрос", "город"], reactions: { "🤗": 2 },
    replies: [
      { id: "r6", author: "каскад_лав", createdAt: now - 140 * M, file: "r6", text: "Попробуй Каскад вечером. После девяти там тихо, и весь город как на ладони." },
      { id: "r7", author: "книжная_пыль", createdAt: now - 120 * M, file: "r7", text: "Есть маленькая книжная кофейня на Абовяна. Там можно сидеть часами." },
      { id: "r15", mine: true, createdAt: now - 110 * M, file: "r15", text: "Поддержу про Каскад. Там по вечерам ещё бывает живая музыка." },
      { id: "r16", author: "nor_city", createdAt: now - 30 * M, file: "r16", text: "Спасибо всем! Сегодня вечером пойду на Каскад." },
    ],
  },
  {
    id: "s5", author: "ещё_месяц", createdAt: now - 3.5 * H, palette: 2, file: "s5",
    hook: "Давно хочу сменить работу, но боюсь",
    text: "Я давно хочу сменить работу, но боюсь. Каждое утро говорю себе: ещё месяц. И так уже два года.",
    tags: ["признание", "работа"], reactions: { "🤗": 18, "❤️": 9, "👏": 2 },
    replies: [
      { id: "r8", author: "смелая_ли", createdAt: now - 3.2 * H, file: "r8", text: "Я ушла после трёх лет таких же месяцев. Страшно было ровно неделю." },
      { id: "r9", author: "hr_днём", createdAt: now - 2.9 * H, file: "r9", text: "Начни с одного собеседования, просто чтобы проверить себя. Без обязательств." },
      { id: "r10", author: "вместе", createdAt: now - 2.5 * H, file: "r10", text: "Держись. Ты не один такой, правда." },
    ],
  },
  {
    id: "s6", author: "вопрос дня", createdAt: now - 5 * H, palette: 0, file: "s6",
    hook: "Что тебя сегодня удивило?",
    text: "Вопрос дня. Что тебя сегодня удивило? Меня — продавец в кофейне, который запомнил моё имя с первого раза.",
    tags: ["вопрос дня"], reactions: { "❤️": 5, "😮": 3 },
    replies: [
      { id: "r11", author: "сосед_сверху", createdAt: now - 4 * H, file: "r11", text: "Меня удивило, что сосед впервые за год поздоровался." },
      { id: "r12", author: "радуга", createdAt: now - 3 * H, file: "r12", text: "Я сегодня увидела радугу над Араратом. Прямо из окна автобуса." },
    ],
  },
  // демо-слухи: о местах и событиях, живут сутки, держатся на «верю» / «не верю»
  {
    id: "q1", author: "лёгкий_ветер", createdAt: now - 10 * H, palette: 2, file: "r15",
    hook: "Говорят, на Каскаде по вечерам живая музыка",
    text: "Поддержу про Каскад. Там по вечерам ещё бывает живая музыка.",
    tags: ["слух"], reactions: { "✓": 12, "✗": 3, "🔥": 3 },
  },
  {
    id: "q2", author: "книжная_пыль", createdAt: now - 4 * H, palette: 4, file: "r7",
    hook: "Есть книжная кофейня на Абовяна, где сидят часами",
    text: "Есть маленькая книжная кофейня на Абовяна. Там можно сидеть часами.",
    tags: ["слух"], reactions: { "✓": 5, "✗": 1 },
  },
  {
    id: "q3", author: "радуга", createdAt: now - 21 * H, palette: 0, file: "r12",
    hook: "Радуга над Араратом — видно прямо из автобуса",
    text: "Я сегодня увидела радугу над Араратом. Прямо из окна автобуса.",
    tags: ["слух"], reactions: { "✓": 31, "✗": 2, "😮": 5 },
  },
];

// демо: на какой момент исходной записи отвечает каждый ответ
const REPLY_AT: Record<string, number> = {
  r1: 0.62, r2: 0.4, r3: 0.85, r4: 0.8, r5: 0.5, r6: 0.3, r7: 0.55, r8: 0.7, r9: 0.4, r10: 0.92,
  r11: 0.5, r12: 0.78, r13: 0.88, r14: 0.2, r15: 0.32, r16: 0.95,
};
// демо: где в записи «горячая точка», вокруг неё кучкуются реакции
const HOT: Record<string, number> = { s1: 0.7, s2: 0.42, s3: 0.82, s4: 0.35, s5: 0.6, s6: 0.75, s7: 0.45 };

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function seedMoments(id: string, reactions: Record<string, number> | undefined): Moment[] {
  const hot = HOT[id] ?? 0.5;
  const out: Moment[] = [];
  let k = id.length * 7;
  for (const [emoji, n] of Object.entries(reactions ?? {})) {
    for (let i = 0; i < n; i++, k++) {
      const spread = (seeded(k) + seeded(k + 99) - 1) * 0.16; // ~ колокол вокруг горячей точки
      const stray = seeded(k + 7) < 0.25 ? seeded(k + 3) - hot : 0; // часть реакций — в случайных местах
      out.push({ emoji, at: Math.min(0.99, Math.max(0.01, hot + spread + stray)) });
    }
  }
  return out;
}

function fromSeed(s: Seed): Post {
  const post: Post = {
    id: s.id, author: s.author ?? me(), mine: !s.author, createdAt: s.createdAt, hook: s.hook, text: s.text, tags: s.tags,
    palette: s.palette, src: `${import.meta.env.BASE_URL}seed/${s.file}.m4a`, synthetic: true, reactions: { ...s.reactions },
    moments: seedMoments(s.id, s.reactions), replies: [],
  };
  post.replies = (s.replies ?? [])
    .map((r) => ({
      id: r.id, author: r.author ?? me(), mine: !r.author, createdAt: r.createdAt, text: r.text, hook: hookFrom(r.text, t("replyFallback")),
      tags: [], palette: s.palette, src: `${import.meta.env.BASE_URL}seed/${r.file}.m4a`, synthetic: true, reactions: { ...r.reactions },
      moments: seedMoments(r.id, r.reactions), at: REPLY_AT[r.id], replies: [],
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
  return post;
}

// --- IndexedDB ---

export type Stored = {
  id: string;
  blob: Blob;
  createdAt: number;
  palette: number;
  replyTo?: string;
  at?: number; // момент исходной записи, на который отвечает
  text?: string;
  env?: number[];
  tags?: string[];
  sent?: boolean; // уже в общем эфире
};

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("sushhh", 2);
    // posts — мои записи; emo — мои секундные звуки для пэдов эмоций
    r.onupgradeneeded = () => {
      for (const name of ["posts", "emo"]) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function saveRecording(s: Stored) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("posts", "readwrite");
    tx.objectStore("posts").put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadRecordings(): Promise<Stored[]> {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const r = d.transaction("posts").objectStore("posts").getAll();
      r.onsuccess = () => resolve(r.result as Stored[]);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return [];
  }
}

// --- свои звуки эмоций: секунда моего голоса на пэд ---

export type EmoSample = { id: string; blob: Blob };

export async function saveEmo(s: EmoSample) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("emo", "readwrite");
    tx.objectStore("emo").put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEmo(): Promise<EmoSample[]> {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const r = d.transaction("emo").objectStore("emo").getAll();
      r.onsuccess = () => resolve(r.result as EmoSample[]);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return [];
  }
}

// --- реакции: свои хранятся локально вместе с моментом записи ---

const REACT_KEY = "sushhh.reactions.v2";

function myReactions(): Record<string, [string, number][]> {
  try {
    return JSON.parse(localStorage.getItem(REACT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function addReaction(p: Post, emoji: string, at: number) {
  p.reactions[emoji] = (p.reactions[emoji] ?? 0) + 1;
  p.moments.push({ emoji, at, mine: true });
  sendReaction(p.id, emoji, at);
  const all = myReactions();
  (all[p.id] ??= []).push([emoji, at]);
  try {
    localStorage.setItem(REACT_KEY, JSON.stringify(all));
  } catch {
    // без хранилища реакция живёт до перезагрузки
  }
}

// --- прослушанное и очередь «ответить позже» (локально) ---

function readIds(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // без хранилища состояние живёт до перезагрузки
  }
}

const heard = new Set(readIds("sushhh.heard"));

export function markHeard(id: string) {
  if (heard.has(id)) return;
  heard.add(id);
  writeIds("sushhh.heard", [...heard]);
}

export const isHeard = (id: string) => heard.has(id);

let later = readIds("sushhh.later");

export const laterIds = () => later;
export const isLater = (id: string) => later.includes(id);

export function toggleLater(id: string) {
  later = isLater(id) ? later.filter((x) => x !== id) : [id, ...later];
  writeIds("sushhh.later", later);
  return isLater(id);
}

export function removeLater(id: string) {
  if (!isLater(id)) return;
  later = later.filter((x) => x !== id);
  writeIds("sushhh.later", later);
}

// --- безопасность: скрытые записи, заблокированные авторы, жалобы (локально) ---
// В прототипе это хранится в браузере; в продукте жалоба уходит модераторам.

const hidden = new Set(readIds("sushhh.hidden"));
const blocked = new Set(readIds("sushhh.blocked"));

export const isHidden = (id: string) => hidden.has(id);
export const isBlocked = (author: string) => blocked.has(author);
export const blockedAuthors = () => [...blocked];
// запись видна, если её не скрыли и автор не в блоке
export const visible = (p: Post) => !hidden.has(p.id) && !blocked.has(p.author);

export function hidePost(id: string) {
  hidden.add(id);
  writeIds("sushhh.hidden", [...hidden]);
}

export function blockAuthor(author: string) {
  blocked.add(author);
  writeIds("sushhh.blocked", [...blocked]);
}

export function unblockAuthor(author: string) {
  blocked.delete(author);
  writeIds("sushhh.blocked", [...blocked]);
}

export type ReportReason = "abuse" | "spam" | "sexual" | "danger" | "personal" | "crisis" | "other";

export function report(id: string, reason: ReportReason) {
  try {
    const list = JSON.parse(localStorage.getItem("sushhh.reports") ?? "[]");
    list.push({ id, reason, at: Date.now() });
    localStorage.setItem("sushhh.reports", JSON.stringify(list));
  } catch {
    // без хранилища локальная копия теряется; на сервер жалоба всё равно ушла
  }
  sendReport(id, reason);
  hidePost(id); // пожаловавшийся больше не слышит эту запись
}

export async function deleteRecording(id: string) {
  hidePost(id); // демо-записи «моих» постов удалить нельзя — просто прячем
  revokeBlob(id);
  minePosts.delete(id);
  void removePost(id).catch(() => {});
  try {
    const d = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("posts", "readwrite");
      tx.objectStore("posts").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // записи не было в базе — уже спрятана
  }
}

const NAMES = ["полночь", "без_сахара", "тёплый_шум", "северный", "на_балконе", "медленно", "до_рассвета", "тихий_час", "лёгкий_ветер", "сонный_кот"];

// новый псевдоним — любой другой из списка; аура (цвет голоса) сменится вместе с ним
export function renameMe() {
  const old = me();
  const next = NAMES.filter((n) => n !== old)[Math.floor(Math.random() * (NAMES.length - 1))];
  try {
    localStorage.setItem("sushhh.name", next);
  } catch {
    // без хранилища псевдоним не сохранится
  }
  void rename(next).catch(() => {});
  return next;
}

// стереть всё, что приложение хранит на устройстве: настройки, реакции, записи
export async function eraseEverything() {
  await eraseAccount().catch(() => {});
  for (const id of blobUrls.keys()) revokeBlob(id);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("sushhh.") && k !== "sushhh.lang") localStorage.removeItem(k);
  } catch {
    // нечего стирать
  }
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase("sushhh");
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}

export function me() {
  const names = NAMES;
  try {
    let n = localStorage.getItem("sushhh.name");
    if (!n) {
      n = names[Math.floor(Math.random() * names.length)];
      localStorage.setItem("sushhh.name", n);
    }
    return n;
  } catch {
    return names[0];
  }
}

// хук — первые слова расшифровки, обрезанные по слову
export function hookFrom(text: string | undefined, fallback: string) {
  const t = text?.trim();
  if (!t) return fallback;
  const first = t.split(/(?<=[.!?…])\s/)[0];
  if (first.length <= 52) return first.replace(/[.,;:]$/, "");
  return first.slice(0, 52).replace(/\s+\S*$/, "") + "…";
}

// blob-URL своих записей: освобождаются при удалении, иначе Blob живёт в памяти до закрытия вкладки
const blobUrls = new Map<string, string>();
function blobUrl(id: string, blob: Blob) {
  const old = blobUrls.get(id);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(blob);
  blobUrls.set(id, url);
  return url;
}
function revokeBlob(id: string) {
  const url = blobUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  blobUrls.delete(id);
}

// мои записи с этого устройства — по ним снимаем пометку «не отправлено»
const minePosts = new Map<string, Post>();

export function storedToPost(s: Stored): Post {
  const post: Post = {
    id: s.id, author: me(), mine: true, unsent: !s.sent, createdAt: s.createdAt, palette: s.palette, src: blobUrl(s.id, s.blob),
    hook: hookFrom(s.text, t(s.replyTo ? "yourReply" : "yourPost")), text: s.text, env: s.env, at: s.at,
    tags: s.replyTo ? [] : ["моё", ...(s.tags ?? [])], reactions: {}, moments: [], replies: [],
  };
  minePosts.set(s.id, post);
  return post;
}

const REAL_ENOUGH = 5;

// --- очередь отправки: запись лежит на устройстве, пока не уйдёт в общий эфир ---

function publishRecording(s: Stored) {
  return publish({ id: s.id, blob: s.blob, replyTo: s.replyTo, at: s.at, text: s.text, env: s.env, palette: s.palette, tags: s.tags ?? [] }, me()).catch(() => false);
}

const remoteIds = new Set<string>(); // что уже точно есть на сервере
const sentListeners = new Set<() => void>();
export const onSent = (f: () => void) => sentListeners.add(f);

async function flushOnce(): Promise<boolean> {
  if (!online() || !navigator.onLine) return false;
  let all = true;
  let changed = false;
  for (const s of await loadRecordings()) {
    if (s.sent) continue;
    if (!remoteIds.has(s.id) && !(await publishRecording(s))) {
      all = false;
      continue;
    }
    await saveRecording({ ...s, sent: true }).catch(() => {});
    const post = minePosts.get(s.id);
    if (post) post.unsent = false;
    changed = true;
  }
  if (changed) sentListeners.forEach((f) => f());
  return all;
}

// отправить всё неотправленное; вызовы идут по очереди, чтобы один голос не уходил дважды.
// true — очередь пуста
let flushing: Promise<boolean> = Promise.resolve(true);
export function flushQueue(): Promise<boolean> {
  flushing = flushing.then(flushOnce, flushOnce);
  return flushing;
}

// можно ли отправить прямо сейчас: вход выполнен и сеть есть
export const canSend = () => online() && navigator.onLine;

export function remoteToPost(r: RemotePost): Post {
  const mine = r.author_id === myUid();
  return {
    id: r.id, author: mine ? me() : r.author_name, mine, createdAt: Date.parse(r.created_at), palette: r.palette, src: audioUrl(r.audio_path),
    hook: hookFrom(r.text ?? undefined, t(r.reply_to ? "replyFallback" : "transcriptPending")), text: r.text ?? undefined,
    env: r.env ?? undefined, at: r.at ?? undefined, tags: r.tags ?? [], reactions: {}, moments: [], replies: [],
  };
}

// новый голос пришёл в реальном времени: встаёт в ленту или в ветку; null — ветки у нас нет
export function addRemotePost(feed: Post[], r: RemotePost): { post: Post; root: Post } | null {
  if (findPost(feed, r.id)) return null;
  const post = remoteToPost(r);
  if (!r.reply_to) {
    feed.unshift(post);
    return { post, root: post };
  }
  const parent = findPost(feed, r.reply_to)?.root;
  if (!parent) return null;
  parent.replies.push(post);
  return { post, root: parent };
}

// лента с устройства: демо-записи, свои записи и свои реакции. Общий эфир подмешивает syncRemote
export async function loadFeed(): Promise<Post[]> {
  const feed = SEED.map(fromSeed);
  const byId = indexFeed(feed);

  const mine = (await loadRecordings()).sort((a, b) => a.createdAt - b.createdAt);
  for (const s of mine) {
    const post = storedToPost(s);
    byId.set(post.id, post);
    const parent = s.replyTo ? byId.get(s.replyTo) : undefined;
    if (parent) parent.replies.push(post);
    else if (!s.replyTo) feed.unshift(post);
  }

  for (const [id, list] of Object.entries(myReactions())) {
    const p = byId.get(id);
    if (!p || !Array.isArray(list)) continue;
    for (const [emoji, at] of list) {
      p.reactions[emoji] = (p.reactions[emoji] ?? 0) + 1;
      p.moments.push({ emoji, at, mine: true });
    }
  }
  return feed;
}

function indexFeed(feed: Post[]) {
  const byId = new Map<string, Post>();
  for (const p of feed) {
    byId.set(p.id, p);
    for (const r of p.replies) byId.set(r.id, r);
  }
  return byId;
}

// чужие голоса и реакции встают в уже показанную ленту; вызывается один раз за запуск
export function mergeRemote(feed: Post[], remote: RemoteFeed, uid: string | null, toPost: (r: RemotePost) => Post = remoteToPost) {
  const byId = indexFeed(feed);
  for (const r of [...remote.posts].reverse()) {
    if (byId.has(r.id)) continue; // своя запись уже есть локально — играем из памяти
    const post = toPost(r);
    byId.set(post.id, post);
    if (!r.reply_to) feed.unshift(post);
    else byId.get(r.reply_to)?.replies.push(post);
  }
  for (const x of remote.reactions) {
    const p = byId.get(x.post_id);
    if (!p || x.user_id === uid) continue; // свои реакции уже посчитаны из локальных
    p.reactions[x.emoji] = (p.reactions[x.emoji] ?? 0) + 1;
    p.moments.push({ emoji: x.emoji, at: x.at });
  }
  // живых голосов уже хватает на эфир — демо-записи убираем, чтобы не путать участников
  if (remote.posts.filter((r) => !r.reply_to).length >= REAL_ENOUGH) {
    for (let i = feed.length - 1; i >= 0; i--) if (feed[i].synthetic) feed.splice(i, 1);
  }
}

// общий эфир: вход, чужие голоса и реакции, затем отправка своей очереди.
// false — не вышло (нет сети, сервер молчит): вызывающий пробует снова
export async function syncRemote(feed: Post[]): Promise<boolean> {
  if (!(await connect(me()))) return false;
  const remote = await fetchFeed().catch(() => null);
  if (!remote) return false;
  mergeRemote(feed, remote, myUid());
  for (const r of remote.posts) remoteIds.add(r.id);
  void flushQueue();
  return true;
}

// --- обсуждаемость и потоки ---

export function reactionCount(p: Post) {
  return Object.values(p.reactions).reduce((a, b) => a + b, 0);
}

// голосовой ответ весит больше реакции: это и есть «тебя услышали»
export function discussion(p: Post) {
  return p.replies.length * 5 + p.replies.reduce((a, r) => a + reactionCount(r), 0) + reactionCount(p);
}

export function mostDiscussed(feed: Post[], n = 6) {
  return [...feed].filter((p) => p.replies.length > 0).sort((a, b) => discussion(b) - discussion(a)).slice(0, n);
}

// --- диапазоны приёмника: город, свои, слухи ---

export type Band = "city" | "own" | "rumor";
export const BANDS: Band[] = ["city", "own", "rumor"];

// слух — запись о месте или событии: живёт сутки, держится на «верю» / «не верю»
export const RUMOR_TAG = "слух";
export const RUMOR_YES = "✓";
export const RUMOR_NO = "✗";
const RUMOR_MS = 24 * H;
export const isRumor = (p: Post) => p.tags.includes(RUMOR_TAG);
export const rumorHoursLeft = (p: Post, at = Date.now()) => Math.max(0, Math.ceil((p.createdAt + RUMOR_MS - at) / H));
export const rumorVotes = (p: Post) => ({ yes: p.reactions[RUMOR_YES] ?? 0, no: p.reactions[RUMOR_NO] ?? 0 });

// saved — авторы на клавишах памяти
export function bandPosts(feed: Post[], band: Band, saved: readonly string[], at = Date.now()): Post[] {
  if (band === "rumor") {
    const score = (p: Post) => rumorVotes(p).yes - rumorVotes(p).no;
    return feed.filter((p) => isRumor(p) && rumorHoursLeft(p, at) > 0).sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
  }
  if (band === "own") {
    const mineToo = feed.flatMap((p) => [p, ...p.replies]);
    return mineToo.filter((p) => !p.mine && saved.includes(p.author)).sort((a, b) => b.createdAt - a.createdAt);
  }
  return forYou(feed.filter((p) => !isRumor(p)));
}

// сигнал записи: чем больше ей отвечают и реагируют, тем дальше она слышна.
// bars — деления индикатора (1..5), radius — 0 квартал, 1 район, 2 город, 3 все города
export function signalOf(p: Post) {
  const score = discussion(p);
  return {
    bars: 1 + [3, 8, 16, 30].filter((x) => score >= x).length,
    radius: score >= 40 ? 3 : score >= 15 ? 2 : score >= 5 ? 1 : 0,
  };
}

// --- клавиши памяти M1–M4: сохранённые голоса (по псевдониму), хранятся на устройстве ---

const MEM_KEY = "sushhh.memory";
const MEM_SIZE = 4;
function readMemory(): (string | null)[] {
  let v: unknown = null;
  try {
    v = JSON.parse(localStorage.getItem(MEM_KEY) ?? "null");
  } catch {
    // без хранилища память пуста
  }
  const list = Array.isArray(v) ? v : [];
  return Array.from({ length: MEM_SIZE }, (_, i) => (typeof list[i] === "string" ? (list[i] as string) : null));
}
let mem = readMemory();

export const memory = (): readonly (string | null)[] => mem;
export const savedAuthors = () => mem.filter((x): x is string => !!x);

// один голос — одна клавиша: с прежней он снимается
export function setMemory(i: number, author: string) {
  mem = mem.map((x, k) => (k === i ? author : x === author ? null : x));
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(mem));
  } catch {
    // без хранилища память живёт до перезагрузки
  }
}

// лента v0 из концепции: свежие и обсуждаемые через одну, без повторов
function forYou(feed: Post[]) {
  const fresh = [...feed].sort((a, b) => b.createdAt - a.createdAt);
  const hot = [...feed].sort((a, b) => discussion(b) - discussion(a));
  const out: Post[] = [];
  for (let i = 0; out.length < feed.length; i++) {
    for (const p of [fresh[i], hot[i]]) if (p && !out.includes(p)) out.push(p);
  }
  return out;
}


// --- раздел «Моё» ---

export type Incoming = { reply: Post; root: Post };

// ответы мне: на мои записи и в ветках, где я отвечал, — после моей реплики
export function repliesToMe(feed: Post[]): Incoming[] {
  const out: Incoming[] = [];
  for (const root of feed) {
    const myFirst = root.mine ? root.createdAt : root.replies.find((r) => r.mine)?.createdAt;
    if (myFirst === undefined) continue;
    for (const r of root.replies) if (!r.mine && r.createdAt > myFirst) out.push({ reply: r, root });
  }
  return out.sort((a, b) => b.reply.createdAt - a.reply.createdAt);
}

export const unheardToMe = (feed: Post[]) => repliesToMe(feed).filter((x) => !isHeard(x.reply.id));

export const myPosts = (feed: Post[]) => feed.filter((p) => p.mine);

export const myThreads = (feed: Post[]) => feed.filter((p) => !p.mine && p.replies.some((r) => r.mine));

// найти пост и его корень по id (очередь «позже» хранит только id)
export function findPost(feed: Post[], id: string): { post: Post; root: Post } | null {
  for (const root of feed) {
    if (root.id === id) return { post: root, root };
    const r = root.replies.find((x) => x.id === id);
    if (r) return { post: r, root };
  }
  return null;
}
