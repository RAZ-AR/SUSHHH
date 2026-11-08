// Общий AudioContext и анализ уровня/тембра для визуала.

import type { Level } from "./visual";

let ctx: AudioContext | null = null;

// 48 кГц — родная частота Opus и RNNoise: голос не пересэмплируется лишний раз
export function audioCtx() {
  if (!ctx) {
    try {
      ctx = new AudioContext({ sampleRate: 48000 });
    } catch {
      ctx = new AudioContext();
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function makeAnalyser() {
  const an = audioCtx().createAnalyser();
  an.fftSize = 1024;
  an.smoothingTimeConstant = 0.6;
  const time = new Float32Array(an.fftSize);
  const freq = new Uint8Array(an.frequencyBinCount);

  // RMS → громкость, спектральный центроид → «тон» (0 — глухо, 1 — звонко)
  const read = (): Level => {
    an.getFloatTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
    const rms = Math.sqrt(sum / time.length);

    an.getByteFrequencyData(freq);
    let w = 0;
    let m = 0;
    for (let i = 2; i < freq.length; i++) {
      w += freq[i];
      m += freq[i] * i;
    }
    const centroid = w > 0 ? m / w / freq.length : 0;

    return {
      level: Math.min(1, Math.pow(rms * 4, 0.7)),
      tone: Math.min(1, centroid * 4),
    };
  };

  return { node: an, read };
}

// --- шумодав: RNNoise в WASM (AudioWorklet), грузится один раз и только для записи ---

let denoiserReady: Promise<ArrayBuffer> | null = null;

export function warmDenoiser() {
  const c = audioCtx();
  if (!c.audioWorklet || c.sampleRate !== 48000) return null; // RNNoise рассчитан на 48 кГц
  denoiserReady ??= (async () => {
    const [{ loadRnnoise }, worklet, wasm, simd] = await Promise.all([
      import("@sapphi-red/web-noise-suppressor"),
      import("@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url"),
      import("@sapphi-red/web-noise-suppressor/rnnoise.wasm?url"),
      import("@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url"),
    ]);
    const [bin] = await Promise.all([loadRnnoise({ url: wasm.default, simdUrl: simd.default }), c.audioWorklet.addModule(worklet.default)]);
    return bin;
  })();
  denoiserReady.catch(() => (denoiserReady = null)); // не вышло — в следующий раз попробуем снова
  return denoiserReady;
}

async function denoiser(): Promise<AudioWorkletNode & { destroy(): void }> {
  const bin = await warmDenoiser();
  if (!bin) throw new Error("no denoiser");
  const { RnnoiseWorkletNode } = await import("@sapphi-red/web-noise-suppressor");
  return new RnnoiseWorkletNode(audioCtx(), { wasmBinary: bin, maxChannels: 1 });
}

// Плеер: один <audio> → громкость → анализатор → мягкий компрессор → динамик.
// Громкость выравнивает голоса между собой, компрессор ловит редкие пики.
export type Loudness = { gain?: number; start?: number; end?: number };

const FADE = 0.12;

export class Player {
  readonly el = new Audio();
  private an: ReturnType<typeof makeAnalyser> | null = null;
  private vol: GainNode | null = null;
  private target = 1;
  private end = 0;

  constructor() {
    this.el.preload = "auto";
    this.el.preservesPitch = true;
    // тишина в конце записи не играет: следующий голос начинается сразу
    this.el.addEventListener("timeupdate", () => {
      if (this.end && !this.el.paused && this.el.currentTime >= this.end) {
        this.end = 0;
        this.el.pause();
        this.el.dispatchEvent(new Event("ended"));
      }
    });
  }

  private wire() {
    if (this.an) return;
    const c = audioCtx();
    this.an = makeAnalyser();
    this.vol = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    c.createMediaElementSource(this.el).connect(this.vol).connect(this.an.node).connect(comp).connect(c.destination);
  }

  private ramp(to: number, sec: number) {
    if (!this.vol) return;
    const g = this.vol.gain;
    const now = audioCtx().currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.exponentialRampToValueAtTime(Math.max(to, 0.0001), now + sec);
  }

  async play(src: string, rate: number, l: Loudness = {}) {
    this.wire();
    const fresh = this.el.src !== new URL(src, location.href).href;
    if (fresh) {
      // смена голоса без щелчка: короткое затухание старого, плавный вход нового
      if (!this.el.paused) {
        this.ramp(0, FADE);
        await new Promise((r) => setTimeout(r, FADE * 1000));
      }
      this.ramp(0, 0.01);
      this.el.src = src;
    }
    this.target = l.gain ?? 1;
    this.end = l.end ?? 0;
    this.el.playbackRate = rate;
    try {
      await this.el.play();
    } catch (e) {
      this.ramp(this.target, 0.01); // автозапуск запрещён — громкость возвращаем, чтобы касание включило звук
      throw e;
    }
    if (fresh && l.start && this.el.currentTime < l.start) this.el.currentTime = l.start; // тишину в начале пропускаем
    this.ramp(this.target, fresh ? 0.15 : 0.05);
  }

  // анализ записи закончился уже во время игры — подстраиваемся мягко
  setLoudness(l: Loudness) {
    if (l.gain != null && l.gain !== this.target) {
      this.target = l.gain;
      if (!this.el.paused) this.ramp(this.target, 0.4);
    }
    if (l.end) this.end = l.end;
  }

  // вход для коротких звуков (аудио-эмодзи): идут через тот же анализатор,
  // поэтому графика реагирует и на них, даже когда запись на паузе
  private fxUntil = 0;
  fx(ms: number): AudioNode {
    this.wire();
    this.fxUntil = performance.now() + ms;
    return this.an!.node;
  }

  level = (): Level | null =>
    this.an && (!this.el.paused || performance.now() < this.fxUntil) ? this.an.read() : null;
}

// Запись с микрофона до maxMs: шумодав → MediaRecorder (Opus 32 кбит/с, в Safari AAC).
// Визуал получает уровень уже очищенного голоса.
export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private an: ReturnType<typeof makeAnalyser> | null = null;
  private nodes: AudioNode[] = [];
  private ns: { destroy(): void } | null = null;
  private chunks: Blob[] = [];
  private timer = 0;
  startedAt = 0;

  async start(maxMs: number, onAutoStop: () => void) {
    const ns = await denoiser().catch(() => null);
    this.stream = await navigator.mediaDevices.getUserMedia({
      // свой шумодав есть — встроенный выключаем, чтобы голос не «плавал» от двойной обработки
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: !ns, autoGainControl: true },
    });
    const c = audioCtx();
    this.an = makeAnalyser();
    let input = this.stream;
    try {
      const src = c.createMediaStreamSource(this.stream);
      if (!ns) throw new Error("no denoiser");
      const out = c.createMediaStreamDestination();
      src.connect(ns);
      ns.connect(out);
      ns.connect(this.an.node);
      this.nodes = [src, ns];
      this.ns = ns;
      input = out.stream;
    } catch {
      ns?.destroy();
      const src = c.createMediaStreamSource(this.stream);
      src.connect(this.an.node);
      this.nodes = [src];
    }

    const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    const bits = mime?.includes("opus") ? 32_000 : 48_000; // голосу Opus хватает 32 кбит/с
    this.rec = new MediaRecorder(input, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: bits });
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.startedAt = performance.now();
    this.timer = window.setTimeout(onAutoStop, maxMs);
  }

  stop(): Promise<Blob> {
    clearTimeout(this.timer);
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec) return resolve(new Blob());
      rec.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.nodes.forEach((n) => n.disconnect());
        this.nodes = [];
        this.ns?.destroy();
        this.ns = null;
        this.an = null;
        resolve(new Blob(this.chunks, { type: rec.mimeType }));
      };
      rec.stop();
    });
  }

  get active() {
    return this.rec?.state === "recording";
  }

  level = (): Level | null => (this.an && this.active ? this.an.read() : null);
}

// Разбор записи: огибающая (n значений 0..1) — из неё рисуется «портрет»;
// громкость речи — множитель, приводящий голос к общему уровню;
// start/end — где начинается и кончается речь, тишину по краям не играем.
// OfflineAudioContext декодирует без жеста пользователя.
export type Analysis = Loudness & { env: Float32Array; gain: number; start: number; end: number };

const TARGET_RMS = 0.1; // ≈ −20 dBFS: громко и разборчиво, с запасом до клиппинга
const FRAME = 0.02;

export async function analyze(src: string | Blob, n: number): Promise<Analysis> {
  const data = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
  const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  return analyzeSamples(buf.getChannelData(0), buf.sampleRate, n);
}

export function analyzeSamples(ch: Float32Array, rate: number, n: number): Analysis {
  const out = new Float32Array(n);
  const step = Math.floor(ch.length / n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * step; j < (i + 1) * step; j++) sum += ch[j] * ch[j];
    out[i] = Math.sqrt(sum / Math.max(step, 1));
    max = Math.max(max, out[i]);
  }
  for (let i = 0; i < n; i++) out[i] = max > 0 ? Math.pow(out[i] / max, 0.8) : 0;

  // громкость с двумя порогами, как в LUFS: сначала отсекаем тишину (−50 dBFS),
  // затем всё, что на 10 дБ тише средней речи (паузы, дыхание)
  const fl = Math.max(1, Math.round(FRAME * rate));
  const pow: number[] = [];
  for (let i = 0; i + fl <= ch.length; i += fl) {
    let sum = 0;
    for (let j = i; j < i + fl; j++) sum += ch[j] * ch[j];
    pow.push(sum / fl);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const loud = pow.filter((p) => p > 1e-5);
  const gate = mean(loud) * 0.1;
  const speech = loud.filter((p) => p > gate);
  const rms = Math.sqrt(mean(speech));
  const gain = rms > 0 ? Math.min(4, Math.max(0.3, TARGET_RMS / rms)) : 1;

  const dur = ch.length / rate;
  const first = pow.findIndex((p) => p > gate);
  const last = pow.length - 1 - [...pow].reverse().findIndex((p) => p > gate);
  let start = first > 0 ? first * FRAME - 0.15 : 0;
  let end = first >= 0 ? (last + 1) * FRAME + 0.25 : dur;
  if (start < 0.3) start = 0; // короткую паузу не трогаем — звучит естественнее
  if (dur - end < 0.4) end = 0; // 0 — играть до конца
  return { env: out, gain, start, end };
}

export async function envelope(src: string | Blob, n: number): Promise<Float32Array> {
  return (await analyze(src, n)).env;
}
