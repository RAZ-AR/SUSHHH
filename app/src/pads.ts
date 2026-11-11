// Пэды эмоций, зал и клавиши памяти.
// Пэд: тап — реакция в текущий момент записи, удержание — записать её своим голосом (до 1,5 с).
// Зал: чужие реакции тихо звучат там, где их поставили. Память M1–M4 — сохранённые голоса.
// Свои звуки пока живут на устройстве: другие слышат вместо них звук прибора.

import { audioCtx } from "./audio";
import { voiceColor } from "./aura";
import { isRumor, loadEmo, memory, type Post, RUMOR_NO, RUMOR_YES, saveEmo, setMemory } from "./feed";
import { t } from "./i18n";
import { MEMES, playReaction, type Reaction, REACTIONS } from "./reactions";
import { audioSession } from "./pwa";
import { toast } from "./ui";
import { click } from "./dial";
import { cur, player, rootOf, tuneToAuthor } from "./air";
import { float, reactWith } from "./fan";

// =================== пэды ===================

type Pad = { key: string; word: string; synth: Reaction };
const EMO: Pad[] = [
  { key: "😂", word: "pad.ha", synth: "😂" },
  { key: "😮", word: "pad.ooo", synth: "😮" },
  { key: "🔥", word: "pad.fire", synth: "🔥" },
  { key: "❤️", word: "pad.warm", synth: "❤️" },
];
// у слуха два первых пэда — «верю» и «не верю»
const VOTE: Pad[] = [{ key: RUMOR_YES, word: "pad.yes", synth: "👏" }, { key: RUMOR_NO, word: "pad.no", synth: "🦗" }, EMO[1], EMO[2]];

const blobs = new Map<string, Blob>();
const samples = new Map<string, AudioBuffer>();
void loadEmo().then((list) => {
  for (const s of list) blobs.set(s.id, s.blob);
  shownKeys = "";
  renderPads();
});

// раскодировать свои звуки при первом касании пэда: до жеста AudioContext трогать незачем
function warm() {
  for (const [key, blob] of blobs) {
    if (samples.has(key)) continue;
    void blob
      .arrayBuffer()
      .then((data) => audioCtx().decodeAudioData(data))
      .then((buf) => samples.set(key, buf))
      .catch(() => blobs.delete(key)); // запись не читается — вернётся звук прибора
  }
}

function sound(p: Pad, out: AudioNode, gain = 1) {
  const c = audioCtx();
  const g = c.createGain();
  g.gain.value = gain;
  g.connect(out);
  const buf = samples.get(p.key);
  if (!buf) return void playReaction(p.synth, g);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(g);
  src.start();
}

const pads = () => {
  const it = cur();
  return it && isRumor(rootOf(it)) ? VOTE : EMO;
};

let shownKeys = "";
export function renderPads() {
  const list = pads();
  const sig = list.map((p) => p.key + (blobs.has(p.key) ? "*" : "")).join();
  if (sig === shownKeys) return;
  shownKeys = sig;
  document.querySelectorAll<HTMLElement>("[data-pad]").forEach((b, i) => {
    const p = list[i];
    const own = blobs.has(p.key);
    b.querySelector(".cap-btn")!.textContent = p.key;
    b.querySelector("b")!.textContent = t(p.word);
    b.querySelector("small")!.textContent = t(own ? "padOwnCaps" : "padHoldCaps");
    b.classList.toggle("own", own);
    b.setAttribute("aria-label", t("padAria", { word: t(p.word) }));
  });
}

function hit(p: Pad, el: HTMLElement) {
  if (!cur()) return;
  reactWith(p.key, false, (out) => sound(p, out));
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
}

// удержание: секунда своего голоса на пэд
const HOLD_MS = 450;
const SAMPLE_MS = 1500;
const MIN_MS = 250;

async function record(p: Pad, el: HTMLElement, released: () => boolean) {
  audioSession("play-and-record");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    audioSession("playback");
    return toast(t("padNoMic"));
  }
  const small = el.querySelector("small")!;
  el.classList.add("rec");
  small.textContent = t("padSpeakCaps");
  player.duck(true);
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const t0 = performance.now();
  await new Promise<void>((r) => {
    const iv = setInterval(() => {
      if (!released() && performance.now() - t0 < SAMPLE_MS) return;
      clearInterval(iv);
      r();
    }, 30);
  });
  const dur = performance.now() - t0;
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  audioSession("playback");
  player.duck(false);
  el.classList.remove("rec");
  shownKeys = "";
  try {
    if (dur < MIN_MS) throw new Error("short");
    const blob = new Blob(chunks, { type: rec.mimeType });
    samples.set(p.key, await audioCtx().decodeAudioData(await blob.arrayBuffer()));
    blobs.set(p.key, blob);
    void saveEmo({ id: p.key, blob }).catch(() => {}); // не сохранилось — звук живёт до перезагрузки
    toast(t("padSaved", { word: t(p.word) }));
    sound(p, player.fx(1800));
  } catch {
    toast(t("padFail"));
  }
  renderPads();
}

document.querySelectorAll<HTMLElement>("[data-pad]").forEach((el, i) => {
  let timer = 0;
  let held = false;
  let up = true;
  el.addEventListener("pointerdown", () => {
    warm();
    click(0.05);
    held = false;
    up = false;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      held = true;
      void record(pads()[i], el, () => up);
    }, HOLD_MS);
  });
  const end = () => {
    clearTimeout(timer);
    up = true;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointerleave", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("click", () => !held && hit(pads()[i], el));
});

// =================== зал ===================

const HALL_KEY = "sushhh.hall";
let hall = true;
try {
  hall = localStorage.getItem(HALL_KEY) !== "0";
} catch {
  // без хранилища зал включён
}
export const hallOn = () => hall;
export function setHall(on: boolean) {
  hall = on;
  try {
    localStorage.setItem(HALL_KEY, on ? "1" : "0");
  } catch {
    // настройка до перезагрузки
  }
}

const SYNTH = new Set<string>([...REACTIONS, ...MEMES]);
const AS: Record<string, Reaction> = { [RUMOR_YES]: "👏", [RUMOR_NO]: "🦗" };
const HALL_GAP_MS = 450; // чаще не звучим: зал — фон, а не хор

let hallPost: Post | null = null;
let hallAt = 0;
let hallLast = 0;

// prog — где сейчас запись (0..1); вызывается каждый кадр, пока она играет
export function hallTick(p: Post, prog: number) {
  // новая запись или перемотка назад — слушаем с этого места
  if (p !== hallPost || prog < hallAt - 0.02) {
    hallPost = p;
    hallAt = prog;
    return;
  }
  const from = hallAt;
  hallAt = prog;
  if (!hall) return;
  const due = p.moments.find((m) => !m.mine && m.at > from && m.at <= prog);
  const now = performance.now();
  if (!due || now - hallLast < HALL_GAP_MS) return;
  const synth = AS[due.emoji] ?? (SYNTH.has(due.emoji) ? (due.emoji as Reaction) : null);
  if (!synth) return; // звуки сообщества в зале не повторяем
  hallLast = now;
  const c = audioCtx();
  const g = c.createGain();
  g.gain.value = 0.22;
  g.connect(player.fx(1600));
  playReaction(synth, g);
  float(due.emoji, false, true);
}

// =================== клавиши памяти ===================

export function renderMemory() {
  document.querySelectorAll<HTMLElement>("[data-m]").forEach((b, i) => {
    const name = memory()[i];
    b.classList.toggle("set", !!name);
    if (name) b.style.setProperty("--hue", voiceColor(name));
    b.setAttribute("aria-label", name ? t("memAria", { n: i + 1, name }) : t("memEmptyAria", { n: i + 1 }));
  });
}

document.querySelectorAll<HTMLElement>("[data-m]").forEach((b, i) => {
  let timer = 0;
  let held = false;
  b.addEventListener("pointerdown", () => {
    held = false;
    clearTimeout(timer);
    // удержание — сохранить голос, который сейчас под стрелкой
    timer = window.setTimeout(() => {
      held = true;
      const it = cur();
      if (!it) return;
      if (it.post.mine) return toast(t("memSelf"));
      setMemory(i, it.post.author);
      renderMemory();
      click(0.12);
      toast(t("memSaved", { n: i + 1, name: it.post.author }));
    }, 500);
  });
  const end = () => clearTimeout(timer);
  b.addEventListener("pointerup", end);
  b.addEventListener("pointerleave", end);
  b.addEventListener("pointercancel", end);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  b.addEventListener("click", () => {
    if (held) return;
    click();
    const name = memory()[i];
    if (!name) return toast(t("memEmpty"));
    if (!tuneToAuthor(name)) toast(t("memSilent", { name }));
  });
});
renderMemory();
