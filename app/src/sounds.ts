// Звуки сообщества: популярный момент из записи становится звуком-реакцией,
// но только если автор записи разрешил. Автор может отозвать звук в любой момент.
// В прототипе всё хранится в браузере; «ответы авторов» на запросы имитируются.

import { audioCtx } from "./audio";

export type SoundStatus = "live" | "pending" | "declined" | "revoked";

export type CommunitySound = {
  id: string;
  postId: string;
  author: string; // автор исходной записи — только он решает
  start: number; // секунды от начала записи
  dur: number;
  icon: string; // эмодзи — так звук выглядит в веере и на кольце
  name: string; // слова из этого места записи
  by: string; // кто предложил
  status: SoundStatus;
  uses: number;
};

export const SOUND_ICONS = ["🗣️", "💃", "🙃", "⚡", "🫠", "🤯", "🥲", "✨"];
export const MAX_DUR = 2.5;

// демо: эти авторы заранее разрешили делать звуки из своих записей
const AUTHORS_ALLOW = new Set(["мандарин", "ещё_месяц", "арам_вечером", "тихий_трамвай"]);

const SEED: CommunitySound[] = [
  { id: "c1", postId: "s3", author: "мандарин", start: 6.0, dur: 2.4, icon: "💃", name: "станцевала с дядей невесты", by: "гарик", status: "live", uses: 41 },
  { id: "c2", postId: "s5", author: "ещё_месяц", start: 4.0, dur: 1.8, icon: "🙃", name: "ещё месяц", by: "смелая_ли", status: "live", uses: 27 },
  { id: "c3", postId: "s2", author: "арам_вечером", start: 6.5, dur: 1.8, icon: "⚡", name: "он ответил через минуту", by: "лимонад", status: "live", uses: 12 },
  // запрос к тебе: кто-то хочет звук из твоей записи
  { id: "c4", postId: "s7", author: "", start: 0.1, dur: 2.3, icon: "🏃", name: "пять километров без остановки", by: "раздан_ран", status: "pending", uses: 0 },
];

const KEY = "sushhh.sounds";
const ALLOW_KEY = "sushhh.allowSounds";

function load(): CommunitySound[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    // нет хранилища — начнём с демо
  }
  return SEED.map((s) => ({ ...s }));
}

let sounds = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(sounds));
  } catch {
    // без хранилища звуки живут до перезагрузки
  }
}

export const soundKey = (s: CommunitySound) => `snd:${s.id}`;
export const isSoundKey = (k: string) => k.startsWith("snd:");
export const soundByKey = (k: string) => sounds.find((s) => soundKey(s) === k);

export const liveSounds = () => sounds.filter((s) => s.status === "live").sort((a, b) => b.uses - a.uses);

// запросы и звуки по моим записям: myPostIds — id моих записей
export const requestsForMe = (myPostIds: Set<string>) => sounds.filter((s) => s.status === "pending" && myPostIds.has(s.postId));
export const mySounds = (myPostIds: Set<string>) => sounds.filter((s) => s.status === "live" && myPostIds.has(s.postId));

export function allowsWithoutAsking(): boolean {
  try {
    return localStorage.getItem(ALLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAllowWithoutAsking(on: boolean) {
  try {
    localStorage.setItem(ALLOW_KEY, on ? "1" : "0");
  } catch {
    // настройка до перезагрузки
  }
}

// автор разрешает сразу? для своих записей — по настройке, для демо-авторов — по списку
export const authorAllows = (author: string, mine: boolean) => (mine ? allowsWithoutAsking() : AUTHORS_ALLOW.has(author));

export function createSound(s: Omit<CommunitySound, "id" | "status" | "uses">, allowed: boolean): CommunitySound {
  const sound: CommunitySound = { ...s, id: crypto.randomUUID().slice(0, 8), status: allowed ? "live" : "pending", uses: 0 };
  sounds.push(sound);
  save();
  return sound;
}

export function setStatus(id: string, status: SoundStatus) {
  const s = sounds.find((x) => x.id === id);
  if (!s) return;
  s.status = status;
  save();
}

export function countUse(s: CommunitySound) {
  s.uses += 1;
  save();
}

// слова из того места записи: оцениваем по доле времени — точных таймкодов слов пока нет
export function wordsAt(text: string | undefined, frac: number, n = 4) {
  const words = (text ?? "").replace(/[.,!?—:;«»]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const mid = Math.min(words.length - 1, Math.floor(frac * words.length));
  const from = Math.max(0, Math.min(mid - Math.floor(n / 2), words.length - n));
  return words.slice(from, from + n).join(" ").toLowerCase();
}

// --- воспроизведение фрагмента ---

const buffers = new Map<string, Promise<AudioBuffer>>();

function bufferFor(src: string) {
  let b = buffers.get(src);
  if (!b) {
    b = fetch(src)
      .then((r) => r.arrayBuffer())
      .then((data) => audioCtx().decodeAudioData(data));
    buffers.set(src, b);
  }
  return b;
}

// играет кусок записи [start, start+dur] с мягкими краями; возвращает длительность в мс
export async function playClip(src: string, start: number, dur: number, out: AudioNode) {
  const c = audioCtx();
  const buf = await bufferFor(src);
  const s = Math.max(0, Math.min(start, buf.duration - 0.2));
  const d = Math.min(dur, buf.duration - s);
  const node = c.createBufferSource();
  node.buffer = buf;
  const g = c.createGain();
  const t = c.currentTime + 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.06);
  g.gain.setValueAtTime(1, t + d - 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  node.connect(g).connect(out);
  node.start(t, s, d);
  return d * 1000;
}

export async function durationOf(src: string) {
  return (await bufferFor(src)).duration;
}
