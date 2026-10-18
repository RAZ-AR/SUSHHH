// Общий AudioContext и анализ уровня/тембра для визуала.

import type { Level } from "./visual";

let ctx: AudioContext | null = null;

export function audioCtx() {
  ctx ??= new AudioContext();
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

// Плеер: один <audio>, подключённый к анализатору один раз.
export class Player {
  readonly el = new Audio();
  private an: ReturnType<typeof makeAnalyser> | null = null;

  constructor() {
    this.el.preload = "auto";
    this.el.preservesPitch = true;
  }

  private wire() {
    if (this.an) return;
    const c = audioCtx();
    this.an = makeAnalyser();
    c.createMediaElementSource(this.el).connect(this.an.node);
    this.an.node.connect(c.destination);
  }

  async play(src: string, rate: number) {
    this.wire();
    if (this.el.src !== new URL(src, location.href).href) this.el.src = src;
    this.el.playbackRate = rate;
    await this.el.play();
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

// Запись с микрофона до maxMs; визуал получает уровень в реальном времени.
export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private an: ReturnType<typeof makeAnalyser> | null = null;
  private chunks: Blob[] = [];
  private timer = 0;
  startedAt = 0;

  async start(maxMs: number, onAutoStop: () => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.an = makeAnalyser();
    audioCtx().createMediaStreamSource(this.stream).connect(this.an.node);

    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
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

// Огибающая записи: n значений громкости 0..1 — из неё рисуется «портрет».
// OfflineAudioContext декодирует без жеста пользователя.
export async function envelope(src: string | Blob, n: number): Promise<Float32Array> {
  const data = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
  const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  const ch = buf.getChannelData(0);
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
  return out;
}
