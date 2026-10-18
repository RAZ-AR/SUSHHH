// Аудио-эмодзи: короткие синтезированные звуки, без файлов.
// Два набора: эмоции и ситком-мемы. Мемы — жанровые звуки, которые не принадлежат
// ни одному сериалу (настоящие фрагменты «Симпсонов» или «Друзей» требуют лицензии).

import { audioCtx } from "./audio";

export const REACTIONS = ["❤️", "😂", "🤗", "🔥", "😮", "👏"] as const;
export const MEMES = ["🥁", "🎺", "🦗", "😱", "📯", "🎉"] as const;
export type Reaction = (typeof REACTIONS)[number] | (typeof MEMES)[number];


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

function noise(
  c: Ctx, out: AudioNode, t: number, dur: number, gain: number, freq: number, q = 1, sweepTo?: number,
  type: BiquadFilterType = "bandpass",
) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
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

// «медь»: пила + октава вниз через фильтр, который открывается и закрывается — «уа»
function brass(c: Ctx, out: AudioNode, t: number, freq: number, dur: number, gain = 0.16, vibrato = 0) {
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = 4;
  f.frequency.setValueAtTime(350, t);
  f.frequency.exponentialRampToValueAtTime(1900, t + 0.06);
  f.frequency.exponentialRampToValueAtTime(600, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  const oscs = [
    [freq, "sawtooth"],
    [freq * 1.004, "sawtooth"],
    [freq / 2, "square"],
  ] as const;
  for (const [fr, type] of oscs) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(fr, t);
    if (vibrato) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato * (fr / freq);
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t + dur * 0.3);
      lfo.stop(t + dur + 0.05);
    }
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

// барабан: синус с быстро падающей высотой
function drum(c: Ctx, out: AudioNode, t: number, f0: number, f1: number, dur: number, gain = 0.5) {
  tone(c, out, t, f0, f1, dur, gain);
  noise(c, out, t, 0.08, 0.15, 1800, 0.7);
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

  // --- ситком-мемы ---

  // «ба-дум-тсс»: два тома и тарелка — после неудачной шутки
  "🥁": (c, o, t) => {
    drum(c, o, t, 210, 95, 0.16);
    drum(c, o, t + 0.17, 150, 70, 0.2);
    noise(c, o, t + 0.4, 0.9, 0.32, 7000, 0.5, undefined, "highpass");
    return 1300;
  },
  // грустный тромбон «уа-уа-уа-уааа»
  "🎺": (c, o, t) => {
    const notes = [293.7, 277.2, 261.6, 246.9];
    notes.forEach((f, i) => brass(c, o, t + i * 0.42, f, i < 3 ? 0.38 : 1.1, 0.15, i === 3 ? 7 : 0));
    return 2500;
  },
  // сверчки: неловкая тишина
  "🦗": (c, o, t) => {
    for (let g = 0; g < 4; g++)
      for (let k = 0; k < 3; k++) tone(c, o, t + g * 0.32 + k * 0.045, 4700, 4650, 0.028, 0.17);
    return 1400;
  },
  // драматичное «дун-дун-дуун»
  "😱": (c, o, t) => {
    brass(c, o, t, 196, 0.22, 0.17);
    brass(c, o, t + 0.3, 196, 0.22, 0.17);
    brass(c, o, t + 0.6, 155.6, 1.2, 0.19, 4);
    return 1900;
  },
  // клаксон: «бип-бип-би-и-ип»
  "📯": (c, o, t) => {
    [0, 0.17, 0.34].forEach((d, i) => {
      for (const f of [440, 443, 220]) tone(c, o, t + d, f, f * 0.98, i < 2 ? 0.12 : 0.5, 0.14, "sawtooth");
    });
    return 1100;
  },
  // «та-да!»: короткий и длинный мажорный аккорд
  "🎉": (c, o, t) => {
    for (const f of [523.3, 659.3, 784]) tone(c, o, t, f, f, 0.14, 0.12, "triangle");
    for (const f of [523.3, 659.3, 784, 1046.5]) tone(c, o, t + 0.18, f, f, 0.85, 0.1, "triangle");
    return 1100;
  },
};

// играет звук в out; возвращает длительность в мс
export function playReaction(r: Reaction, out: AudioNode) {
  const c = audioCtx();
  return SOUNDS[r](c, out, c.currentTime + 0.01);
}
