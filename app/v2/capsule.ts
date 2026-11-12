// Прототип «капсула», тёмная версия: капсула — тёмное стекло, внутри со дна поднимается сияние голоса.
// Сияние рисует библиотека voice-glow (libraries.dev/voice). Эфир — полный спектр с розовым в центре,
// твой голос — зелёный. Записано: капсула сжимается, вокруг расходятся контуры.
// Отправка: лепестки собираются в один луч, и он ходит из стороны в сторону.
// Голоса — демо-записи из public/seed. Сервера нет: свои записи хранятся только на этом устройстве (store.ts).

import "@fontsource/inter-tight/300.css";
import "@fontsource/inter-tight/400.css";
import { createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { LOBE_SPAN, VoiceBeam } from "voice-glow";
import { audioCtx } from "../src/audio";
import { MEMES, REACTIONS, playReaction, type Reaction } from "../src/reactions";
import { MY_POSTS, ME, POSTS, esc, type Clip, type Post } from "./capsule-data";
import { deleteRec, loadRecs, pack, saveRec, toBuffer, type Meta } from "./store";
import { airFront, getTab, inboxCount, initScreens, openSheet, showTab, stepChannel, type Tab, type Target } from "./capsule-screens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const VOICES = POSTS;
// Цвет голоса: розовый — слушаешь, зелёный — говоришь. Им светятся отсвет на экране и контуры.
type RGB = [number, number, number];
const HOT: RGB = [255, 70, 120];
const LIVE: RGB = [60, 220, 130];
const maxRec = () => (target.kind === "post" ? 30 : 15); // пост — до 30 секунд, ответ — до 15

const ICON = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  thread: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 12a7.5 7.5 0 0 1-11.3 6.5L4.5 19.5l1.1-3.9A7.5 7.5 0 1 1 20 12z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

type State = "air" | "rec" | "review" | "sending" | "sent";
let state: State = "air";
let voice = 0;
let playing = false;
let paused = false; // эфир поставлен на паузу касанием — сам не продолжается
let target: Target = { kind: "reply", post: POSTS[0] }; // что записываем: ответ на голос или новый пост
let channelName = "Для тебя";
const liked = new Set<string>(); // голоса, на которые ты отреагировал, — по id: номер в ряду меняется
const heard = new Set<string>(); // что уже слушали — овал в сторис бледнеет

const stage = $("stage");

// iPhone, приложение с экрана «Домой»: там 100dvh короче экрана на высоту статус-бара, и снизу
// оставалась серая полоса. В этом режиме приложение всегда во весь экран — берём высоту экрана.
const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
function fitHeight() {
  if (!isIos || !standalone) return;
  const landscape = matchMedia("(orientation: landscape)").matches;
  const h = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  document.documentElement.style.setProperty("--app-h", `${h}px`);
}
fitHeight();
addEventListener("resize", fitHeight);

// =================== свечение (voice-glow) ===================

// тема: тёмная или светлая. По умолчанию — как в системе, выбор запоминается на устройстве
type Theme = "dark" | "light";
const THEME_KEY = "sushhh.proto.theme";
function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // без хранилища — по системе
  }
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
let theme = readTheme();
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f1f1ef" : "#0b0b0c");
}
applyTheme();
function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // не сохранится, но тема сменится сейчас
  }
  applyTheme();
  render();
}
// на белом стекле сияние мягче: без белой сердцевины и яркого гребня, иначе цвет выгорает
const glowLook = () => (theme === "light" ? { coreSize: 0.5, bandStrength: 0.8, brightness: 1, saturation: 1.2 } : {});

// лепестки сияния, от центра к краям. Эфир — полный спектр библиотеки с розовым в центре,
// твой голос — зелёный в центре и холодные соседи
const GLOW = {
  pink: ["#ff4678", "#3cbeff", "#af46ff", "#ff9628", "#ff6ad5", "#7a5cff", "#ffd03c"],
  green: ["#3cdc82", "#b4f03c", "#28c8b4", "#3cbeff", "#8ce63c", "#1ea0a0", "#e6f03c"],
};
const beamRoot = createRoot($("cap"));
let beamKey = "";
function paintBeam() {
  const key = state === "air" ? "pink" : "green";
  if (key + theme === beamKey) return;
  beamKey = key + theme;
  beamRoot.render(
    createElement(VoiceBeam, {
        type: "mobile",
        theme: "dark",
        ...glowLook(),
        colors: GLOW[key],
        // громкость считаем сами (эфир играет из буфера, не из потока), библиотека читает её каждый кадр
        level: () =>
          state === "sending" || state === "sent"
            ? 0.5
            : // в тишине капсула не гаснет: слабый свет медленно дышит на дне
              Math.max(level, calm ? 0.14 : 0.14 + 0.05 * Math.sin(performance.now() / 900)),
        // «летит…»: лепестки собраны в луч, он качается из стороны в сторону
        motion: () => (state === "sending" ? { gather: 1, offset: Math.sin(performance.now() / 380) * 0.7, stretch: 0.4, heldLevel: 0.6 } : null),
        scale: 1.7,
        reach: 3.4,
        rangeHeight: 1.5,
        idle: 0.55,
        hueRange: calm ? 0 : 10,
        flow: calm ? 0 : 48,
        attack: 0.12,
        release: 0.5,
        children: createElement("div", { className: "cap-fill" }),
      }),
  );
}

// =================== dock ===================

// Стеклянная панель разделов. Сияние собрано в луч под выбранным разделом, переезжает при смене
// и поднимается от громкости. Микрофон справа: в эфире это ответ на голос, который звучит, в «Моём» — новая запись.
// Новую запись из эфира начинает первый овал в ряду сторис.
const DOCK_SCALE = 0.7;
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "air", label: "Эфир", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.5" height="6.5" rx="2"/><rect x="16.5" y="13.5" width="4.5" height="6.5" rx="2"/></svg>' },
  { id: "mine", label: "Моё", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 13.5l2.6-8A1.5 1.5 0 0 1 8 4.5h8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/></svg>' },
];
const dockRoot = createRoot($("dock"));
let dockAt = 0; // где сейчас луч, в долях от −1 до 1 по ширине панели
function dockMotion() {
  const want = ((TABS.findIndex((t) => t.id === getTab()) + 0.5) / TABS.length - 0.5) * 2;
  dockAt += (want - dockAt) * (calm ? 1 : 0.16);
  const beam = $("dock").querySelector<HTMLElement>(".dock-beam");
  // библиотека сама растягивает сияние по ширине от громкости (--vb-w) — делим на это, чтобы луч не уезжал за раздел
  const widen = Number(beam?.getAttribute("style")?.match(/--vb-w-[^:]*:\s*([\d.]+)/)?.[1]) || 1;
  const px = (dockAt * (beam?.offsetWidth ?? 0)) / 2;
  return { gather: 1, offset: px / widen / ((LOBE_SPAN * DOCK_SCALE) / 2), stretch: Math.min(1, Math.abs(want - dockAt) * 2), heldLevel: 0.34 + level * 0.66 };
}
function paintDock() {
  const tab = getTab();
  const mic = tab === "air" ? "Ответить голосом" : "Записать новый голос";
  dockRoot.render(
    createElement(
      Fragment,
      null,
      createElement(VoiceBeam, {
        className: "dock-beam",
        type: "default",
        theme: "dark",
        ...glowLook(),
        colors: GLOW[tab === "mine" ? "green" : "pink"],
        scale: DOCK_SCALE,
        level: () => 0.34 + level * 0.66,
        motion: dockMotion,
        hueRange: calm ? 0 : 10,
        children: createElement(
          "div",
          { className: "dock-bar" },
          TABS.map((t) =>
            createElement(
              "button",
              { key: t.id, className: `dock-tab${t.id === tab ? " on" : ""}`, "aria-current": t.id === tab ? "page" : undefined, onClick: () => showTab(t.id) },
              createElement("span", {
                className: "dock-ico",
                dangerouslySetInnerHTML: { __html: t.icon + (t.id === "mine" && inboxCount() ? `<b class="badge">${inboxCount()}</b>` : "") },
              }),
              t.label,
            ),
          ),
        ),
      }),
      // микрофон — отдельное стекло со своим сиянием: зелёным, как твой голос, и со своим ритмом
      createElement(VoiceBeam, {
        className: "mic-beam",
        type: "pill",
        theme: "dark",
        ...glowLook(),
        colors: GLOW.green,
        borderRadius: 32,
        level: () => (calm ? 0.45 : 0.46 + 0.3 * Math.sin(performance.now() / 640) + 0.1 * Math.sin(performance.now() / 173)),
        hueRange: calm ? 0 : 14,
        children: createElement("button", {
        className: "main",
        "aria-label": mic,
        title: mic,
        onClick: () => void startRec(tab === "air" ? { kind: "reply", post: VOICES[voice] } : { kind: "post" }),
        dangerouslySetInnerHTML: { __html: ICON.mic },
      }),
      }),
    ),
  );
}

// =================== звук ===================

let ctx: AudioContext | undefined;
let analyser: AnalyserNode;
let wave: Float32Array<ArrayBuffer>;
function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    wave = new Float32Array(analyser.fftSize);
  }
  void ctx.resume();
  return ctx;
}

const buffers = new Map<string, Promise<AudioBuffer>>();
const load = (file: string) => {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}seed/${file}.m4a`)
      .then((r) => r.arrayBuffer())
      .then((b) => audio().decodeAudioData(b));
    buffers.set(file, p);
  }
  return p;
};

let src: AudioBufferSourceNode | undefined;
function silence() {
  if (src) {
    src.onended = null;
    src.stop();
    src.disconnect();
    src = undefined;
  }
  playing = false;
  ticket++;
}
let playingBuf: AudioBuffer | undefined; // что сейчас звучит
let startedAt = 0; // время контекста, соответствующее началу записи
function playBuffer(buf: AudioBuffer, onEnd: () => void, offset = 0) {
  silence();
  const c = audio();
  playingBuf = buf;
  startedAt = c.currentTime - offset;
  src = c.createBufferSource();
  src.buffer = buf;
  src.connect(analyser);
  analyser.connect(c.destination);
  src.onended = () => {
    src = undefined;
    playing = false;
    onEnd();
  };
  src.start(0, offset);
  playing = true;
}

// запись из листа (ветка, «Моё»): демо-файл или то, что записано в прототипе
let ticket = 0;
async function playClip(clip: Clip, onEnd: () => void) {
  silence();
  const my = ++ticket;
  if (!clip.buf && !clip.file) return void setTimeout(() => my === ticket && onEnd(), 900); // записано без микрофона — звука нет
  const buf = clip.buf ?? (await load(clip.file!));
  if (my === ticket) playBuffer(buf, onEnd);
}

async function playVoice(i: number, from = 0) {
  paused = false;
  const changed = (i + VOICES.length) % VOICES.length !== voice || !voiceBuf;
  voice = (i + VOICES.length) % VOICES.length;
  silence();
  if (changed) {
    voiceBuf = undefined;
    heldF = 0;
    if (anchor !== undefined) anchor = 0; // голос сменился — отмеченное место переезжает на начало нового
  }
  render();
  const mine = voice;
  const v = VOICES[voice];
  const buf = v.buf ?? (await load(v.file!)); // свой пост играет из записанного
  if (voice !== mine) return;
  if (changed || !wave2.childElementCount) setTrack(buf);
  if (state !== "air" || !airFront()) return;
  if (ctx!.state === "suspended") void ctx!.resume();
  passedF = from;
  playBuffer(buf, () => state === "air" && void playVoice(voice + 1), from * buf.duration);
  render();
  heard.add(VOICES[voice].id);
  const next = VOICES[(voice + 1) % VOICES.length];
  if (next.file) void load(next.file); // следующий — заранее
}

// пауза: место запоминаем, звук останавливаем; продолжение — с того же места
function togglePause() {
  if (playing && playingBuf === voiceBuf) {
    heldF = trackF();
    silence();
    paused = true;
    render();
  } else void playVoice(voice, heldF >= 0.999 ? 0 : heldF);
}
// эфир уходит с экрана (лист, «Моё», запись): звук стоп, место — запомнить
function stopAir() {
  if (playing && playingBuf === voiceBuf) heldF = trackF();
  silence();
}

// =================== дорожка ===================

// Стеклянная дорожка под овалом: волна голоса, бегунок, реакции на своих местах.
// Касание дорожки перематывает. Реакция закрепляется там, где ты её поставил, и когда запись
// доходит до этого места — звучит её звук и эмодзи взлетают потоком.
type Mark = { f: number; r: Reaction; mine?: boolean; at?: number };
const ALL_RX = [...REACTIONS, ...MEMES] as Reaction[];
// свет у каждой реакции свой — им подсвечены стекло, кромка и след при взлёте
const RX_COLOR: Record<string, string> = {
  "❤️": "#ff4678", "😂": "#ffc83c", "🤗": "#ff9628", "🔥": "#ff6a28", "😮": "#3cbeff", "👏": "#ffb43c",
  "🥁": "#e08a4c", "🎺": "#ffd03c", "🦗": "#3cdc82", "😱": "#3cbeff", "📯": "#ffb43c", "🎉": "#af46ff",
};
const rxColor = (r: string) => RX_COLOR[r] ?? "#ff4678";

// реакции других людей — по нескольку на каждый голос, на устойчивых местах
const marks = new Map<string, Mark[]>();
function marksFor(id: string): Mark[] {
  let list = marks.get(id);
  if (!list && id.startsWith("m")) marks.set(id, (list = [])); // свою запись ещё никто не слышал
  if (!list) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000;
    list = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({ f: 0.08 + rnd() * 0.84, r: REACTIONS[Math.floor(rnd() * REACTIONS.length)] }));
    marks.set(id, list);
  }
  return list;
}

const track = $("track");
const wave1 = $("wave");
const wave2 = $("waveLit");
const pins = $("pins");
let voiceBuf: AudioBuffer | undefined; // запись голоса на дорожке
let heldF = 0; // место на дорожке, когда звук не идёт
let passedF = 0; // докуда запись уже проиграна — от этого места ищем реакции, которые пора проиграть
let anchor: number | undefined; // куда встанет реакция, пока открыта панель
let scrubF: number | undefined; // палец ведёт по дорожке

// огибающая голоса: 56 столбиков
const envs = new WeakMap<AudioBuffer, number[]>();
function envelope(buf: AudioBuffer) {
  let env = envs.get(buf);
  if (!env) {
    const ch = buf.getChannelData(0);
    const n = 56;
    const step = Math.floor(ch.length / n);
    env = Array.from({ length: n }, (_, i) => {
      let sum = 0;
      for (let j = i * step; j < (i + 1) * step; j += 16) sum += ch[j] * ch[j];
      return Math.sqrt(sum / (step / 16));
    });
    const max = Math.max(...env, 1e-4);
    env = env.map((v) => 0.12 + 0.88 * Math.min(1, v / max));
    envs.set(buf, env);
  }
  return env;
}
function setTrack(buf: AudioBuffer) {
  voiceBuf = buf;
  const bars = envelope(buf).map((h) => `<i style="--h:${h.toFixed(2)}"></i>`).join("");
  wave1.innerHTML = wave2.innerHTML = bars;
  drawPins();
}
// где сейчас бегунок, 0..1
function trackF() {
  if (scrubF !== undefined) return scrubF;
  if (src && playingBuf && playingBuf === voiceBuf && ctx) return Math.min(1, Math.max(0, (ctx.currentTime - startedAt) / playingBuf.duration));
  return heldF;
}
function drawPins(fresh?: Mark) {
  const id = VOICES[voice].id;
  pins.innerHTML = marksFor(id)
    .map(
      (m, i) =>
        `<span class="pin${m.mine ? " mine" : ""}${m === fresh ? " new" : ""}" data-i="${i}" style="--x:${m.f.toFixed(4)};--ec:${rxColor(m.r)}">${m.r}</span>`,
    )
    .join("");
}
function seek(f: number) {
  f = Math.min(0.999, Math.max(0, f));
  heldF = f;
  passedF = f;
  if (trayOpen) anchor = f;
  if (voiceBuf) void playVoice(voice, f);
}
const fAt = (x: number) => {
  const r = track.getBoundingClientRect();
  return (x - r.left - 16) / (r.width - 32);
};
track.addEventListener("pointerdown", (e) => {
  if (state !== "air") return;
  track.setPointerCapture(e.pointerId);
  scrubF = Math.min(1, Math.max(0, fAt(e.clientX)));
});
track.addEventListener("pointermove", (e) => {
  if (scrubF !== undefined) scrubF = Math.min(1, Math.max(0, fAt(e.clientX)));
});
const endScrub = () => {
  if (scrubF === undefined) return;
  const f = scrubF;
  scrubF = undefined;
  seek(f);
};
track.addEventListener("pointerup", endScrub);
track.addEventListener("pointercancel", endScrub);
track.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    seek(trackF() + (e.key === "ArrowRight" ? 0.05 : -0.05));
  }
});

// точка на дорожке в координатах экрана — оттуда взлетают эмодзи
function trackPoint(f: number) {
  const r = track.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  return { x: r.left - sr.left + 16 + f * (r.width - 32), y: r.top - sr.top - 10 };
}

// Поток эмодзи как в стримах: каждый поднимается от места на дорожке, покачиваясь вбок,
// раздувается на старте и тает к концу. Свой — пачкой, чужие — по одному-два.
function stream(r: Reaction, f: number, count: number) {
  if (calm) return;
  const { x, y } = trackPoint(f);
  const rise = stage.clientHeight;
  for (let n = 0; n < count; n++) {
    setTimeout(() => {
      const el = document.createElement("span");
      el.className = "flyer";
      el.textContent = r;
      el.style.setProperty("--ec", rxColor(r));
      stage.append(el);
      const up = rise * (0.38 + Math.random() * 0.2);
      const amp = 10 + Math.random() * 18;
      const ph = Math.random() * Math.PI * 2;
      const big = 0.95 + Math.random() * 0.35;
      const kf: Keyframe[] = [];
      for (let k = 0; k <= 12; k++) {
        const p = k / 12;
        const sway = Math.sin(p * Math.PI * 2.4 + ph) * amp * Math.min(1, p * 3);
        const lift = up * (1 - (1 - p) ** 1.6);
        const sc = p < 0.12 ? 0.3 + (p / 0.12) * 0.95 * big : big * (1.25 - 0.3 * p);
        kf.push({
          transform: `translate(${(x + sway).toFixed(1)}px, ${(y - lift).toFixed(1)}px) translate(-50%, -50%) rotate(${(Math.sin(p * 7 + ph) * 14).toFixed(1)}deg) scale(${sc.toFixed(3)})`,
          opacity: p < 0.06 ? p / 0.06 : p > 0.68 ? Math.max(0, 1 - (p - 0.68) / 0.32) : 1,
        });
      }
      el.animate(kf, { duration: 2100 + Math.random() * 900, easing: "linear" }).finished.then(() => el.remove());
    }, n * 120);
  }
}

// Звук реакций идёт через общий движок приложения (src/audio). iPhone запускает звук только
// по касанию, поэтому будим движок первым же касанием экрана — иначе чужие реакции во время
// эфира молчали, пока не поставишь свою.
addEventListener("pointerdown", () => void audioCtx().resume(), { capture: true });

// звук чужих реакций тише голоса, свой — в полную силу
let quiet: GainNode | undefined;
function rxOut(soft: boolean) {
  const c = audioCtx();
  void c.resume();
  if (!soft) return c.destination;
  if (!quiet) {
    quiet = c.createGain();
    quiet.gain.value = 0.45;
    quiet.connect(c.destination);
  }
  return quiet;
}

// запись дошла до реакции — она звучит и взлетает
function pass(f: number) {
  if (!playing || state !== "air" || !voiceBuf) {
    passedF = f;
    return;
  }
  if (f < passedF) passedF = f;
  const now = performance.now();
  const list = marksFor(VOICES[voice].id);
  list.forEach((m, i) => {
    if (m.f > passedF && m.f <= f && !(m.at && now - m.at < 1500)) {
      playReaction(m.r, rxOut(!m.mine));
      stream(m.r, m.f, m.mine ? 2 : 1 + Math.round(Math.random()));
      const pin = pins.querySelector<HTMLElement>(`.pin[data-i="${i}"]`);
      pin?.classList.remove("ping");
      void pin?.offsetWidth;
      pin?.classList.add("ping");
    }
  });
  passedF = f;
}

// Запись. Голос снимается прямо из звукового графа (AudioWorklet, где его нет — ScriptProcessor)
// в память, без файла и расшифровки: Safari не всегда расшифровывает запись собственного
// MediaRecorder, и она выходила немой.
let mic: MediaStream | undefined;
let micNode: MediaStreamAudioSourceNode | undefined;
let tap: AudioWorkletNode | ScriptProcessorNode | undefined;
let sink: GainNode | undefined; // тап подключён к выходу через ноль — иначе браузер его не крутит
let pcm: Float32Array[] = [];
let take: AudioBuffer | undefined; // записанный голос
let recStart = 0;
let recLen = 0;

const TAP_CODE = `registerProcessor("tap", class extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
});`;
let tapReady: Promise<boolean> | undefined;
function loadTap(c: AudioContext) {
  tapReady ??= c.audioWorklet
    ? c.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP_CODE], { type: "text/javascript" }))).then(
        () => true,
        () => false,
      )
    : Promise.resolve(false);
  return tapReady;
}

// iOS: на время записи аудиосессия «запись», потом снова «воспроизведение». Без этого после
// микрофона звук уходит в разговорный динамик, а Web Audio глушит переключатель «без звука».
type Session = { type: string };
const session = (type: "playback" | "play-and-record") => {
  const s = (navigator as Navigator & { audioSession?: Session }).audioSession;
  if (s) s.type = type;
};
session("playback");

// короткое сообщение под именем автора: что пошло не так и что сделать
let notice = "";
let noticeTimer = 0;
function say(text: string) {
  notice = text;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice = "";
    render();
  }, 6000);
}

// Эффекты для своей записи. Считаются заранее целиком (OfflineAudioContext): то, что слышно
// при прослушивании, и уходит в эфир.
const FX = [
  { id: "none", name: "Без эффекта" },
  { id: "echo", name: "Эхо" },
  { id: "hall", name: "Зал" },
  { id: "low", name: "Ниже" },
  { id: "high", name: "Выше" },
  { id: "radio", name: "Радио" },
] as const;
type Fx = (typeof FX)[number]["id"];
let fx: Fx = "none";
let fxBuf: AudioBuffer | undefined; // запись с эффектом
const finalTake = () => fxBuf ?? take;

async function renderFx(buf: AudioBuffer, id: Fx): Promise<AudioBuffer> {
  if (id === "none") return buf;
  const rate = id === "low" ? 0.84 : id === "high" ? 1.22 : 1;
  const tail = id === "echo" ? 1.4 : id === "hall" ? 1.8 : 0;
  const sr = buf.sampleRate;
  const off = new OfflineAudioContext(1, Math.ceil((buf.duration / rate + tail) * sr), sr);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  let dry: AudioNode = src;
  if (id === "echo") {
    const delay = off.createDelay(1);
    delay.delayTime.value = 0.24;
    const back = off.createGain();
    back.gain.value = 0.38;
    const wet = off.createGain();
    wet.gain.value = 0.6;
    src.connect(delay);
    delay.connect(back).connect(delay);
    delay.connect(wet).connect(off.destination);
  } else if (id === "hall") {
    // зал: свёртка с затухающим шумом
    const len = Math.ceil(sr * 1.8);
    const ir = off.createBuffer(1, len, sr);
    const ch = ir.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    const conv = off.createConvolver();
    conv.buffer = ir;
    const wet = off.createGain();
    wet.gain.value = 0.45;
    src.connect(conv).connect(wet).connect(off.destination);
  } else if (id === "radio") {
    const hp = off.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 450;
    const lp = off.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const gain = off.createGain();
    gain.gain.value = 1.6;
    dry = src.connect(hp).connect(lp).connect(gain);
  }
  dry.connect(off.destination);
  src.start();
  return off.startRendering();
}

let fxTicket = 0;
async function pickFx(id: Fx) {
  if (!take) return;
  fx = id;
  silence();
  render();
  const my = ++fxTicket;
  const buf = await renderFx(take, id);
  if (my !== fxTicket || state !== "review") return;
  fxBuf = id === "none" ? undefined : buf;
  playBuffer(buf, render); // сразу даём услышать, что получилось
  render();
}

// Пока телефон спрашивает разрешение на микрофон, второе касание не должно открыть второй микрофон
let starting = false;
async function startRec(t: Target = target) {
  if (state === "rec" || starting) return;
  starting = true;
  try {
    await beginRec(t);
  } finally {
    starting = false;
  }
}
async function beginRec(t: Target) {
  target = t;
  stopAir();
  const c = audio();
  take = fxBuf = undefined;
  fx = "none";
  session("play-and-record");
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    session("playback");
    say(
      (e as Error)?.name === "NotAllowedError"
        ? "Нет доступа к микрофону — разреши его для этого сайта в настройках браузера"
        : "Микрофон недоступен на этом устройстве",
    );
    render();
    return;
  }
  await c.resume().catch(() => {}); // iOS приостанавливает звук, пока включается микрофон
  try {
    analyser.disconnect();
  } catch {
    // ещё не подключён
  }
  micNode = c.createMediaStreamSource(mic);
  micNode.connect(analyser);
  pcm = [];
  sink = c.createGain();
  sink.gain.value = 0;
  sink.connect(c.destination);
  if (await loadTap(c)) {
    const node = new AudioWorkletNode(c, "tap", { channelCount: 1, channelCountMode: "explicit" });
    node.port.onmessage = (e) => state === "rec" && pcm.push(e.data as Float32Array);
    tap = node;
  } else {
    const node = c.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => state === "rec" && pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    tap = node;
  }
  micNode.connect(tap);
  tap.connect(sink);
  recStart = performance.now();
  state = "rec";
  render();
}

// cancel — вышли крестиком: записанное выбрасываем молча
function stopRec(cancel = false) {
  if (state !== "rec") return;
  recLen = Math.min(maxRec(), (performance.now() - recStart) / 1000);
  micNode?.disconnect();
  tap?.disconnect();
  sink?.disconnect();
  if (tap instanceof AudioWorkletNode) tap.port.onmessage = null;
  mic?.getTracks().forEach((t) => t.stop());
  mic = micNode = tap = sink = undefined;
  session("playback");
  const chunks = pcm;
  pcm = [];
  if (cancel) {
    state = "air";
    return;
  }
  const c = audio();
  const total = chunks.reduce((n, a) => n + a.length, 0);
  let peak = 0;
  for (const a of chunks) for (let i = 0; i < a.length; i += 8) peak = Math.max(peak, Math.abs(a[i]));
  if (total < c.sampleRate * 0.3 || peak < 1e-4) {
    // звука нет: слишком коротко или микрофон отдал тишину
    state = "air";
    say(total < c.sampleRate * 0.3 ? "Слишком коротко — удерживай запись подольше" : "Микрофон молчит — проверь, не занят ли он другим приложением");
    render();
    return;
  }
  const buf = c.createBuffer(1, total, c.sampleRate);
  const ch = buf.getChannelData(0);
  let o = 0;
  for (const a of chunks) {
    ch.set(a, o);
    o += a.length;
  }
  take = buf;
  recLen = buf.duration;
  state = "review";
  render();
}

// записанное — на своё место: пост — в «Моё» и первым в эфир, ответ — в ветку голоса и в «Моё»
function place(rec: Meta, buf: AudioBuffer) {
  if (rec.kind === "post") {
    if (MY_POSTS.some((p) => p.id === rec.id)) return;
    const post: Post = { id: rec.id, name: ME, mine: true, buf, hook: rec.title, text: "", replies: [] };
    MY_POSTS.push(post);
    VOICES.unshift(post);
    voice++; // эфир остаётся на том же голосе
  } else {
    const to = [...VOICES, ...MY_POSTS].find((p) => p.id === rec.to);
    if (!to || to.replies.some((r) => r.id === rec.id)) return;
    to.replies.push({ id: rec.id, name: ME, mine: true, buf, text: rec.title });
  }
}

let saved = true; // получилось ли сохранить последнюю запись на устройстве
function send() {
  silence();
  state = "sending";
  render();
  const buf = finalTake()!;
  const rec: Meta = {
    id: `m${Date.now()}`,
    kind: target.kind,
    to: target.kind === "reply" ? target.post.id : undefined,
    title: target.kind === "reply" ? `Ответ для ${target.post.name} · ${fmt(buf.duration)}` : `Новая запись · ${fmt(buf.duration)}`,
    at: Date.now(),
  };
  const stored = pack(buf).then(
    (p) => saveRec({ ...rec, ...p }),
    () => false,
  );
  setTimeout(async () => {
    place(rec, buf);
    saved = await stored;
    state = "sent";
    render();
    setTimeout(() => {
      state = "air";
      void playVoice(voice + 1);
    }, 2600);
  }, 1500);
}

function backToAir() {
  if (state === "rec") stopRec(true);
  silence();
  state = "air";
  void playVoice(voice, heldF);
}

// удалить свою запись: из эфира, «Моё», веток и с устройства
async function removeRec(id: string) {
  const pi = VOICES.findIndex((p) => p.id === id);
  if (pi >= 0) {
    if (pi === voice) {
      silence();
      voiceBuf = undefined;
      heldF = 0;
    }
    VOICES.splice(pi, 1);
    if (pi < voice) voice--;
    voice = Math.min(voice, VOICES.length - 1);
  }
  const mi = MY_POSTS.findIndex((p) => p.id === id);
  if (mi >= 0) MY_POSTS.splice(mi, 1);
  for (const p of [...VOICES, ...MY_POSTS]) {
    const ri = p.replies.findIndex((r) => r.id === id);
    if (ri >= 0) p.replies.splice(ri, 1);
  }
  marks.delete(id);
  liked.delete(id);
  heard.delete(id);
  await deleteRec(id);
  render();
  showWave();
}

// волна текущего голоса на дорожке, даже пока он не играет
function showWave() {
  const v = VOICES[voice];
  const first = voice;
  void (v.buf ? Promise.resolve(v.buf) : load(v.file!)).then((b) => {
    if (!voiceBuf && voice === first) setTrack(b);
  });
}

// =================== экран ===================

const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

function setBtn(el: HTMLElement, icon: string, aria: string, show = true) {
  el.innerHTML = icon;
  el.setAttribute("aria-label", aria);
  el.hidden = !show;
}

// Ряд сторис пересоздаётся, только когда в нём что-то поменялось, и прокручивается к текущему
// голосу, только когда голос сменился: иначе любая перерисовка отбрасывала ряд, пока его листаешь.
let storiesKey = "";
let storiesOn = "";
function drawStories(hidden: boolean) {
  const box = $("stories");
  const key = hidden ? "" : `${voice}|${VOICES.map((p) => p.id + (heard.has(p.id) ? "+" : "")).join(",")}`;
  if (key === storiesKey) return;
  storiesKey = key;
  box.innerHTML = hidden
    ? ""
    : `<button class="st me" data-i="new" aria-label="Записать новый голос"><span class="oval">${ICON.plus}<span class="nm">ты</span></span></button>` +
      VOICES.map((p, i) => {
        const name = p.mine ? "ты" : esc(p.name);
        return `<button class="st${p.mine ? " mine" : ""}${i === voice ? " on" : heard.has(p.id) ? " heard" : ""}" data-i="${i}" aria-label="Слушать: ${p.mine ? "твою запись" : name}"${i === voice ? ' aria-current="true"' : ""}>
             <span class="oval"><span class="nm">${name}</span></span></button>`;
      }).join("");
  const id = hidden ? "" : VOICES[voice].id;
  if (!id || id === storiesOn) return;
  storiesOn = id;
  // прокрутка только самого ряда: scrollIntoView двигал бы и экран
  const on = box.querySelector<HTMLElement>(".on");
  if (!on) return;
  const br = box.getBoundingClientRect();
  const or = on.getBoundingClientRect();
  box.scrollTo({ left: box.scrollLeft + or.left - br.left - (br.width - or.width) / 2, behavior: calm ? "auto" : "smooth" });
}

function render() {
  paintBeam();
  paintDock();
  stage.classList.toggle("busy", state !== "air");
  $("bottom").classList.toggle("air", state === "air");
  const v = VOICES[voice];
  const main = $<HTMLButtonElement>("main");
  const replying = state !== "air";
  const air = state === "air";
  $("who").textContent = air ? v.name : target.kind === "post" ? "новая запись" : `ответ для ${target.post.name}`;
  $("chan").innerHTML = `${esc(channelName)} ${ICON.down}`;
  $("chan").hidden = !air;
  $("hook").textContent = replying ? "" : v.hook;
  drawStories(replying);
  if (voiceBuf === undefined) {
    wave1.innerHTML = wave2.innerHTML = "";
    drawPins();
  }
  setBtn($("back"), ICON.close, "Назад в эфир", state === "rec" || state === "review");
  if (state !== "review") $("leftl").textContent = $("rightl").textContent = "";
  // эффекты — только когда запись готова
  $("fx").innerHTML =
    state === "review" && take ? FX.map((f) => `<button class="fxb" data-fx="${f.id}" aria-pressed="${f.id === fx}">${f.name}</button>`).join("") : "";
  if (state !== "air") closeTray();
  main.disabled = state === "sending" || state === "sent";

  if (state === "air") {
    setBtn(main, ICON.mic, "Ответить голосом");
    $("label").textContent = "ответить";
    setBtn($("left"), ICON.heart, "Аудио-реакции");
    $("left").classList.toggle("on", liked.has(v.id));
    $("left").setAttribute("aria-expanded", String(trayOpen));
    setBtn($("right"), ICON.thread + (v.replies.length ? `<b class="badge">${v.replies.length}</b>` : ""), "Ветка ответов");
    $("hint").textContent = notice || (playing ? "" : paused ? "пауза — коснись, чтобы продолжить" : "коснись — и эфир заиграет");
  } else if (state === "rec") {
    setBtn(main, ICON.stop, "Остановить запись");
    $("label").textContent = "стоп";
    setBtn($("left"), "", "", false);
    setBtn($("right"), "", "", false);
    $("left").classList.remove("on");
  } else if (state === "review") {
    setBtn(main, ICON.send, "Опубликовать");
    $("label").textContent = "опубликовать";
    setBtn($("left"), ICON.again, "Переписать");
    $("left").classList.remove("on");
    setBtn($("right"), playing ? ICON.stop : ICON.play, playing ? "Остановить" : "Послушать", !!take);
    $("leftl").textContent = "переписать";
    $("rightl").textContent = !take ? "" : playing ? "стоп" : "послушать";
    $("hint").textContent = `${fmt(recLen)} · пока слышно только тебе`;
  } else {
    setBtn($("left"), "", "", false);
    setBtn($("right"), "", "", false);
    $("label").textContent = state === "sending" ? "летит…" : "в эфире";
    $("hint").textContent =
      state !== "sent"
        ? ""
        : // сервера пока нет: запись остаётся на этом телефоне, другим людям не уходит — так и говорим
          (target.kind === "post" ? "Сохранено: первой в эфире и в «Моё»" : `Ответ для ${target.post.name} сохранён: в ветке и в «Моё»`) +
          (saved ? " · другим людям пока не отправляется" : " · на устройстве сохранить не удалось");
  }
}

$("main").onclick = () => {
  if (state === "rec") stopRec();
  else if (state === "review") send();
};
$("left").onclick = () => {
  if (state === "air") {
    trayOpen ? closeTray() : openTray();
    render();
  } else if (state === "review") void startRec();
};
$("right").onclick = () => {
  if (state === "air") openSheet("thread", VOICES[voice]);
  else if (state === "review" && take) {
    if (playing) silence();
    else playBuffer(finalTake()!, render);
    render();
  }
};
$("back").onclick = backToAir;
$("fx").onclick = (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>(".fxb")?.dataset.fx as Fx | undefined;
  if (id) void pickFx(id);
};

// Аудио-эмодзи: сердце раскрывает панель со всеми реакциями и запоминает место на дорожке —
// туда встанет выбранная реакция. Касание дорожки, пока панель открыта, переставляет это место.
let trayOpen = false;
const tray = $("tray");
tray.innerHTML = ALL_RX.map(
  (r, i) => `<button class="rx" data-r="${r}" style="--i:${i};--ec:${rxColor(r)}" aria-label="Реакция ${r}"><span class="e">${r}</span></button>`,
).join("");
function openTray() {
  trayOpen = true;
  anchor = trackF();
  tray.classList.add("open");
}
function closeTray() {
  trayOpen = false;
  anchor = undefined;
  tray.classList.remove("open");
}
tray.onclick = (e) => {
  const r = (e.target as HTMLElement).closest<HTMLElement>(".rx")?.dataset.r as Reaction | undefined;
  if (!r) return;
  const f = anchor ?? trackF();
  const mark: Mark = { f, r, mine: true, at: performance.now() };
  marksFor(VOICES[voice].id).push(mark);
  playReaction(r, rxOut(false));
  stream(r, f, 5);
  drawPins(mark);
  liked.add(VOICES[voice].id);
  bump = 1;
  render();
};
$("chan").onclick = () => openSheet("channels");
$("stories").onclick = (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>(".st")?.dataset.i;
  if (i === "new") void startRec({ kind: "post" });
  else if (i !== undefined) void playVoice(Number(i));
};

initScreens({
  play: (clip, onEnd) => void playClip(clip, onEnd),
  stop: stopAir,
  record: (t) => void startRec(t),
  resume: () => state === "air" && !paused && void playVoice(voice, heldF),
  remove: removeRec,
  setChannel: (name) => {
    channelName = name;
    void playVoice(0);
  },
  refresh: render,
  theme: () => theme,
  toggleTheme,
});

// Главный экран управляется смахиванием: вверх и вниз — следующий и предыдущий голос, вбок — соседний канал,
// касание — пауза. Овал тянется за пальцем и влетает с той стороны, куда листали.
let down: { x: number; y: number } | undefined;
function flyIn(x: number, y: number) {
  if (calm) return;
  for (const el of stage.querySelectorAll<HTMLElement>(".cap, .halo"))
    el.animate([{ translate: `calc(-50% + ${x}px) calc(-50% + ${y}px)`, opacity: 0 }, {}], { duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" });
}
function drag(dx: number, dy: number) {
  stage.style.setProperty("--dx", `${dx}px`);
  stage.style.setProperty("--dy", `${dy}px`);
}
stage.addEventListener("pointerdown", (e) => {
  down = state !== "air" || (e.target as HTMLElement).closest("button, .sheet, .scrim, .page, .dock, .stories, .fx, .tray, .track") ? undefined : { x: e.clientX, y: e.clientY };
  if (down) stage.classList.add("dragging");
  if (trayOpen && !(e.target as HTMLElement).closest(".tray, #left, .track")) {
    closeTray();
    render();
  }
});
stage.addEventListener("pointermove", (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  const dy = e.clientY - down.y;
  // тянется по одной оси — той, по которой повели
  if (Math.abs(dx) > Math.abs(dy)) drag(dx * 0.4, 0);
  else drag(0, dy * 0.4);
});
function release(e: PointerEvent) {
  if (!down) return;
  const dx = e.clientX - down.x;
  const dy = e.clientY - down.y;
  down = undefined;
  stage.classList.remove("dragging");
  drag(0, 0);
  if (state !== "air" || e.type === "pointercancel") return;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
    flyIn(dx < 0 ? 120 : -120, 0);
    stepChannel(dx < 0 ? 1 : -1);
  } else if (Math.abs(dy) > 50) {
    flyIn(0, dy < 0 ? 140 : -140);
    void playVoice(voice + (dy < 0 ? 1 : -1));
  } else if (Math.hypot(dx, dy) < 10) togglePause();
}
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
// с клавиатуры: стрелки листают голоса и каналы, пробел — пауза. На кнопках и дорожке клавиши свои
document.addEventListener("keydown", (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (state !== "air" || !airFront() || t?.closest("button, input, textarea, .track, .sheet, .page")) return;
  if (e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key === "ArrowDown") void playVoice(voice + 1);
  else if (e.key === "ArrowUp") void playVoice(voice - 1);
  else if (e.key === "ArrowRight") stepChannel(1);
  else if (e.key === "ArrowLeft") stepChannel(-1);
});

// =================== кадр ===================

// текущие значения тянутся к целевым — отсюда мягкость: ничего не переключается рывком
const cur = { s: 0.7, b: 0.85, ring: 0, bg: 0.25, c: [...HOT] as RGB };
let level = 0; // громкость 0..1, сглаженная
let bump = 0; // короткий всплеск: сердце
let last = performance.now();

function loudness(t: number) {
  if (!ctx || (!playing && state !== "rec")) return 0;
  analyser.getFloatTimeDomainData(wave);
  let sum = 0;
  for (const x of wave) sum += x * x;
  return Math.min(1, Math.sqrt(sum / wave.length) * 4.5);
}

function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  const raw = loudness(t) * (calm ? 0.3 : 1);
  level += (raw - level) * (1 - Math.exp(-dt * (raw > level ? 22 : 6))); // растёт быстро, спадает плавно
  bump *= Math.exp(-dt * 5);

  // в тишине овал не замирает: медленно дышит
  const tg = { s: 0.7 + (calm ? 0 : 0.018 * Math.sin(t / 1100)), b: 0.85, ring: 0, bg: 0.25, c: HOT };
  if (state === "air" && playing) Object.assign(tg, { s: 0.76 + level * 0.28, b: 1, bg: 0.6 + level * 0.3 });
  if (state === "rec") Object.assign(tg, { s: 0.78 + level * 0.3, b: 1, bg: 0.7 + level * 0.3, c: LIVE });
  if (state === "review") Object.assign(tg, { s: 0.6 + level * 0.2, b: 1, ring: 1, bg: 0.5, c: LIVE });
  // запись улетает: лепестки собраны в луч
  if (state === "sending") Object.assign(tg, { s: 0.6, b: 1, bg: 0.9, c: LIVE });
  if (state === "sent") Object.assign(tg, { s: 0.5, b: 1, bg: 0.6 });

  const k = 1 - Math.exp(-dt * 7);
  const slow = 1 - Math.exp(-dt * 3.5);
  cur.s += (tg.s - cur.s) * (1 - Math.exp(-dt * 12));
  cur.b += (tg.b - cur.b) * k;
  cur.bg += (tg.bg - cur.bg) * k;
  cur.ring += (tg.ring - cur.ring) * slow;
  for (let i = 0; i < 3; i++) cur.c[i] += (tg.c[i] - cur.c[i]) * slow;

  const st = stage.style;
  if (state === "air") {
    const f = trackF();
    track.style.setProperty("--p", f.toFixed(4));
    track.style.setProperty("--a", String(anchor ?? -1));
    track.classList.toggle("anchoring", anchor !== undefined);
    track.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    if (scrubF === undefined) pass(f);
  }
  st.setProperty("--lv", level.toFixed(3));
  st.setProperty("--s", (cur.s + bump * 0.12).toFixed(4));
  st.setProperty("--b", cur.b.toFixed(3));
  st.setProperty("--bg", cur.bg.toFixed(3));
  st.setProperty("--ring", cur.ring.toFixed(3));
  st.setProperty("--c", `rgb(${cur.c.map(Math.round).join(" ")})`);

  if (state === "rec") {
    const sec = (t - recStart) / 1000;
    $("hint").textContent = `${fmt(sec)} / ${fmt(maxRec())}`;
    if (sec >= maxRec()) stopRec();
  }
  requestAnimationFrame(frame);
}

render();
// Service worker у сайта общий со старой версией, и обновляется он только с её согласия, чтобы
// не оборвать запись. v2 его не торопит: её страница не кэшируется, а скрипты с хэшем в имени
// и так берутся свежими.

// волна первого голоса видна сразу, ещё до первого касания
// свои записи с прошлых раз — обратно в эфир и в «Моё»; потом волна текущего голоса
void loadRecs()
  .then((recs) => recs.forEach((r) => place(r, toBuffer(r))))
  .finally(() => {
    showWave();
    render();
  });
requestAnimationFrame(frame);
