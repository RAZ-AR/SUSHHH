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
import { ASIDE, MY_POSTS, ME, POSTS, esc, type Clip, type Post } from "./capsule-data";
import { deleteRec, getRec, loadRecs, pack, saveRec, toBuffer, type Meta, type SaveResult } from "./store";
import { num, tr, trn, translateDom } from "./i18n";
import { t as t1 } from "../src/i18n";
import { block, report, unblock, hide, visible } from "./safety";
import { hasConsent } from "./privacy";
import { countListen, isMember, mayListen, refreshMember } from "./account";
import * as remote from "./remote";
import { audible, langOf, toggle as toggleLang } from "./langs";
import { keepFresh } from "./fresh";
import { cleanTitle } from "./title";
import { airFront, clearPlaying, openConsent, openJoin, openModerate, getTab, inboxCount, initScreens, openSheet, showTab, stepChannel, type Tab, type Target } from "./capsule-screens";

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
let channelName = tr("ch_foryou");
const liked = new Set<string>(); // голоса, на которые ты отреагировал, — по id: номер в ряду меняется
const heard = new Set<string>(); // что уже слушали — овал в сторис бледнеет

const stage = $("stage");
// название своего голоса: видно только перед публикацией
const nameEl = $<HTMLInputElement>("name");
nameEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") nameEl.blur(); // «Готово» на клавиатуре — спрятать её, публикует кнопка
});


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

// Чёткий режим — без прозрачности и с высоким контрастом. Включается сам, если в системе включено
// «Уменьшить прозрачность» или «Увеличить контраст», или кнопкой в «Моё»: Safari на iPhone не сообщает
// сайту про прозрачность, поэтому нужна и ручная кнопка. Выбор человека важнее системы
const SOLID_KEY = "sushhh.v2.solid";
const solidQuery = matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)");
function solidPref(): "on" | "off" | null {
  try {
    const v = localStorage.getItem(SOLID_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}
const isSolid = () => {
  const p = solidPref();
  return p ? p === "on" : solidQuery.matches;
};
function applySolid() {
  document.documentElement.toggleAttribute("data-solid", isSolid());
}
applySolid();
solidQuery.addEventListener("change", () => {
  applySolid();
  render();
});
function toggleSolid() {
  try {
    localStorage.setItem(SOLID_KEY, isSolid() ? "off" : "on");
  } catch {
    // не запомнится — но переключится сейчас
    document.documentElement.toggleAttribute("data-solid");
    return render();
  }
  applySolid();
  render();
}
function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // не сохранится, но тема сменится сейчас
  }
  applyTheme();
  if (voiceBuf) setTrack(voiceBuf); // бледная часть ленты — цветом текста новой темы
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
// В покое (эфир на паузе, ничего не записывается) сияние замирает на последнем кадре: оно рисуется
// на видеокарте каждый кадр и в покое тратило бы батарею впустую. Заиграл голос — оживает
const glowIdle = () => state === "air" && !playing;
function paintBeam() {
  const key = state === "air" ? "pink" : "green";
  const idle = glowIdle();
  if (`${key}${theme}${idle}` === beamKey) return;
  beamKey = `${key}${theme}${idle}`;
  beamRoot.render(
    createElement(VoiceBeam, {
        type: "mobile",
        paused: idle,
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
  { id: "air", label: tr("air"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.5" height="6.5" rx="2"/><rect x="16.5" y="13.5" width="4.5" height="6.5" rx="2"/></svg>' },
  { id: "mine", label: tr("mine"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 13.5l2.6-8A1.5 1.5 0 0 1 8 4.5h8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/></svg>' },
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
let dockKey = "";
function paintDock() {
  const tab = getTab();
  // док перерисовывается, только когда что-то в нём поменялось — а не при каждой перерисовке экрана
  const key = `${tab}|${inboxCount()}|${theme}|${glowIdle()}`;
  if (key === dockKey) return;
  dockKey = key;
  const mic = tr(tab === "air" ? "replyVoice" : "recordNew");
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
        paused: glowIdle(),
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

// Один звуковой движок на всё приложение — общий с реакциями (src/audio). Два движка на iPhone
// спорят за аудиосессию, и один из них может замолчать.
let ctx: AudioContext | undefined;
let analyser: AnalyserNode;
let wave: Float32Array<ArrayBuffer>;
function audio() {
  const c = audioCtx();
  if (ctx !== c) {
    ctx = c;
    analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    wave = new Float32Array(analyser.fftSize);
    ctxRunning = c.state === "running";
    c.addEventListener("statechange", onCtxState);
  }
  return c;
}

// Звонок, Siri, будильник или другое приложение отбирают звук: движок встаёт, а экран
// показывал бы «играет». Ставим честную паузу, запись останавливаем — записанное не пропадает.
let ctxRunning = false;
function onCtxState() {
  const running = ctx?.state === "running";
  const lost = ctxRunning && !running;
  ctxRunning = running;
  if (!lost) return;
  if (state === "rec") {
    stopRec();
    say(tr("recInterrupted"));
  } else if (elOn) {
    // голос играет через <audio> — Web Audio ему не нужен; iPhone усыпляет движок в фоне, а голос
    // при этом должен звучать дальше. Прерывания <audio> ловит его собственное событие pause
  } else if (state === "air" && playing && playingBuf === voiceBuf) {
    heldF = trackF();
    silence();
    paused = true;
    say(tr("soundInterrupted"));
  } else if (playing) {
    silence();
    clearPlaying(); // запись в листе или в «Моё» больше не «играет»
  }
  render();
}

// Расшифрованный голос занимает ≈6 МБ на 30 с — в памяти держим только несколько последних
// (текущий, следующий, предыдущий, тот, что играет в листе). Остальные расшифруем снова, если понадобятся.
const KEEP = 5;
const buffers = new Map<string, Promise<AudioBuffer>>();
function cached(key: string, make: () => Promise<AudioBuffer>) {
  let p = buffers.get(key);
  if (p) buffers.delete(key); // освежаем место в очереди
  else {
    p = make();
    // не загрузилось — не запоминаем, иначе голос молчал бы до перезагрузки
    const made = p;
    made.catch(() => buffers.get(key) === made && buffers.delete(key));
  }
  buffers.set(key, p);
  while (buffers.size > KEEP) buffers.delete(buffers.keys().next().value!);
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// обещание, которое не ответило за ms, считается неудачным — иначе зависшая загрузка не дала бы повторить
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer = 0;
  return Promise.race([p, new Promise<never>((_, reject) => (timer = window.setTimeout(() => reject(new Error("timeout")), ms)))]).finally(() =>
    clearTimeout(timer),
  );
}
const LOAD_MS = 15_000; // голос — до 1 МБ: столько хватает и на медленной сети
const DECODE_MS = 10_000;
// ответы, при которых повтор не поможет: файла нет или доступа к нему нет. 408 и 429 — временные, повторяем
const FINAL = new Set([400, 401, 403, 404, 410]);
// сеть моргнула, зависла или сервер ответил ошибкой — ещё две попытки с паузой
async function fetchBuf(url: string): Promise<AudioBuffer> {
  let err: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(700 * attempt);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), LOAD_MS);
    try {
      const r = await fetch(url, { signal: ac.signal });
      if (FINAL.has(r.status)) throw Object.assign(new Error(`HTTP ${r.status}`), { final: true });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.arrayBuffer();
      clearTimeout(timer);
      return await within(audio().decodeAudioData(data), DECODE_MS);
    } catch (e) {
      err = e;
      if ((e as { final?: boolean }).final) break; // файла нет — повтор не поможет
    } finally {
      clearTimeout(timer);
    }
  }
  throw err;
}

// звук записи: свежая (только что записанная), сохранённая на устройстве или демо-файл
function clipBuf(c: Clip): Promise<AudioBuffer> {
  if (c.buf) return Promise.resolve(c.buf);
  if (c.stored) {
    const id = c.id;
    return cached(`rec:${id}`, async () => {
      const rec = await getRec(id);
      if (!rec) throw new Error("no recording");
      return toBuffer(rec);
    });
  }
  // голос из общего эфира или демо-файл: скачать и расшифровать
  const url = c.url ?? (c.file ? `${import.meta.env.BASE_URL}seed/${c.file}.m4a` : "");
  if (url) return cached(url, () => fetchBuf(url));
  return Promise.reject(new Error("no audio"));
}
const hasAudio = (c: Clip) => !!(c.buf || c.stored || c.file || c.url);

// Голоса эфира и записи в листах играют через обычный <audio>, а не через Web Audio: iPhone не глушит
// его при блокировке экрана и в фоне, им управляют с экрана блокировки и наушников, и он начинает
// играть, пока файл ещё качается. Web Audio остаётся для записи, эффектов и короткого звука реакций.
// Свечение при этом движется по огибающей голоса — её считаем из расшифрованного звука для ленты.
const el = new Audio();
el.preload = "auto";
el.setAttribute("playsinline", "");
let elOn = false; // сейчас звучит <audio>
// длительность звучащего голоса: у WebM из MediaRecorder в файле её нет (el.duration = Infinity) —
// тогда берём из расшифрованного звука
const elDur = () => (isFinite(el.duration) && el.duration > 0 ? el.duration : (playingBuf?.duration ?? 0));
let ourPause = false; // паузу поставили мы, а не система (звонок, Siri, другое приложение)

// своя запись на телефоне — в WAV, чтобы её можно было отдать <audio>
const wavs = new WeakMap<AudioBuffer, string>();
function wavUrl(buf: AudioBuffer) {
  let url = wavs.get(buf);
  if (url) return url;
  const ch = buf.getChannelData(0);
  const data = new DataView(new ArrayBuffer(44 + ch.length * 2));
  const str = (o: number, t: string) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + ch.length * 2, true);
  str(8, "WAVEfmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, ch[i])) * 32767, true);
  url = URL.createObjectURL(new Blob([data.buffer], { type: "audio/wav" }));
  wavs.set(buf, url);
  return url;
}
// откуда играть: файл в эфире или демо — сразу по адресу; своя запись — из памяти
async function sourceOf(c: Clip): Promise<string> {
  if (c.url) return c.url;
  if (c.file) return `${import.meta.env.BASE_URL}seed/${c.file}.m4a`;
  return wavUrl(await clipBuf(c));
}

let src: AudioBufferSourceNode | undefined;
function silence() {
  if (src) {
    src.onended = null;
    src.stop();
    src.disconnect();
    src = undefined;
  }
  if (elOn) {
    ourPause = true;
    el.onended = el.onerror = null;
    el.pause();
    ourPause = false;
    elOn = false;
  }
  playing = false;
  ticket++;
}

// играть через <audio> с места from (0..1); buf — тот же голос расшифрованным, если уже есть
// onFail(true) — звук не сломан, его не дала включить система (iPhone без касания): нужно коснуться
function playEl(url: string, buf: AudioBuffer | undefined, onEnd: () => void, onFail: (blocked?: boolean) => void, from = 0) {
  silence();
  const my = ticket;
  if (el.src !== new URL(url, location.href).href || el.error) el.src = url;
  const seek = () => {
    if (from > 0 && elDur()) el.currentTime = from * elDur();
  };
  if (el.readyState >= 1) seek();
  else el.addEventListener("loadedmetadata", seek, { once: true });
  el.onended = () => {
    elOn = false;
    playing = false;
    onEnd();
  };
  el.onerror = () => {
    if (my !== ticket) return;
    elOn = false;
    playing = false;
    onFail();
  };
  playingBuf = buf;
  elOn = true;
  playing = true;
  void el.play().catch((e: Error) => {
    if (my !== ticket || e.name === "AbortError") return;
    elOn = false;
    playing = false;
    onFail(e.name === "NotAllowedError");
  });
}

// система остановила звук (звонок, Siri, наушники вынули) — честная пауза, касание продолжит
el.addEventListener("pause", () => {
  if (ourPause || !elOn || el.ended) return;
  elOn = false;
  playing = false;
  if (state === "air" && playingBuf === voiceBuf) {
    heldF = elDur() ? el.currentTime / elDur() : heldF;
    paused = true;
    say(tr("soundInterrupted"));
  } else clearPlaying();
  render();
});
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
async function playClip(clip: Clip, onEnd: () => void, onFail: () => void) {
  silence();
  const my = ++ticket;
  if (!hasAudio(clip)) return void setTimeout(() => my === ticket && onEnd(), 900); // записано без микрофона — звука нет
  const fail = () => {
    say(tr("clipFailed"));
    onFail();
  };
  try {
    const url = await sourceOf(clip);
    if (my === ticket) playEl(url, clip.buf, onEnd, fail);
  } catch {
    if (my === ticket) fail();
  }
}

// экран блокировки, наушники, часы: что играет и кнопки «пауза», «следующий», «предыдущий»
const ms = navigator.mediaSession;
function nowPlaying(v: Post) {
  if (!ms || typeof MediaMetadata === "undefined") return;
  ms.metadata = new MediaMetadata({
    title: v.hook,
    artist: v.mine ? tr("you") : v.name,
    album: "SUSHHH",
    artwork: [{ src: `${import.meta.env.BASE_URL}pwa-512x512.png`, sizes: "512x512", type: "image/png" }],
  });
}
if (ms) {
  const on = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      // действие не поддерживается этим браузером
    }
  };
  on("play", () => state === "air" && !playing && togglePause());
  on("pause", () => state === "air" && playing && togglePause());
  on("nexttrack", () => state === "air" && void playVoice(voice + 1));
  on("previoustrack", () => state === "air" && void playVoice(voice - 1));
  on("seekto", (d) => d.seekTime != null && elDur() > 0 && seek(d.seekTime / elDur()));
  el.addEventListener("play", () => (ms.playbackState = "playing"));
  el.addEventListener("pause", () => (ms.playbackState = "paused"));
  el.addEventListener("timeupdate", () => {
    const d = elDur();
    if (!ms.setPositionState || !d) return;
    try {
      ms.setPositionState({ duration: d, position: Math.min(el.currentTime, d), playbackRate: 1 });
    } catch {
      // граница записи — пропускаем
    }
  });
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
  const my = ticket;
  const v = VOICES[voice];
  // гость послушал 30 голосов в этом месяце — дальше после регистрации (уже слушанные — можно)
  if (!mayListen(v.id)) {
    paused = true;
    render();
    openJoin("limit");
    return;
  }
  // не загрузилось: пауза с подсказкой, касание пробует снова. Дальше не листаем —
  // без сети следующие голоса не загрузились бы так же
  const failed = (blocked = false) => {
    if (voice !== mine) return;
    paused = true;
    // не дали включить без касания — обычная пауза с «коснись», а не «не загрузился»
    if (blocked) render();
    else say(tr("voiceFailed"));
  };
  // лента рисуется по расшифрованному звуку; играет же <audio> сразу, не дожидаясь расшифровки
  const decoded = clipBuf(v).then(
    (buf) => {
      // тот же голос мог выпасть из памяти и расшифроваться заново — лента должна знать новый буфер
      if (voice === mine && (changed || buf !== voiceBuf || !tape)) setTrack(buf);
      if (elOn && voice === mine && !playingBuf) playingBuf = buf;
      return buf;
    },
    () => undefined,
  );
  let url: string;
  try {
    url = await sourceOf(v); // своя запись — из записанного на телефоне
  } catch {
    if (my === ticket) failed();
    return;
  }
  if (voice !== mine || my !== ticket) return; // пока готовились, переключили голос или включили другое
  if (state !== "air" || !airFront()) return;
  passedF = from;
  playEl(url, voiceBuf, () => state === "air" && void playVoice(voice + 1), failed, from);
  void decoded;
  nowPlaying(v);
  render();
  // прослушивание засчитывается на сервере один раз за запуск (и одно на человека — это решает сервер)
  if (v.remote && !heard.has(v.id)) remote.played(v.id);
  countListen(v.id);
  heard.add(VOICES[voice].id);
  const next = VOICES[(voice + 1) % VOICES.length];
  void clipBuf(next).catch(() => {}); // следующий — заранее
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
  // демо-реакции — только у демо-голосов; у своих и пришедших с сервера — настоящие, из эфира
  if (!list && !/^s\d+$/.test(id)) marks.set(id, (list = []));
  if (!list) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000;
    list = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({ f: 0.08 + rnd() * 0.84, r: REACTIONS[Math.floor(rnd() * REACTIONS.length)] }));
    marks.set(id, list);
  }
  return list;
}

// =================== лента голоса ===================

// Волна голоса — длинная лента, которая едет за стеклянным овалом справа налево. Звучит то место,
// что стоит в центре овала. Овал — линза: внутри лента крупнее и ярче, сыгранное светится цветом
// голоса, ещё не сыгранное бледное. Снаружи лента едва видна и тает к краям экрана.
// Рисуется на canvas: лента целиком готовится один раз на голос, а в кадре только сдвигается.
const track = $("track"); // лента снаружи: касание сбоку от овала перематывает, стрелки — тоже
const reelCv = $<HTMLCanvasElement>("reel");
const lensCv = $<HTMLCanvasElement>("lensReel");
const pinsLayer = $("pinsLayer");
const pinsTape = $("pinsTape");
const pins = $("pins");
let voiceBuf: AudioBuffer | undefined; // запись голоса на ленте
let heldF = 0; // место на ленте, когда звук не идёт
let passedF = 0; // докуда запись уже проиграна — от этого места ищем реакции, которые пора проиграть
let anchor: number | undefined; // куда встанет реакция, пока открыта панель
let scrubF: number | undefined; // палец ведёт ленту

const BPS = 10; // столбиков на секунду записи
const STEP = 6; // шаг столбика на ленте снаружи, px
const BAR = 3; // ширина столбика
const TAPE_H = 40; // высота волны снаружи
const LENS = 1.9; // во сколько раз овал увеличивает ленту
const RES = 4; // запас чёткости: в линзе столбики увеличены и на экранах 2× не должны мылиться

let tapeW = 0; // длина ленты голоса, px
let tape: { dim: HTMLCanvasElement; lit: HTMLCanvasElement } | undefined;
let tapeDrawn = ""; // что нарисовано сейчас — лишний раз не перерисовываем

// огибающая голоса: n столбиков 0..1
const envs = new WeakMap<AudioBuffer, Map<number, number[]>>();
function envelope(buf: AudioBuffer, n: number) {
  let byN = envs.get(buf);
  if (!byN) envs.set(buf, (byN = new Map()));
  let env = byN.get(n);
  if (!env) {
    const ch = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / n));
    const hop = Math.max(1, Math.floor(step / 64));
    env = Array.from({ length: n }, (_, i) => {
      let sum = 0;
      let k = 0;
      for (let j = i * step; j < (i + 1) * step && j < ch.length; j += hop, k++) sum += ch[j] * ch[j];
      return Math.sqrt(sum / Math.max(k, 1));
    });
    const max = Math.max(...env, 1e-4);
    env = env.map((v) => 0.1 + 0.9 * Math.min(1, v / max));
    byN.set(n, env);
  }
  return env;
}

// лента целиком, два вида: бледная (впереди) и светящаяся (сыграно). Цвет бледной — цвет текста темы
function paintTape(env: number[]) {
  const ink = getComputedStyle(stage).getPropertyValue("--ink").trim() || "#fff";
  const make = (fill: (g: CanvasRenderingContext2D) => string | CanvasGradient) => {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(tapeW * RES);
    cv.height = Math.ceil(TAPE_H * RES);
    const g = cv.getContext("2d")!;
    g.scale(RES, RES);
    g.fillStyle = fill(g);
    env.forEach((h, i) => {
      const bh = Math.max(2, h * TAPE_H);
      g.beginPath();
      g.roundRect(i * STEP + (STEP - BAR) / 2, (TAPE_H - bh) / 2, BAR, bh, BAR / 2);
      g.fill();
    });
    return cv;
  };
  tape = {
    dim: make(() => ink),
    lit: make((g) => {
      const gr = g.createLinearGradient(0, TAPE_H, 0, 0);
      gr.addColorStop(0, "#ff4678");
      gr.addColorStop(1, "#af46ff");
      return gr;
    }),
  };
  tapeDrawn = "";
}

function setTrack(buf: AudioBuffer) {
  voiceBuf = buf;
  const env = envelope(buf, Math.max(24, Math.round(buf.duration * BPS)));
  tapeW = env.length * STEP;
  paintTape(env);
  track.dataset.bars = String(env.length);
  pinsTape.style.setProperty("--W", `${tapeW}px`);
  drawPins();
}
function clearTrack() {
  tape = undefined;
  tapeDrawn = "";
  delete track.dataset.bars;
  drawPins();
}

// canvas под размер на экране (с учётом плотности пикселей)
function fit(cv: HTMLCanvasElement) {
  const d = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) {
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    tapeDrawn = "";
  }
  const g = cv.getContext("2d")!;
  g.setTransform(d, 0, 0, d, 0, 0);
  return { g, w, h };
}
// лента в окне: место f — в центре, слева от центра сыграно (светится), справа впереди (бледно)
function drawTape(cv: HTMLCanvasElement, f: number, k: number, dim: number, lit: number) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  if (!tape || !w) return;
  const cx = w / 2;
  const W = tapeW * k;
  const H = TAPE_H * k;
  const x0 = cx - f * W;
  const y0 = (h - H) / 2;
  g.save();
  g.beginPath();
  g.rect(0, 0, cx, h);
  g.clip();
  g.globalAlpha = lit;
  g.drawImage(tape.lit, x0, y0, W, H);
  g.restore();
  g.save();
  g.beginPath();
  g.rect(cx, 0, w - cx, h);
  g.clip();
  g.globalAlpha = dim;
  g.drawImage(tape.dim, x0, y0, W, H);
  g.restore();
}
// кадр ленты: снаружи и в линзе; реакции едут вместе с ней
function moveTape(f: number, s: number) {
  const key = `${f.toFixed(5)}|${s.toFixed(3)}|${tapeW}|${!!tape}`;
  if (key === tapeDrawn) return;
  tapeDrawn = key;
  const light = theme === "light";
  drawTape(reelCv, f, 1, light ? 0.22 : 0.18, light ? 0.55 : 0.5);
  // овал сам уменьшен до --s, поэтому увеличение внутри — LENS / s: на экране лента всегда крупнее в LENS раз
  drawTape(lensCv, f, LENS / s, light ? 0.5 : 0.42, 1);
  pinsTape.style.transform = `translateX(${(-f * tapeW).toFixed(1)}px)`;
}

// где сейчас звучит, 0..1
function trackF() {
  if (scrubF !== undefined) return scrubF;
  if (elOn && playingBuf === voiceBuf && elDur()) return Math.min(1, el.currentTime / elDur());
  if (src && playingBuf && playingBuf === voiceBuf && ctx) return Math.min(1, Math.max(0, (ctx.currentTime - startedAt) / playingBuf.duration));
  return heldF;
}
function drawPins(fresh?: Mark) {
  const id = VOICES[voice].id;
  pins.innerHTML = !tape
    ? ""
    : marksFor(id)
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
const clampF = (f: number) => Math.min(1, Math.max(0, f));
// Лента под пальцем: касание сбоку от овала — перемотать к этому месту ленты; протяжка — тянуть ленту,
// как плёнку: повёл вправо — назад, влево — вперёд. Середину ленты закрывает овал, там жесты эфира
let tug: { x: number; f: number; moved: boolean } | undefined;
track.addEventListener("pointerdown", (e) => {
  if (state !== "air" || !tapeW) return;
  track.setPointerCapture(e.pointerId);
  tug = { x: e.clientX, f: trackF(), moved: false };
});
track.addEventListener("pointermove", (e) => {
  if (!tug) return;
  const dx = e.clientX - tug.x;
  if (Math.abs(dx) > 6) tug.moved = true;
  if (tug.moved) scrubF = clampF(tug.f - dx / tapeW);
});
track.addEventListener("pointerup", (e) => {
  if (!tug) return;
  const r = track.getBoundingClientRect();
  const f = tug.moved ? scrubF ?? tug.f : tug.f + (e.clientX - (r.left + r.width / 2)) / tapeW;
  tug = undefined;
  scrubF = undefined;
  seek(f);
});
track.addEventListener("pointercancel", () => {
  tug = undefined;
  scrubF = undefined;
});
track.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    seek(trackF() + (e.key === "ArrowRight" ? 0.05 : -0.05));
  }
});

// место на ленте реакций в координатах экрана — оттуда взлетают эмодзи
function trackPoint(f: number) {
  const r = pinsLayer.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  return { x: r.left - sr.left + r.width / 2 + (f - trackF()) * tapeW, y: r.top - sr.top + 30 - 10 };
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
  render(); // показать сразу, а не при следующей перерисовке
}

// Эффекты для своей записи. Считаются заранее целиком (OfflineAudioContext): то, что слышно
// при прослушивании, и уходит в эфир.
const FX = [
  { id: "none" },
  { id: "echo" },
  { id: "hall" },
  { id: "low" },
  { id: "high" },
  { id: "radio" },
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
  // записывать и отвечать могут только зарегистрированные; гостю — лист регистрации
  if (!isMember()) return openJoin("record");
  // первая запись — сначала согласие и возраст; согласился — запись начнётся из листа
  if (!hasConsent()) return openConsent(t);
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
        ? tr("micDenied")
        : tr("micUnavailable"),
    );
    render();
    return;
  }
  await c.resume().catch(() => {}); // iOS приостанавливает звук, пока включается микрофон
  const tapped = await loadTap(c);
  // пока спрашивали микрофон и готовили звук, приложение могли свернуть или микрофон отключиться —
  // тогда не начинаем: иначе микрофон писал бы в фоне
  if (document.visibilityState === "hidden" || mic.getAudioTracks().some((tr) => tr.readyState === "ended")) {
    mic.getTracks().forEach((tr) => tr.stop());
    mic = undefined;
    session("playback");
    render();
    return;
  }
  try {
    analyser.disconnect();
  } catch {
    // ещё не подключён
  }
  // микрофон отключился совсем — останавливаемся, записанное остаётся. Кратковременное «mute» запись
  // не прерывает: в это время пишется тишина, а звонок и Siri ловит onCtxState
  for (const tr of mic.getAudioTracks()) tr.onended = () => micLost();
  micNode = c.createMediaStreamSource(mic);
  micNode.connect(analyser);
  pcm = [];
  sink = c.createGain();
  sink.gain.value = 0;
  sink.connect(c.destination);
  if (tapped) {
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
  // лимит — отдельным таймером: кадры анимации при заблокированном экране не идут
  clearTimeout(recTimer);
  recTimer = window.setTimeout(() => stopRec(), maxRec() * 1000);
  render();
}

let recTimer = 0;
function micLost() {
  if (state !== "rec") return;
  stopRec();
  if ((state as State) === "review") say(tr("micLost"));
  render();
}
// приложение свернули или заблокировали экран во время записи — заканчиваем её: записанное ждёт в просмотре
const leave = () => document.visibilityState === "hidden" && micLost();
document.addEventListener("visibilitychange", leave);
addEventListener("pagehide", () => micLost());

// cancel — вышли крестиком: записанное выбрасываем молча
function stopRec(cancel = false) {
  if (state !== "rec") return;
  clearTimeout(recTimer);
  recLen = Math.min(maxRec(), (performance.now() - recStart) / 1000);
  for (const tr of mic?.getAudioTracks() ?? []) tr.onended = null;
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
  // таймер лимита мог сработать с опозданием — лишнее обрезаем, запись не длиннее 30/15 с
  const total = Math.min(
    chunks.reduce((n, a) => n + a.length, 0),
    Math.round(maxRec() * c.sampleRate),
  );
  let peak = 0;
  for (const a of chunks) for (let i = 0; i < a.length; i += 8) peak = Math.max(peak, Math.abs(a[i]));
  if (total < c.sampleRate * 0.3 || peak < 1e-4) {
    // звука нет: слишком коротко или микрофон отдал тишину
    state = "air";
    say(tr(total < c.sampleRate * 0.3 ? "tooShort" : "micSilent"));
    render();
    return;
  }
  const buf = c.createBuffer(1, total, c.sampleRate);
  const ch = buf.getChannelData(0);
  let o = 0;
  for (const a of chunks) {
    if (o >= total) break;
    const part = a.length > total - o ? a.subarray(0, total - o) : a;
    ch.set(part, o);
    o += part.length;
  }
  take = buf;
  recLen = buf.duration;
  state = "review";
  render();
}

// записанное — на своё место: пост — в «Моё» и первым в эфир, ответ — в ветку голоса и в «Моё»
// sound — сохранённая на устройстве (stored: в памяти не держится, расшифруется при игре)
// или несохранённая (buf: держим в памяти, иначе она пропала бы)
function place(rec: Meta, sound: Pick<Clip, "buf" | "stored">) {
  if (rec.kind === "post") {
    if (MY_POSTS.some((p) => p.id === rec.id)) return;
    const post: Post = { id: rec.id, name: ME, mine: true, ...sound, hook: rec.title, text: "", replies: [] };
    MY_POSTS.push(post);
    VOICES.unshift(post);
    voice++; // эфир остаётся на том же голосе
  } else {
    const to = [...VOICES, ...MY_POSTS].find((p) => p.id === rec.to);
    if (!to || to.replies.some((r) => r.id === rec.id)) return;
    to.replies.push({ id: rec.id, name: ME, mine: true, ...sound, text: rec.title });
  }
}

let saved: SaveResult = "ok"; // получилось ли сохранить последнюю запись на устройстве
function send() {
  if (state !== "review" || !take) return; // второе касание, пока запись улетает
  silence();
  state = "sending";
  render();
  const buf = finalTake()!;
  const caption = cleanTitle(nameEl.value);
  nameEl.value = "";
  nameEl.blur();
  const rec: Meta = {
    id: `m${Date.now()}`,
    kind: target.kind,
    to: target.kind === "reply" ? target.post.id : undefined,
    publish: true, // в общий эфир — с согласия, данного уже для сервера
    // без названия в «Моё» видна служебная подпись, а в эфир голос уходит без подписи:
    // «Новая запись · 0:12» на языке автора другим людям ничего не говорит
    title: caption || (target.kind === "reply" ? tr("titleReply", { name: target.post.name, dur: fmt(buf.duration) }) : tr("titleNew", { dur: fmt(buf.duration) })),
    caption: caption || undefined,
    at: Date.now(),
  };
  const stored = pack(buf).then(
    (p) => saveRec({ ...rec, ...p }),
    (): SaveResult => "fail",
  );
  setTimeout(async () => {
    saved = await stored;
    if (saved === "ok") {
      // сохранено — звук в общей очереди памяти: отсюда он вытеснится, как остальные, и прочитается с устройства
      void cached(`rec:${rec.id}`, () => Promise.resolve(buf));
      place(rec, { stored: true });
      void remote.flush(); // в общий эфир; без сети — дождётся её
    } else {
      place(rec, { buf });
      void remote.sendNow(rec, buf); // на устройстве не сохранилась — отправляем из памяти
    }
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
  nameEl.value = ""; // запись отменили — название к ней тоже
  nameEl.blur();
  silence();
  state = "air";
  void playVoice(voice, heldF);
}

// удалить свою запись: из эфира, «Моё», веток и с устройства
async function removeRec(id: string) {
  // у своего поста могли быть и свои ответы — без поста их не найти, поэтому удаляем и их
  const own = [...VOICES, ...MY_POSTS].find((p) => p.id === id);
  const orphans = own?.replies.filter((r) => r.mine && (r.stored || r.buf)).map((r) => r.id) ?? [];
  for (const rid of orphans) {
    buffers.delete(`rec:${rid}`);
    marks.delete(rid);
    await deleteRec(rid);
  }
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
  buffers.delete(`rec:${id}`);
  liked.delete(id);
  heard.delete(id);
  await remote.unpublish(id); // из общего эфира — если уже ушла
  await deleteRec(id);
  render();
  showWave();
}

// волна текущего голоса на дорожке, даже пока он не играет
function showWave() {
  const v = VOICES[voice];
  const first = voice;
  void clipBuf(v).then(
    (b) => {
      if (!voiceBuf && voice === first) setTrack(b);
    },
    () => {}, // волны не будет, пока голос не загрузится при игре
  );
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
// что видно на овале голоса: сколько послушали, сколько ответов и какие эмоции чаще всего
const STAT_ICON = {
  plays: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  replies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a7.5 7.5 0 0 1-11.3 6.5L4.5 19.5l1.1-3.9A7.5 7.5 0 1 1 20 12z"/></svg>',
};
function statsOf(p: Post) {
  const plays = (p.plays ?? 0) + (heard.has(p.id) ? 1 : 0); // демо-число + твоё прослушивание
  const counts = new Map<string, number>();
  for (const m of marksFor(p.id)) counts.set(m.r, (counts.get(m.r) ?? 0) + 1);
  const emo = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { plays, replies: p.replies.length, emo };
}
function storyStats(p: Post) {
  const st = statsOf(p);
  const emo = st.emo.map(([r, n]) => `<span>${r}<b>${num(n)}</b></span>`).join("");
  const line = `<span class="stats"><span>${STAT_ICON.plays}${num(st.plays)}</span>${st.replies ? `<span>${STAT_ICON.replies}${num(st.replies)}</span>` : ""}</span>`;
  const label = [trn("plays", st.plays), st.replies ? trn("replies", st.replies) : "", st.emo.length ? tr("reactionsOf", { list: st.emo.map(([r, n]) => `${r} ${n}`).join(", ") }) : ""]
    .filter(Boolean)
    .join(", ");
  return { html: line + (emo ? `<span class="emo">${emo}</span>` : ""), label };
}

function drawStories(hidden: boolean) {
  const box = $("stories");
  const key = hidden
    ? ""
    : `${voice}|${VOICES.map((p) => `${p.id}${heard.has(p.id) ? "+" : ""}${p.replies.length}.${marksFor(p.id).length}`).join(",")}`;
  if (key === storiesKey) return;
  storiesKey = key;
  box.innerHTML = hidden
    ? ""
    : `<button class="st me" data-i="new" aria-label="${tr("recordNew")}"><span class="oval">${ICON.plus}<span class="nm">${tr("you")}</span></span></button>` +
      VOICES.map((p, i) => {
        const name = p.mine ? tr("you") : esc(p.name);
        const st = storyStats(p);
        const aria = `${tr("listenTo", { name: p.mine ? tr("yourRecording") : name })}. ${st.label}`;
        return `<button class="st${p.mine ? " mine" : ""}${i === voice ? " on" : heard.has(p.id) ? " heard" : ""}" data-i="${i}" aria-label="${aria}"${i === voice ? ' aria-current="true"' : ""}>
             <span class="oval"><span class="nm">${name}</span>${st.html}</span></button>`;
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
  $("who").textContent = air ? v.name : target.kind === "post" ? tr("newRecording") : tr("replyTo", { name: target.post.name });
  // «⋯» у чужого голоса: скрыть, пожаловаться, заблокировать
  const more = $("more");
  more.hidden = !air || !!v.mine;
  more.setAttribute("aria-label", `${t1("more")}: ${v.name}`);
  $("chan").innerHTML = `${esc(channelName)} ${ICON.down}`;
  $("chan").hidden = !air;
  $("hook").textContent = replying ? "" : v.hook;
  nameEl.hidden = state !== "review";
  nameEl.placeholder = tr(target.kind === "post" ? "nameVoice" : "nameReply");
  nameEl.setAttribute("aria-label", nameEl.placeholder);
  drawStories(replying);
  if (voiceBuf === undefined) {
    clearTrack();
  }
  setBtn($("back"), ICON.close, tr("back"), state === "rec" || state === "review");
  if (state !== "review") $("leftl").textContent = $("rightl").textContent = "";
  // эффекты — только когда запись готова
  $("fx").innerHTML =
    state === "review" && take ? FX.map((f) => `<button class="fxb" data-fx="${f.id}" aria-pressed="${f.id === fx}">${tr(`fx_${f.id}`)}</button>`).join("") : "";
  if (state !== "air") closeTray();
  main.disabled = state === "sending" || state === "sent";

  if (state === "air") {
    setBtn(main, ICON.mic, tr("replyVoice"));
    $("label").textContent = tr("replyLabel");
    setBtn($("left"), `${ICON.heart}<span>${tr("reaction")}</span>`, tr("audioReactions"));
    $("left").classList.toggle("on", liked.has(v.id));
    $("left").setAttribute("aria-expanded", String(trayOpen));
    setBtn($("right"), `${ICON.thread}<span>${tr("repliesBtn")}</span>` + (v.replies.length ? `<b class="badge">${num(v.replies.length)}</b>` : ""), tr("thread"));
    $("hint").textContent = notice || (playing ? "" : tr(paused ? "hintPaused" : "hintTap"));
    $("srPrev").textContent = tr("prevVoice");
    $("srNext").textContent = tr("nextVoice");
    $("srPlay").textContent = tr(playing ? "pauseVoice" : "playVoice");
  } else if (state === "rec") {
    setBtn(main, ICON.stop, tr("stopRec"));
    $("label").textContent = tr("stop");
    setBtn($("left"), "", "", false);
    setBtn($("right"), "", "", false);
    $("left").classList.remove("on");
  } else if (state === "review") {
    setBtn(main, ICON.send, tr("publishBtn"));
    $("label").textContent = tr("publish");
    setBtn($("left"), ICON.again, tr("redoBtn"));
    $("left").classList.remove("on");
    setBtn($("right"), playing ? ICON.stop : ICON.play, tr(playing ? "stopPlayBtn" : "listenBtn"), !!take);
    $("leftl").textContent = tr("redo");
    $("rightl").textContent = !take ? "" : tr(playing ? "stop" : "listen");
    $("hint").textContent = notice || tr("onlyYou", { dur: fmt(recLen) });
  } else {
    setBtn($("left"), "", "", false);
    setBtn($("right"), "", "", false);
    $("label").textContent = tr(state === "sending" ? "flying" : "onAir");
    $("hint").textContent =
      state !== "sent"
        ? ""
        : // сервера пока нет: запись остаётся на этом телефоне, другим людям не уходит — так и говорим
          (target.kind === "post" ? tr("savedPost") : tr("savedReply", { name: target.post.name })) +
          (saved === "ok" ? tr(remote.isLive() ? "sending" : "queued") : tr(saved === "full" ? "noSpace" : "saveFailed"));
  }
}

$("main").onclick = () => {
  if (state === "rec") stopRec();
  else if (state === "review") send();
};
$("left").onclick = () => {
  if (state === "air") {
    if (trayOpen) closeTray();
    else openTray();
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
  (r, i) => `<button class="rx" data-r="${r}" style="--i:${i};--ec:${rxColor(r)}" aria-label="${tr("reactionX", { r })}"><span class="e">${r}</span></button>`,
).join("");
function openTray() {
  // реакции — после регистрации: гость только слушает
  if (!isMember()) return openJoin("react");
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
  // в общий эфир: другие увидят реакцию на этом месте записи
  seenRx.add(rxKey(VOICES[voice].id, remote.uid(), r, f));
  remote.react(VOICES[voice].id, r, f);
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

// =================== безопасность ===================

// Скрытое, пожалованное и голоса заблокированных авторов убираются из эфира и веток сразу.
// Убранное помним, чтобы «вернуть» автора без перезагрузки.
const removed: { clip: Clip; parent?: Post }[] = [];
function applySafety() {
  const was = VOICES[voice];
  const wasPlaying = playing && playingBuf === voiceBuf;
  for (let i = VOICES.length - 1; i >= 0; i--) {
    // последний голос не убираем: пустой эфир сломал бы экран; он уйдёт, когда появятся другие
    if (shown(VOICES[i]) || VOICES.length === 1) continue;
    removed.push({ clip: VOICES[i] });
    ASIDE.push(VOICES.splice(i, 1)[0]);
    if (i < voice) voice--;
  }
  for (const p of [...VOICES, ...MY_POSTS])
    for (let j = p.replies.length - 1; j >= 0; j--)
      if (!shown(p.replies[j])) removed.push({ clip: p.replies.splice(j, 1)[0], parent: p });
  voice = Math.max(0, Math.min(voice, VOICES.length - 1));
  storiesKey = "";
  if (VOICES[voice] !== was) {
    // звучавший голос убран — без паузы переходим к следующему
    silence();
    voiceBuf = undefined;
    heldF = 0;
    if (wasPlaying && state === "air") void playVoice(voice);
    else showWave();
  }
  render();
}
// в эфире: не скрыт, автор не в блоке, язык голоса выбран (или не отмечен); свои — всегда
const shown = (c: Clip) => visible(c) && (c.mine || audible(c.lang));
// вернуть то, что снова можно слышать: разблокировали автора или включили язык
function restoreShown() {
  for (let i = removed.length - 1; i >= 0; i--) {
    const { clip, parent } = removed[i];
    if (!shown(clip)) continue;
    if (parent) parent.replies.push(clip);
    else {
      VOICES.push(clip as Post);
      ASIDE.splice(ASIDE.indexOf(clip as Post), 1);
    }
    removed.splice(i, 1);
  }
  storiesKey = "";
  render();
}

// =================== общий эфир ===================

// голоса с сервера встают в эфир, ответы — в ветки, реакции — на свои места на ленте
const seenRx = new Set<string>();
const rxKey = (post: string, user: string | null, emoji: string, at: number) => `${post}|${user}|${emoji}|${at.toFixed(3)}`;
const findAny = (id: string): Clip | undefined => {
  for (const p of [...VOICES, ...ASIDE, ...MY_POSTS]) {
    if (p.id === id) return p;
    const r = p.replies.find((x) => x.id === id);
    if (r) return r;
  }
};
// подпись голоса — первая фраза расшифровки или подписи, обрезанная по слову
function hookOf(text: string | null) {
  const t = text?.trim();
  if (!t) return tr("untitled");
  const first = t.split(/(?<=[.!?…])\s/)[0];
  return first.length <= 52 ? first.replace(/[.,;:]$/, "") : first.slice(0, 52).replace(/\s+\S*$/, "") + "…";
}
const REAL_ENOUGH = 5; // живых голосов хватает на эфир — демо-записи убираем, чтобы не путать

function mergeRemote(d: remote.Incoming) {
  const me = remote.uid();
  const was = VOICES[voice];
  const fresh: Post[] = [];
  for (const r of [...d.posts].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    const known = findAny(r.id);
    if (known) {
      if (r.plays != null) (known as Post).plays = r.plays;
      continue;
    }
    const mine = r.author_id === me;
    const clip: Clip = { id: r.id, name: mine ? ME : r.author_name, text: r.text ?? "", url: remote.urlOf(r.audio_path), remote: true, mine, lang: langOf(r.tags) };
    if (!r.reply_to) {
      const post: Post = { ...clip, hook: hookOf(r.text), replies: [], plays: r.plays };
      fresh.push(post);
      if (mine) MY_POSTS.push(post);
    } else {
      const parent = [...VOICES, ...ASIDE, ...MY_POSTS, ...fresh].find((p) => p.id === r.reply_to);
      if (parent) parent.replies.push(clip);
    }
  }
  if (fresh.length) VOICES.unshift(...fresh);
  for (const x of d.reactions) {
    const key = rxKey(x.post_id, x.user_id, x.emoji, x.at);
    if (seenRx.has(key)) continue;
    seenRx.add(key);
    marksFor(x.post_id).push({ f: x.at, r: x.emoji as Reaction, mine: x.user_id === me });
  }
  if (VOICES.filter((p) => p.remote).length >= REAL_ENOUGH)
    for (let i = VOICES.length - 1; i >= 0; i--) if (VOICES[i].file && !VOICES[i].mine) VOICES.splice(i, 1);
  // ничего ещё не слушали — эфир начинается с самого нового живого голоса; иначе остаёмся на том же
  const keep = heard.size ? VOICES.indexOf(was) : -1;
  voice = keep >= 0 ? keep : 0;
  if (VOICES[voice] !== was && !playing) {
    voiceBuf = undefined;
    heldF = 0;
  }
  applySafety();
  if (!voiceBuf) showWave();
  drawPins();
  openPendingThread();
  void refreshMember().then(render); // гость или зарегистрирован — спросить сервер
}

// касание уведомления «Тебе ответили голосом» открывает v2 с ?thread=<id> — показываем ветку,
// как только этот голос пришёл с сервера
let pendingThread = new URLSearchParams(location.search).get("thread");
if (pendingThread) history.replaceState(null, "", location.pathname);
function openPendingThread() {
  if (!pendingThread) return;
  const post = [...VOICES, ...ASIDE, ...MY_POSTS].find((p) => p.id === pendingThread);
  if (!post) return;
  pendingThread = null;
  openSheet("thread", post);
}

initScreens({
  hide: (id) => {
    hide(id);
    applySafety();
    say(t1("hidden"));
  },
  report: (id, reason) => {
    report(id, reason);
    remote.report(id, reason);
    applySafety();
    if (reason !== "crisis") say(t1("reported"));
  },
  block: (name) => {
    block(name);
    applySafety();
    say(t1("blocked", { name }));
  },
  joined: () => {
    say(tr("joinDone"));
    render();
  },
  removeAllMine: async () => {
    const mine = [...MY_POSTS.map((p) => p.id), ...[...VOICES, ...ASIDE, ...MY_POSTS].flatMap((p) => p.replies.map((r) => r.id))].filter((id) =>
      id.startsWith("m"),
    );
    for (const id of new Set(mine)) await removeRec(id);
    say(tr("deletedMine"));
  },
  langs: (l) => {
    toggleLang(l);
    applySafety(); // выключили язык — его голоса уходят
    restoreShown(); // включили — возвращаются
  },
  unblock: (name) => {
    unblock(name);
    restoreShown();
    say(t1("unblocked", { name }));
  },
  play: (clip, onEnd, onFail) => void playClip(clip, onEnd, onFail),
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
  solid: isSolid,
  toggleSolid,
});

// Главный экран управляется смахиванием: вверх и вниз — следующий и предыдущий голос, вбок — соседний канал,
// касание — пауза. Овал тянется за пальцем и влетает с той стороны, куда листали.
let down: { x: number; y: number } | undefined;
function flyIn(x: number, y: number) {
  if (calm) return;
  for (const el of stage.querySelectorAll<HTMLElement>(".cap, .halo, .lens"))
    el.animate([{ translate: `calc(-50% + ${x}px) calc(-50% + ${y}px)`, opacity: 0 }, {}], { duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" });
}
function drag(dx: number, dy: number) {
  stage.style.setProperty("--dx", `${dx}px`);
  stage.style.setProperty("--dy", `${dy}px`);
}
stage.addEventListener("pointerdown", (e) => {
  down = state !== "air" || (e.target as HTMLElement).closest("button, .sheet, .scrim, .page, .dock, .stories, .fx, .tray, .reel, .coach-card") ? undefined : { x: e.clientX, y: e.clientY };
  if (down) stage.classList.add("dragging");
  if (trayOpen && !(e.target as HTMLElement).closest(".tray, #left, .reel")) {
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
  if (Math.abs(dx) > 60 || Math.abs(dy) > 50) hideCoach(); // жест получился — подсказка больше не нужна
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
  if (state !== "air" || !airFront() || t?.closest("button, input, textarea, .reel, .sheet, .page")) return;
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
const AIR_S = 0.86; // размер овала в эфире — постоянный
const cur = { s: AIR_S, b: 0.85, ring: 0, bg: 0.25, c: [...HOT] as RGB };
let level = 0; // громкость 0..1, сглаженная
let bump = 0; // короткий всплеск: сердце
let last = performance.now();

function loudness() {
  // голос из <audio>: громкость — по огибающей в текущем месте записи
  if (elOn && playingBuf && elDur()) {
    const env = envelope(playingBuf, Math.max(24, Math.round(playingBuf.duration * 25)));
    const v = env[Math.min(env.length - 1, Math.floor((el.currentTime / elDur()) * env.length))] ?? 0;
    return Math.max(0, (v - 0.1) / 0.9) * 0.85;
  }
  if (elOn) return 0.35; // огибающей ещё нет — ровное спокойное свечение
  if (!ctx || (!playing && state !== "rec")) return 0;
  analyser.getFloatTimeDomainData(wave);
  let sum = 0;
  for (const x of wave) sum += x * x;
  return Math.min(1, Math.sqrt(sum / wave.length) * 4.5);
}

const written = new Map<string, string>();
let lastWrite = 0;
function put(name: string, value: string) {
  if (written.get(name) === value) return;
  written.set(name, value);
  stage.style.setProperty(name, value);
}

function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  const raw = loudness() * (calm ? 0.3 : 1);
  level += (raw - level) * (1 - Math.exp(-dt * (raw > level ? 22 : 6))); // растёт быстро, спадает плавно
  bump *= Math.exp(-dt * 5);

  // В эфире стеклянный овал стоит на месте одного размера — играет он или на паузе. Голос меняет
  // только то, что внутри (сияние со дна) и снаружи (ореол, отсвет на экране, кромка). На паузе
  // овал не замирает совсем: едва заметно дышит
  const tg = { s: AIR_S + (calm || playing ? 0 : 0.012 * Math.sin(t / 1100)), b: 0.85, ring: 0, bg: 0.25, c: HOT };
  if (state === "air" && playing) Object.assign(tg, { b: 1, bg: 0.6 + level * 0.4 });
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

  if (state === "air") {
    const f = trackF();
    moveTape(f, cur.s);
    pinsTape.style.setProperty("--a", String(anchor ?? -1));
    pinsLayer.classList.toggle("anchoring", anchor !== undefined);
    track.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    if (scrubF === undefined) pass(f);
  }
  // Переменные на экране меняют стиль всего дерева — пишем только то, что изменилось, а в покое
  // (ничего не звучит, не записывается, палец не ведёт) — не чаще 12 раз в секунду: дыхание медленное
  const calmNow = state === "air" && !playing && !bump && !down;
  if (!calmNow || t - lastWrite > 83) {
    lastWrite = t;
    // реакция-сердце — вспышка света, а не толчок овала
    put("--lv", Math.min(1, level + bump * 0.6).toFixed(3));
    put("--s", cur.s.toFixed(3));
    put("--b", cur.b.toFixed(2));
    put("--bg", cur.bg.toFixed(2));
    put("--ring", cur.ring.toFixed(2));
    put("--c", `rgb(${cur.c.map(Math.round).join(" ")})`);
  }

  if (state === "rec") {
    const sec = (t - recStart) / 1000;
    $("hint").textContent = `${fmt(sec)} / ${fmt(maxRec())}`;
    if (sec >= maxRec()) stopRec();
  }
  requestAnimationFrame(frame);
}

translateDom();
// шапка: аватарка — первая буква псевдонима; касание открывает «Моё», где профиль
$("avatar").textContent = [...ME][0] ?? "";
$("avatar").setAttribute("aria-label", tr("profile", { name: ME }));
$("avatar").onclick = () => showTab("mine");
render();
// =================== подсказка жестов ===================

// Эфир управляется смахиваниями — их не видно. При первом запуске одна карточка объясняет все четыре
// жеста, а «палец» показывает смахивание вверх. Закрывается кнопкой или первым же удачным жестом
const TIPS = "sushhh.v2.tips";
const TIP_ICON = {
  vert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/></svg>',
  side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>',
  tap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8" opacity="0.5"/></svg>',
  tape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 9v6M16 5v14M20 10v4"/></svg>',
};
function showCoach() {
  try {
    if (localStorage.getItem(TIPS)) return;
  } catch {
    return; // без хранилища подсказка показывалась бы каждый раз — лучше не показывать
  }
  $("coachTitle").textContent = tr("coachTitle");
  $("coachTips").innerHTML = (
    [
      ["vert", "tipSwipe"],
      ["side", "tipSide"],
      ["tap", "tipTap"],
      ["tape", "tipTape"],
    ] as const
  )
    .map(([icon, key]) => `<li>${TIP_ICON[icon]}<span>${tr(key)}</span></li>`)
    .join("");
  $("coachOk").textContent = t1("gotIt");
  $("coach").hidden = false;
}
function hideCoach() {
  if ($("coach").hidden) return;
  $("coach").hidden = true;
  try {
    localStorage.setItem(TIPS, "1");
  } catch {
    // не запомнится — покажем в следующий раз
  }
}
$("coachOk").onclick = hideCoach;
setTimeout(showCoach, 700);

// те же действия кнопками — для VoiceOver и клавиатуры
$("srPrev").onclick = () => void playVoice(voice - 1);
$("srNext").onclick = () => void playVoice(voice + 1);
$("srPlay").onclick = () => togglePause();

// новая версия сайта включается сама, когда ничего не записывается и не звучит (см. fresh.ts)
keepFresh(() => state !== "air" || playing || starting || remote.uploading());

// волна первого голоса видна сразу, ещё до первого касания
// свои записи с прошлых раз — обратно в эфир и в «Моё»; потом волна текущего голоса
applySafety(); // скрытое и заблокированное в прошлые разы — сразу не в эфире
remote.setName(ME);
remote.start(ME, mergeRemote, () => say(tr("published")));
$("more").onclick = () => {
  const v = VOICES[voice];
  if (v && !v.mine) openModerate(v.id, v.name);
};
void loadRecs()
  .then((recs) => recs.forEach((r) => place(r, { stored: true }))) // звук остаётся на устройстве
  .finally(() => {
    showWave();
    render();
  });
requestAnimationFrame(frame);
