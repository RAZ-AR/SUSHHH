// Шкала настройки: лента с голосами едет под неподвижной стрелкой.
// Ведёшь пальцем — между голосами шипит эфир, вблизи голоса слышен обрывок из середины записи;
// отпустил — стрелка на пружине доезжает до ближайшего голоса, и он играет с начала.
// Шкала ничего не знает про ленту: ей дают список голосов и сообщают, где звучать.

import { audioCtx } from "./audio";
import { voiceColor } from "./aura";
import { bufferFor } from "./sounds";
import { $ } from "./ui";

export type DialStation = { name: string; src: string; reply: boolean };
type Hooks = {
  out: () => AudioNode; // куда играть шум и обрывки (через анализатор — экран их видит)
  onSearch: () => void; // стрелка тронулась: основной звук ставится на паузу
  onNear: (i: number) => void; // стрелка проходит мимо голоса i
  onTune: (i: number) => void; // стрелка встала на голос i
  onStep: (d: 1 | -1) => void; // стрелки клавиатуры
};

const SP = 92; // расстояние между голосами
const TICK = SP / 8;
const WINDOW = 6; // сколько голосов рисуем по обе стороны от стрелки
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

let hooks: Hooks;
let stations: DialStation[] = [];
let pos = 0;
let vel = 0;
let target = 0;
let near = 0;
let state: "idle" | "drag" | "travel" = "idle";
let running = false;

export const searching = () => state !== "idle";

// --- отрисовка ---

function render() {
  const scale = $("scale");
  scale.querySelectorAll(".st").forEach((e) => e.remove());
  const from = Math.max(0, near - WINDOW);
  const to = Math.min(stations.length - 1, near + WINDOW);
  for (let i = from; i <= to; i++) {
    const st = stations[i];
    const b = document.createElement("button");
    b.className = "st" + (i === near ? " near" : "") + (st.reply ? " reply" : "");
    b.style.left = `${i * SP}px`;
    b.style.setProperty("--hue", voiceColor(st.name));
    b.tabIndex = -1;
    b.append(document.createElement("i"), Object.assign(document.createElement("span"), { textContent: st.reply ? `↳ ${st.name}` : st.name }));
    b.onclick = () => travel(i);
    scale.append(b);
  }
  const dial = $("dial");
  dial.setAttribute("aria-valuemax", String(Math.max(1, stations.length)));
  dial.setAttribute("aria-valuenow", String(near + 1));
  dial.setAttribute("aria-valuetext", stations[near]?.name ?? "");
  $("dialEmpty").hidden = stations.length > 0;
}

const place = () => ($("scale").style.transform = `translateX(${-pos}px)`);

export function setStations(list: DialStation[], index: number) {
  stations = list;
  stopPreview();
  quiet();
  state = "idle";
  near = Math.max(0, Math.min(index, list.length - 1));
  pos = target = near * SP;
  vel = 0;
  render();
  place();
}

// стрелка сразу на голосе i — когда запись включили не со шкалы
export function setIndex(i: number) {
  if (state === "drag") return;
  stopPreview();
  quiet();
  state = "idle";
  near = i;
  pos = target = i * SP;
  vel = 0;
  render();
  place();
}

// --- звук поиска ---

let noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let noiseBuf: AudioBuffer | null = null;
let voice: GainNode | null = null;
let preview: { i: number; src: AudioBufferSourceNode } | null = null;

function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const c = audioCtx();
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function hiss(level: number) {
  const c = audioCtx();
  if (!noise) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(bp).connect(gain).connect(hooks.out());
    src.start();
    noise = { src, gain };
  }
  noise.gain.gain.setTargetAtTime(level, c.currentTime, 0.04);
}

function quiet() {
  if (!noise) return;
  const { src, gain } = noise;
  noise = null;
  gain.gain.setTargetAtTime(0, audioCtx().currentTime, 0.05);
  setTimeout(() => {
    src.stop();
    gain.disconnect();
  }, 300);
}

function stopPreview() {
  if (!preview) return;
  try {
    preview.src.stop();
  } catch {
    // уже остановлен
  }
  preview = null;
}

// обрывок голоса i из середины записи — так его узнают, не слушая с начала
function startPreview(i: number) {
  stopPreview();
  const st = stations[i];
  if (!st) return;
  void bufferFor(st.src)
    .then((buf) => {
      if (state !== "drag" || near !== i || preview?.i === i) return;
      const c = audioCtx();
      voice ??= c.createGain();
      voice.disconnect();
      voice.connect(hooks.out());
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(voice);
      src.start(0, buf.duration * 0.3);
      preview = { i, src };
    })
    .catch(() => {}); // запись не открылась — будет слышен только шум
}

// щелчок на каждом делении шкалы
let lastClick = 0;
export function click(gain = 0.06) {
  const now = performance.now();
  if (now - lastClick < 22) return;
  lastClick = now;
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.014);
  src.connect(hp).connect(g).connect(c.destination);
  src.start(c.currentTime, Math.random(), 0.02);
  navigator.vibrate?.(3);
}

// --- движение ---

function setNear(i: number) {
  if (i === near) return;
  near = i;
  render();
  hooks.onNear(i);
}

// доехать до голоса i: с шумом, как при повороте ручки; на месте — onTune
export function travel(i: number) {
  if (!stations.length) return;
  i = ((i % stations.length) + stations.length) % stations.length;
  stopPreview();
  target = i * SP;
  if (calm || document.hidden) return arrive(i);
  hooks.onSearch();
  // через всю шкалу не едем: подъезжаем с трёх голосов
  if (Math.abs(target - pos) > SP * 4) pos = target - Math.sign(target - pos) * SP * 3;
  state = "travel";
  hiss(0.14);
  run();
}

function arrive(i: number) {
  state = "idle";
  pos = target = i * SP;
  vel = 0;
  quiet();
  stopPreview();
  if (i !== near) {
    near = i;
  }
  render();
  place();
  hooks.onTune(i);
}

let lastTick = 0;
let prevT = 0;
function frame(now: number) {
  const dt = Math.min(0.032, (now - prevT) / 1000);
  prevT = now;

  if (state === "travel") {
    vel += ((target - pos) * 210 - vel * 21) * dt; // пружина с лёгким перелётом
    pos += vel * dt;
    setNear(Math.max(0, Math.min(stations.length - 1, Math.round(pos / SP))));
    if (Math.abs(target - pos) < 0.6 && Math.abs(vel) < 8) arrive(Math.round(target / SP));
  } else if (state === "drag") {
    const i = Math.max(0, Math.min(stations.length - 1, Math.round(pos / SP)));
    const d = Math.min(1, Math.abs(pos - i * SP) / (SP / 2));
    setNear(i);
    if (preview?.i !== i) startPreview(i);
    // чем ближе к голосу, тем меньше шума и громче обрывок
    voice?.gain.setTargetAtTime(d < 0.7 ? Math.pow(1 - d / 0.7, 1.5) : 0, audioCtx().currentTime, 0.03);
    hiss(0.05 + 0.17 * d);
  }

  if (state !== "idle") {
    hooks.out(); // держим анализатор открытым: экран показывает шум поиска
    const tick = Math.floor(pos / TICK);
    if (tick !== lastTick) click();
    lastTick = tick;
  }
  place();
  if (state === "idle") {
    running = false;
    return;
  }
  requestAnimationFrame(frame);
}

function run() {
  if (running) return;
  running = true;
  prevT = performance.now();
  requestAnimationFrame(frame);
}

// --- палец и клавиатура ---

export function initDial(h: Hooks) {
  hooks = h;
  const dial = $("dial");
  let startX = 0;
  let startPos = 0;
  let moved = false;
  let dragEnded = 0;
  // касание голоса сразу после протяжки не должно сработать как нажатие
  dial.addEventListener("click", (e) => performance.now() - dragEnded < 300 && e.stopPropagation(), { capture: true });

  dial.addEventListener("pointerdown", (e) => {
    if (!stations.length) return;
    dial.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startPos = pos;
    moved = false;
  });
  dial.addEventListener("pointermove", (e) => {
    if (!dial.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 4) return;
    if (!moved) {
      moved = true;
      state = "drag";
      vel = 0;
      hooks.onSearch();
      run();
    }
    pos = Math.max(-SP * 0.4, Math.min((stations.length - 1) * SP + SP * 0.4, startPos - dx));
  });
  const release = (e: PointerEvent) => {
    if (!dial.hasPointerCapture(e.pointerId)) return;
    dial.releasePointerCapture(e.pointerId);
    if (!moved) return;
    dragEnded = performance.now();
    state = "idle";
    travel(Math.round(pos / SP));
  };
  dial.addEventListener("pointerup", release);
  dial.addEventListener("pointercancel", release);
  dial.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    e.stopPropagation(); // иначе общий обработчик стрелок переключит голос второй раз
    hooks.onStep(e.key === "ArrowRight" ? 1 : -1);
  });
}
