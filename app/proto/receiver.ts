// Прототип «приёмник города»: шкала настройки с тремя диапазонами, пэды эмоций своим голосом,
// «зал» (реакции других слышны на своих местах), сигнал записи и эхо.
// Голоса — демо-записи из public/seed; всё состояние живёт до перезагрузки, сервера нет.

import "@fontsource/inter-tight/300.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/800.css";
import { audioCtx } from "../src/audio";
import { icon } from "../src/icons";
import { playReaction, type Reaction } from "../src/reactions";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

// =================== данные ===================

type Mark = { at: number; e: string; mine?: boolean };
type Station = {
  id: string;
  name: string;
  hook: string;
  signal: number; // 0..15: сколько раз запись усилили
  listeners: number;
  marks: Mark[];
  rumor?: { yes: number; no: number; hours: number };
  buf?: AudioBuffer;
  env?: number[];
};
type Band = "city" | "own" | "rumor";

const spread = (e: string, n: number, hot: number): Mark[] =>
  Array.from({ length: n }, (_, i) => ({ e, at: Math.min(0.96, Math.max(0.06, hot + ((i * 37) % 11 - 5) * 0.022)) }));

const CITY: Station[] = [
  { id: "s1", name: "тихий_трамвай", hook: "Впервые за неделю чувствую спокойствие", signal: 3, listeners: 23, marks: [...spread("❤️", 4, 0.7), ...spread("😮", 1, 0.3)] },
  { id: "s2", name: "арам_вечером", hook: "Почему мы так редко говорим, что скучаем?", signal: 7, listeners: 61, marks: [...spread("❤️", 6, 0.42), ...spread("😮", 2, 0.8)] },
  { id: "s3", name: "мандарин", hook: "Случайно попала на чужую свадьбу", signal: 11, listeners: 148, marks: [...spread("😂", 8, 0.82), ...spread("🔥", 3, 0.5), ...spread("😂", 3, 0.35)] },
  { id: "s4", name: "nor_city", hook: "Куда сходить одному вечером? Только не бар", signal: 2, listeners: 17, marks: spread("❤️", 2, 0.35) },
  { id: "s5", name: "ещё_месяц", hook: "Давно хочу сменить работу, но боюсь", signal: 8, listeners: 74, marks: [...spread("❤️", 5, 0.6), ...spread("🔥", 2, 0.85)] },
  { id: "s6", name: "вопрос_дня", hook: "Что тебя сегодня удивило?", signal: 5, listeners: 39, marks: spread("😮", 3, 0.75) },
];
const RUMOR: Station[] = [
  { id: "r15", name: "лёгкий_ветер", hook: "Говорят, на Каскаде по вечерам живая музыка", signal: 6, listeners: 52, marks: spread("🔥", 3, 0.6), rumor: { yes: 12, no: 3, hours: 14 } },
  { id: "r7", name: "книжная_пыль", hook: "Есть книжная кофейня на Абовяна, где сидят часами", signal: 3, listeners: 21, marks: spread("❤️", 2, 0.5), rumor: { yes: 5, no: 1, hours: 20 } },
  { id: "r12", name: "радуга", hook: "Радуга над Араратом — видно прямо из автобуса", signal: 9, listeners: 96, marks: spread("😮", 5, 0.7), rumor: { yes: 31, no: 2, hours: 3 } },
  { id: "r6", name: "каскад_лав", hook: "После девяти на Каскаде тихо, весь город как на ладони", signal: 4, listeners: 30, marks: spread("❤️", 3, 0.4), rumor: { yes: 8, no: 0, hours: 9 } },
];
const memory: (Station | null)[] = [CITY[1], CITY[2], null, null];

const stationsOf = (b: Band): Station[] => (b === "city" ? CITY : b === "rumor" ? RUMOR : (memory.filter(Boolean) as Station[]));

// личный знак: цвет лампочки и место крестика в сетке плюсов — из имени
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const hue = (name: string) => `hsl(${hash(name) % 360} 88% 64%)`;
const crossAt = (name: string) => (hash(name) >>> 9) % 8;

// =================== звук ===================

const ctx = audioCtx();
const out = ctx.createGain();
const analyser = ctx.createAnalyser();
analyser.fftSize = 512;
out.connect(analyser).connect(ctx.destination);
const voiceGain = ctx.createGain();
const noiseGain = ctx.createGain();
const fxGain = ctx.createGain();
noiseGain.gain.value = 0;
voiceGain.connect(out);
fxGain.connect(out);

// эфирный шум между голосами
const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
{
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
let noiseOn = false;
function startNoise() {
  if (noiseOn) return;
  noiseOn = true;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 0.6;
  src.connect(bp).connect(noiseGain).connect(out);
  src.start();
}
const setGain = (g: GainNode, v: number, sec = 0.05) => g.gain.setTargetAtTime(v, ctx.currentTime, sec);

// щелчок: деления шкалы и клавиши
let lastClick = 0;
function click(gain = 0.07) {
  const now = performance.now();
  if (now - lastClick < 22) return;
  lastClick = now;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
  src.connect(hp).connect(g).connect(ctx.destination);
  src.start(t, Math.random(), 0.02);
  navigator.vibrate?.(3);
}

const BARS = 46;
async function load(st: Station) {
  if (st.buf) return;
  const data = await (await fetch(`/seed/${st.id}.m4a`)).arrayBuffer();
  const buf = await ctx.decodeAudioData(data);
  const ch = buf.getChannelData(0);
  const step = Math.floor(ch.length / BARS);
  const env: number[] = [];
  let max = 0;
  for (let i = 0; i < BARS; i++) {
    let sum = 0;
    for (let j = i * step; j < (i + 1) * step; j++) sum += ch[j] * ch[j];
    env.push(Math.sqrt(sum / step));
    max = Math.max(max, env[i]);
  }
  st.env = env.map((v) => Math.pow(v / (max || 1), 0.75));
  st.buf = buf;
}

// один голос в эфире: источник, с какого места и когда запущен
let voice: { st: Station; src: AudioBufferSourceNode; t0: number; full: boolean } | null = null;
let pausedAt: number | null = null;
let fired = new Set<Mark>();

function stopVoice() {
  if (!voice) return;
  voice.src.onended = null;
  try {
    voice.src.stop();
  } catch {
    // уже остановлен
  }
  voice = null;
}

function startVoice(st: Station, offset: number, full: boolean) {
  stopVoice();
  if (!st.buf) return;
  const src = ctx.createBufferSource();
  src.buffer = st.buf;
  src.connect(voiceGain);
  src.start(0, offset);
  voice = { st, src, t0: ctx.currentTime - offset, full };
  pausedAt = null;
  if (full) {
    fired = new Set(st.marks.filter((m) => m.at * st.buf!.duration < offset));
    src.onended = () => {
      voice = null;
      setTimeout(() => step(1), 350); // радио не кончается: дальше по шкале
    };
  }
}

const progress = () => {
  const st = current();
  if (!st?.buf) return 0;
  if (pausedAt != null) return pausedAt / st.buf.duration;
  if (voice?.full && voice.st === st) return Math.min(1, (ctx.currentTime - voice.t0) / st.buf.duration);
  return 0;
};

// =================== шкала ===================

const SP = 92; // расстояние между голосами на шкале
let band: Band = "city";
let list = stationsOf(band);
let pos = 0; // положение стрелки в пикселях шкалы
let vel = 0;
let target = 0;
let state: "off" | "drag" | "travel" | "tuned" = "off";
let near = 0;
const bandPos: Record<Band, number> = { city: 0, own: 0, rumor: 0 };

const current = (): Station | undefined => list[near];
const clampPos = (p: number) => Math.max(-SP * 0.4, Math.min((list.length - 1) * SP + SP * 0.4, p));

function renderScale() {
  const scale = $("scale");
  scale.querySelectorAll(".st").forEach((e) => e.remove());
  list.forEach((st, i) => {
    const b = document.createElement("button");
    b.className = "st";
    b.style.left = `${i * SP}px`;
    b.style.setProperty("--hue", hue(st.name));
    b.innerHTML = `<i></i><span></span>`;
    b.querySelector("span")!.textContent = st.name;
    b.setAttribute("aria-label", `${st.name}: ${st.hook}`);
    b.onclick = () => travel(i);
    scale.append(b);
  });
  $("dialEmpty").hidden = list.length > 0;
  $("dial").setAttribute("aria-valuemax", String(Math.max(1, list.length)));
}

function setBand(b: Band, to = -1) {
  bandPos[band] = near;
  band = b;
  list = stationsOf(b);
  document.querySelectorAll<HTMLElement>("[data-band]").forEach((x) => x.classList.toggle("on", x.dataset.band === b));
  renderScale();
  renderPads();
  $("playSub").textContent = `${{ city: "ГОРОД", own: "СВОИ", rumor: "СЛУХИ" }[b]} · ${list.length}`;
  near = Math.min(to >= 0 ? to : bandPos[b], Math.max(0, list.length - 1));
  pos = target = near * SP;
  vel = 0;
  stopVoice();
  for (const st of list) void load(st);
  if (!list.length) {
    state = state === "off" ? "off" : "tuned";
    paintStation();
    return;
  }
  if (state !== "off") tune();
  else paintStation();
}

// доехать до голоса i: по шкале с шумом, как при повороте ручки
function travel(i: number) {
  if (!list.length) return;
  power();
  near = (i + list.length) % list.length;
  target = near * SP;
  stopVoice();
  if (calm) {
    pos = target;
    return tune();
  }
  state = "travel";
  startNoise();
  setGain(noiseGain, 0.16);
  setGain(voiceGain, 0);
  paintStation();
}
const step = (d: number) => travel(near + d);

// стрелка встала на голос: шум уходит, запись играет с начала
function tune() {
  state = "tuned";
  pos = target = near * SP;
  vel = 0;
  setGain(noiseGain, 0, 0.08);
  setGain(voiceGain, 1, 0.04);
  const st = current();
  paintStation();
  if (!st) return;
  void load(st).then(() => state === "tuned" && current() === st && !voice && startVoice(st, 0, true));
}

// первое касание включает прибор: браузер не даёт звук до жеста
function power() {
  if (state !== "off") return;
  void ctx.resume();
  state = "tuned";
  $("startBtn").hidden = true;
}

// --- ведение пальцем ---
let dragX = 0;
let dragPos = 0;
let moved = false;
const dial = $("dial");
dial.addEventListener("pointerdown", (e) => {
  if (!list.length) return;
  dial.setPointerCapture(e.pointerId);
  dragX = e.clientX;
  dragPos = pos;
  moved = false;
});
dial.addEventListener("pointermove", (e) => {
  if (!dial.hasPointerCapture(e.pointerId)) return;
  const dx = e.clientX - dragX;
  if (!moved && Math.abs(dx) < 4) return;
  if (!moved) {
    moved = true;
    power();
    state = "drag";
    stopVoice();
    startNoise();
  }
  pos = clampPos(dragPos - dx);
});
const release = (e: PointerEvent) => {
  if (!dial.hasPointerCapture(e.pointerId)) return;
  dial.releasePointerCapture(e.pointerId);
  if (!moved) return;
  // click по голосу после протяжки не должен сработать
  dial.addEventListener("click", (ev) => ev.stopPropagation(), { capture: true, once: true });
  travel(Math.round(pos / SP));
};
dial.addEventListener("pointerup", release);
dial.addEventListener("pointercancel", release);
dial.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") step(1);
  if (e.key === "ArrowLeft") step(-1);
});

// пока ведут: чем ближе к голосу, тем меньше шума и громче обрывок
let scanSt: Station | null = null;
function scan() {
  const i = Math.max(0, Math.min(list.length - 1, Math.round(pos / SP)));
  const st = list[i];
  const d = Math.min(1, Math.abs(pos - i * SP) / (SP / 2));
  if (i !== near) {
    near = i;
    paintStation();
  }
  if (st.buf && (scanSt !== st || !voice)) {
    scanSt = st;
    startVoice(st, st.buf.duration * 0.3, false); // обрывок из середины — так узнаётся голос
  }
  setGain(voiceGain, d < 0.7 ? Math.pow(1 - d / 0.7, 1.5) : 0, 0.03);
  setGain(noiseGain, 0.05 + 0.2 * d, 0.03);
}

// =================== экран ===================

const RADIUS = ["КВАРТАЛ", "РАЙОН", "ГОРОД", "ВСЕ ГОРОДА"];
const level = (signal: number) => Math.min(3, Math.floor(signal / 4));
const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function paintStation() {
  const st = current();
  document.querySelectorAll(".st").forEach((e, i) => e.classList.toggle("near", i === near));
  dial.setAttribute("aria-valuenow", String(near + 1));
  dial.setAttribute("aria-valuetext", st ? st.name : "пусто");
  const stage = $("stage");
  if (!st) {
    $("call").textContent = "ПУСТО";
    $("hook").textContent = "Удержи клавишу M на голосе — он останется в «своих»";
    $("sign").innerHTML = "";
    $("count").textContent = "";
    $("extra").textContent = "";
    $("radius").textContent = "";
    $("time").textContent = "";
    $("bars").querySelectorAll("i").forEach((b) => b.classList.remove("on"));
    return;
  }
  stage.style.setProperty("--hue", hue(st.name));
  $("call").textContent = st.name;
  $("hook").textContent = st.hook;
  $("live").textContent = `${st.name}: ${st.hook}`;
  $("count").textContent = `${near + 1} / ${list.length}`;
  const x = crossAt(st.name);
  $("sign").innerHTML = Array.from({ length: 8 }, (_, i) => (i === x ? "<b>×</b>" : "<span>+</span>")).join("");
  paintSignal(st);
}

function paintSignal(st: Station, up = false) {
  const lv = level(st.signal);
  const bars = $("bars");
  bars.querySelectorAll("i").forEach((b, i) => b.classList.toggle("on", i <= Math.min(4, Math.floor(st.signal / 3))));
  if (up) {
    bars.classList.remove("up");
    void bars.offsetWidth;
    bars.classList.add("up");
  }
  $("radius").textContent = RADIUS[lv];
  $("extra").innerHTML = st.rumor
    ? `<span class="rumor">СЛУХ · ${st.rumor.hours} Ч</span> ✓${st.rumor.yes} ✗${st.rumor.no}`
    : `${st.listeners} СЛУШАЮТ`;
}

// усиление: реакция +1, эхо +3; перешёл порог — запись слышна дальше
function boost(st: Station, by: number) {
  const before = level(st.signal);
  st.signal = Math.min(15, st.signal + by);
  st.listeners += by * (2 + (hash(st.id + st.signal) % 4));
  paintSignal(st, true);
  const after = level(st.signal);
  if (after > before) toast(`Сигнал дошёл: ${RADIUS[after].toLowerCase()}`);
}

const cv = $<HTMLCanvasElement>("cv");
const g = cv.getContext("2d")!;
let W = 0;
let H = 0;
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.width = Math.round(cv.clientWidth * dpr);
  H = cv.height = Math.round(cv.clientHeight * dpr);
}
new ResizeObserver(resize).observe(cv);
resize();

const time = new Float32Array(analyser.fftSize);
let lv = 0;
function draw() {
  analyser.getFloatTimeDomainData(time);
  let sum = 0;
  for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
  lv += (Math.min(1, Math.sqrt(sum / time.length) * 5) - lv) * 0.35;

  g.fillStyle = "#0d0d0d";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#161616";
  for (let y = 0; y < H; y += 3 * dpr) g.fillRect(0, y, W, dpr);

  const st = current();
  const x0 = 14 * dpr;
  const x1 = W - 14 * dpr;
  const mid = H * 0.41;
  const maxH = H * 0.15;
  const bw = (x1 - x0) / BARS;
  const p = progress();
  const searching = state === "drag" || state === "travel";

  for (let i = 0; i < BARS; i++) {
    const at = (i + 0.5) / BARS;
    // в поиске волна — шум эфира; на голосе — его форма
    const base = searching || !st?.env ? 0.12 + Math.random() * 0.5 * (0.3 + lv) : st.env[i];
    const live = !searching && Math.abs(at - p) < 0.05 ? 1 + lv * 0.9 : 1;
    const h = Math.max(2 * dpr, base * maxH * live);
    g.fillStyle = searching ? "#5a5a5a" : at <= p ? "#ededed" : "#4a4a4a";
    g.fillRect(x0 + i * bw + bw * 0.25, mid - h, bw * 0.5, h * 2);
  }
  if (!searching && st) {
    const hx = x0 + (x1 - x0) * p;
    g.fillStyle = "#f2611d";
    g.fillRect(hx - dpr, mid - maxH - 10 * dpr, 2 * dpr, (maxH + 10 * dpr) * 2);
    g.beginPath();
    g.arc(hx, mid - maxH - 10 * dpr, 4 * dpr, 0, Math.PI * 2);
    g.fill();

    // реакции под волной: на своих местах, стопкой
    g.font = `${13 * dpr}px system-ui`;
    g.textAlign = "center";
    const stack = new Map<number, number>();
    for (const m of st.marks) {
      const col = Math.round(m.at * 22);
      const n = stack.get(col) ?? 0;
      if (n >= 3) continue;
      stack.set(col, n + 1);
      g.globalAlpha = m.mine ? 1 : m.at <= p ? 0.95 : 0.4;
      g.fillText(m.e, x0 + (x1 - x0) * (col / 22), mid + maxH + (20 + n * 15) * dpr);
    }
    g.globalAlpha = 1;
  }
}

// =================== кадр ===================

let lastTick = 0;
let prevT = performance.now();
function frame(now: number) {
  const dt = Math.min(0.032, (now - prevT) / 1000);
  prevT = now;

  if (state === "travel") {
    vel += ((target - pos) * 210 - vel * 21) * dt; // пружина с лёгким перелётом
    pos += vel * dt;
    if (Math.abs(target - pos) < 0.6 && Math.abs(vel) < 8) tune();
  } else if (state === "drag") scan();

  const tick = Math.floor(pos / 11.5);
  if (tick !== lastTick && (state === "drag" || state === "travel")) click();
  lastTick = tick;
  $("scale").style.transform = `translateX(${-pos}px)`;

  const st = current();
  const p = progress();
  if (state === "tuned" && st?.buf) {
    $("time").textContent = `${clock(p * st.buf.duration)} / ${clock(st.buf.duration)}`;
    $("hairFill").style.width = `${p * 100}%`;
    // зал: чужие реакции звучат там, где их поставили
    if (voice?.full && hallOn) {
      for (const m of st.marks) {
        if (m.mine || fired.has(m) || m.at > p) continue;
        fired.add(m);
        if (fired.size % 2 === 0) hallSound(m.e);
      }
    }
  } else if (state !== "tuned") {
    $("time").textContent = "";
    $("hairFill").style.width = "0%";
  }
  const playing = !!voice?.full;
  $("mode").textContent = state === "off" ? "ВЫКЛ" : state === "tuned" ? (playing ? "В ЭФИРЕ" : "ПАУЗА") : "ПОИСК";
  $("playIco").innerHTML = icon(playing ? "pause" : "play");
  $("playWord").textContent = playing ? '"ПАУЗА"' : '"СЛУШАТЬ"';
  draw();
  requestAnimationFrame(frame);
}

// =================== пэды эмоций ===================

type Pad = { e: string; word: string; synth: Reaction; sample?: AudioBuffer; rumor?: "yes" | "no" };
const EMO: Pad[] = [
  { e: "😂", word: "ХА", synth: "😂" },
  { e: "😮", word: "ООО", synth: "😮" },
  { e: "🔥", word: "ОГОНЬ", synth: "🔥" },
  { e: "❤️", word: "ТЕПЛО", synth: "❤️" },
];
const VOTE: Pad[] = [
  { e: "✓", word: "ВЕРЮ", synth: "👏", rumor: "yes" },
  { e: "✗", word: "НЕ ВЕРЮ", synth: "🦗", rumor: "no" },
  EMO[1],
  EMO[2],
];
const pads = () => (band === "rumor" ? VOTE : EMO);
let lastPad: Pad = EMO[0];

function renderPads() {
  document.querySelectorAll<HTMLElement>("[data-pad]").forEach((b, i) => {
    const p = pads()[i];
    b.querySelector(".cap-btn")!.textContent = p.e;
    b.querySelector("b")!.textContent = p.word;
    b.querySelector("small")!.textContent = p.sample ? "СВОЙ" : "ДЕРЖИ";
    b.classList.toggle("own", !!p.sample);
    b.setAttribute("aria-label", `${p.word}. Удерживай, чтобы записать своим голосом`);
  });
}

function padSound(p: Pad, gain: number) {
  const gn = ctx.createGain();
  gn.gain.value = gain;
  gn.connect(fxGain);
  if (p.sample) {
    const src = ctx.createBufferSource();
    src.buffer = p.sample;
    src.connect(gn);
    src.start();
  } else playReaction(p.synth, gn);
}

const SYNTH: Record<string, Reaction> = { "😂": "😂", "😮": "😮", "🔥": "🔥", "❤️": "❤️" };
function hallSound(e: string) {
  const mine = EMO.find((p) => p.e === e);
  padSound(mine?.sample ? mine : { e, word: "", synth: SYNTH[e] ?? "❤️" }, 0.28);
  float(e, true);
}

function float(e: string, small = false) {
  const s = document.createElement("span");
  s.className = "float";
  s.textContent = e;
  s.style.left = `${15 + Math.random() * 65}%`;
  if (small) s.style.fontSize = "18px";
  $("floaters").append(s);
  setTimeout(() => s.remove(), 1500);
}

function hit(p: Pad, el: HTMLElement) {
  const st = current();
  if (!st || state !== "tuned") return;
  lastPad = p;
  padSound(p, 0.9);
  float(p.e);
  st.marks.push({ e: p.e, at: Math.max(0.03, progress()), mine: true });
  if (p.rumor && st.rumor) st.rumor[p.rumor] += 1;
  boost(st, p.rumor === "no" ? 0 : 1);
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
}

// удержание — запись своей секунды: реакция дальше звучит твоим голосом
const HOLD_MS = 450;
const SAMPLE_MS = 1500;
async function recordSample(p: Pad, el: HTMLElement, released: () => boolean) {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch {
    return toast("Нужен микрофон — без него останется звук прибора");
  }
  el.classList.add("rec");
  el.querySelector("small")!.textContent = "ГОВОРИ…";
  setGain(voiceGain, 0.12);
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const t0 = performance.now();
  await new Promise<void>((r) => {
    const iv = setInterval(() => {
      if (released() || performance.now() - t0 > SAMPLE_MS) {
        clearInterval(iv);
        r();
      }
    }, 30);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  el.classList.remove("rec");
  setGain(voiceGain, 1);
  try {
    p.sample = await ctx.decodeAudioData(await new Blob(chunks, { type: rec.mimeType }).arrayBuffer());
    toast(`«${p.word}» теперь звучит твоим голосом`);
    padSound(p, 0.9);
  } catch {
    toast("Не получилось записать — попробуй ещё раз");
  }
  renderPads();
}

document.querySelectorAll<HTMLElement>("[data-pad]").forEach((el, i) => {
  let timer = 0;
  let held = false;
  let up = true;
  el.addEventListener("pointerdown", () => {
    power();
    click(0.05);
    held = false;
    up = false;
    timer = window.setTimeout(() => {
      held = true;
      void recordSample(pads()[i], el, () => up);
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

// =================== зал, эхо, память, клавиши ===================

let hallOn = true;
$("knob").onclick = () => {
  hallOn = !hallOn;
  click();
  $("knob").setAttribute("aria-pressed", String(hallOn));
  $("hall").textContent = hallOn ? "ЗАЛ ВКЛ" : "ЗАЛ ВЫКЛ";
  toast(hallOn ? "Зал включён: слышно, как реагируют другие" : "Зал выключен: только голос");
};

$("echo").innerHTML = `${icon("rotate")}<span>ЭХО</span>`;
$("echo").onclick = () => {
  const st = current();
  click();
  if (!st || state !== "tuned") return;
  padSound(lastPad, 0.9);
  float(lastPad.e);
  boost(st, 3);
  toast(`Эхо с твоим «${lastPad.word}» ушло твоим слушателям`);
};

function renderMemory() {
  document.querySelectorAll<HTMLElement>("[data-m]").forEach((b, i) => {
    const st = memory[i];
    b.classList.toggle("set", !!st);
    if (st) b.style.setProperty("--hue", hue(st.name));
    b.setAttribute("aria-label", st ? `Память ${i + 1}: ${st.name}. Удерживай, чтобы заменить` : `Память ${i + 1}: пусто. Удерживай, чтобы сохранить голос`);
  });
}
document.querySelectorAll<HTMLElement>("[data-m]").forEach((b, i) => {
  let timer = 0;
  let held = false;
  b.addEventListener("pointerdown", () => {
    held = false;
    timer = window.setTimeout(() => {
      held = true;
      const st = current();
      if (!st) return;
      const was = memory.indexOf(st);
      if (was >= 0) memory[was] = null; // один голос — одна клавиша
      memory[i] = st;
      renderMemory();
      click(0.12);
      toast(`M${i + 1} ← ${st.name}`);
      if (band === "own") setBand("own", stationsOf("own").indexOf(st));
    }, 500);
  });
  const end = () => clearTimeout(timer);
  b.addEventListener("pointerup", end);
  b.addEventListener("pointerleave", end);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  b.addEventListener("click", () => {
    if (held) return;
    click();
    const st = memory[i];
    if (!st) return toast("Пусто. Удержи на голосе, чтобы сохранить");
    power();
    setBand("own", stationsOf("own").indexOf(st));
  });
});

document.querySelectorAll<HTMLElement>("[data-band]").forEach((b) => {
  b.onclick = () => {
    power();
    click(0.12);
    setBand(b.dataset.band as Band);
  };
});

function togglePlay() {
  const st = current();
  click();
  if (state === "off") {
    power();
    return tune();
  }
  if (!st?.buf || state !== "tuned") return;
  if (voice?.full) {
    pausedAt = ctx.currentTime - voice.t0;
    const keep = pausedAt;
    stopVoice();
    pausedAt = keep;
  } else startVoice(st, pausedAt ?? 0, true);
}
$("playKey").onclick = togglePlay;
$("startBtn").innerHTML = `${icon("play")}<span>ВКЛЮЧИ — ГОРОД В ЭФИРЕ</span>`;
$("startBtn").onclick = togglePlay;
$("micIco").innerHTML = icon("mic");
$("reply").onclick = () => {
  click();
  toast("Запись ответа в прототипе не подключена");
};
document.querySelectorAll<HTMLElement>("[data-stub]").forEach((b) => (b.onclick = () => toast("В прототипе только эфир")));

document.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).closest("button")) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
});

let toastTimer = 0;
function toast(text: string) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2200);
}

function tickClock() {
  $("clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
tickClock();
setInterval(tickClock, 15_000);

renderMemory();
setBand("city");
requestAnimationFrame(frame);
