// Аудио-эмодзи: короткие синтезированные звуки, без файлов.

import { audioCtx } from "./audio";

export const REACTIONS = ["❤️", "😂", "🤗", "🔥", "😮", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];

type Ctx = AudioContext;

function tone(c: Ctx, out: AudioNode, t: number, f0: number, f1: number, dur: number, gain = 0.25, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(c: Ctx, out: AudioNode, t: number, dur: number, gain: number, freq: number, q = 1, sweepTo?: number) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

const SOUNDS: Record<Reaction, (c: Ctx, out: AudioNode, t: number) => number> = {
  // тёплый двузвучный перелив
  "❤️": (c, o, t) => {
    tone(c, o, t, 523, 523, 0.5, 0.22);
    tone(c, o, t + 0.12, 659, 659, 0.6, 0.2);
    tone(c, o, t + 0.24, 784, 784, 0.7, 0.16);
    return 900;
  },
  // «ха-ха-ха»: падающие короткие слоги
  "😂": (c, o, t) => {
    for (let i = 0; i < 4; i++) tone(c, o, t + i * 0.13, 420 - i * 25, 300 - i * 25, 0.1, 0.25, "triangle");
    return 700;
  },
  // мягкий низкий аккорд
  "🤗": (c, o, t) => {
    for (const f of [196, 247, 294]) tone(c, o, t, f, f, 0.9, 0.12);
    return 1000;
  },
  // вспышка шума с поднимающимся фильтром
  "🔥": (c, o, t) => {
    noise(c, o, t, 0.6, 0.5, 300, 1.2, 3500);
    return 700;
  },
  // «вау»: глиссандо вверх и вниз
  "😮": (c, o, t) => {
    tone(c, o, t, 300, 700, 0.25, 0.22, "triangle");
    tone(c, o, t + 0.25, 700, 350, 0.35, 0.18, "triangle");
    return 700;
  },
  // аплодисменты: россыпь коротких щелчков
  "👏": (c, o, t) => {
    for (let i = 0; i < 14; i++) noise(c, o, t + i * 0.05 + Math.random() * 0.03, 0.04, 0.6, 1800 + Math.random() * 1200, 0.8);
    return 900;
  },
};

// играет звук в out; возвращает длительность в мс
export function playReaction(r: Reaction, out: AudioNode) {
  const c = audioCtx();
  return SOUNDS[r](c, out, c.currentTime + 0.01);
}
