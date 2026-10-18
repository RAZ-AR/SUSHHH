// Данные: демо-записи с ветками, собственные записи из IndexedDB,
// реакции, потоки и рейтинг обсуждаемости для сторис.

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
  env?: ArrayLike<number>; // огибающая для «портрета»
  reactions: Record<string, number>;
  replies: Post[];
};

const H = 3600_000;
const M = 60_000;
const now = Date.now();

type Seed = Omit<Post, "replies" | "reactions" | "src" | "synthetic" | "author"> & {
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
];

function fromSeed(s: Seed): Post {
  const post: Post = {
    id: s.id, author: s.author ?? me(), mine: !s.author, createdAt: s.createdAt, hook: s.hook, text: s.text, tags: s.tags,
    palette: s.palette, src: `/seed/${s.file}.m4a`, synthetic: true, reactions: { ...s.reactions }, replies: [],
  };
  post.replies = (s.replies ?? [])
    .map((r) => ({
      id: r.id, author: r.author ?? me(), mine: !r.author, createdAt: r.createdAt, text: r.text, hook: hookFrom(r.text, "Ответ"),
      tags: [], palette: s.palette, src: `/seed/${r.file}.m4a`, synthetic: true, reactions: { ...r.reactions }, replies: [],
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
  text?: string;
  env?: number[];
};

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("sushhh", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("posts", { keyPath: "id" });
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

// --- реакции: свои хранятся локально и прибавляются к общим ---

const REACT_KEY = "sushhh.reactions";

function myReactions(): Record<string, Record<string, number>> {
  try {
    return JSON.parse(localStorage.getItem(REACT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function addReaction(p: Post, emoji: string) {
  p.reactions[emoji] = (p.reactions[emoji] ?? 0) + 1;
  const all = myReactions();
  all[p.id] ??= {};
  all[p.id][emoji] = (all[p.id][emoji] ?? 0) + 1;
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

export function me() {
  const names = ["полночь", "без_сахара", "тёплый_шум", "северный", "на_балконе", "медленно"];
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

export function storedToPost(s: Stored): Post {
  return {
    id: s.id, author: me(), mine: true, createdAt: s.createdAt, palette: s.palette, src: URL.createObjectURL(s.blob),
    hook: hookFrom(s.text, s.replyTo ? "Твой ответ" : "Твоя запись"), text: s.text, env: s.env,
    tags: s.replyTo ? [] : ["моё"], reactions: {}, replies: [],
  };
}

export async function loadFeed(): Promise<Post[]> {
  const feed = SEED.map(fromSeed);
  const byId = new Map<string, Post>();
  for (const p of feed) {
    byId.set(p.id, p);
    for (const r of p.replies) byId.set(r.id, r);
  }

  const mine = (await loadRecordings()).sort((a, b) => a.createdAt - b.createdAt);
  for (const s of mine) {
    const post = storedToPost(s);
    byId.set(post.id, post);
    const parent = s.replyTo ? byId.get(s.replyTo) : undefined;
    if (parent) parent.replies.push(post);
    else if (!s.replyTo) feed.unshift(post);
  }

  for (const [id, r] of Object.entries(myReactions())) {
    const p = byId.get(id);
    if (p) for (const [e, n] of Object.entries(r)) p.reactions[e] = (p.reactions[e] ?? 0) + n;
  }
  return feed;
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

export type Stream = { id: string; title: string; note: string; posts: Post[] };

export function streams(feed: Post[]): Stream[] {
  const has = (...tags: string[]) => (p: Post) => p.tags.some((t) => tags.includes(t));
  const list: Stream[] = [
    { id: "foryou", title: "Для тебя", note: "свежее и обсуждаемое вперемешку", posts: forYou(feed) },
    { id: "new", title: "Новое", note: "последние голоса", posts: [...feed].sort((a, b) => b.createdAt - a.createdAt) },
    { id: "qod", title: "Вопрос дня", note: "Что тебя сегодня удивило?", posts: feed.filter(has("вопрос дня")).flatMap((p) => [p, ...p.replies]) },
    { id: "confess", title: "Признания и мысли", note: "о личном", posts: feed.filter(has("признание", "мысль", "настроение")) },
    { id: "stories", title: "Истории", note: "смешное и неожиданное", posts: feed.filter(has("история", "юмор")) },
    { id: "city", title: "Город", note: "куда сходить и что вокруг", posts: feed.filter(has("город", "вопрос")) },
  ];
  return list.filter((s) => s.posts.length > 0);
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

export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  return `${Math.round(m / 60)} ч назад`;
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
