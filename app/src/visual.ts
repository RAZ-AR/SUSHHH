// Экран прибора. Запись — волна во всю ширину: пройденное светится чернилами, впереди — бледное,
// оранжевая метка — где сейчас звук. Голос виден в живой волне: столбики у метки вырастают
// с громкостью. Над волной — ответы (⊕ на своём моменте), под ней — реакции эмодзи.
// В режиме записи волна растёт слева направо из живого уровня микрофона, как у диктофона.

import { ink, ORANGE, paintScreen } from "./look";
import type { Aura } from "./aura";

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;
export type Mark = { at: number; kind: "reply" | "reaction"; text: string; count?: number; aura?: Aura };

export const N = 40; // разрешение огибающей записи

const SAMPLE_MS = 45;

export class Visual {
  private ctx: CanvasRenderingContext2D;
  private env = 0;
  private toneLv = 0.3;
  private source: LevelSource | null = null;
  private progress = 0;
  private marks: Mark[] = [];
  private flashes: { at: number; t0: number }[] = [];
  private shape: ArrayLike<number> | null = null;
  private mode: "play" | "rec" = "play";
  private signAt = -1; // место крестика в сетке плюсов (0..7); −1 — знака нет
  private signCol = "";
  private search = false;
  private hist: number[] = [];
  private lastSample = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  setSource(src: LevelSource | null) {
    this.source = src;
  }

  setProgress(p: number) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  setMarks(m: Mark[]) {
    this.marks = m;
  }

  // аура больше не красит экран: голос узнаётся по волне. Оставлено для совместимости вызовов
  setAura(_a: Aura) {}

  // личный знак говорящего: крестик на своём месте в сетке плюсов, своего цвета
  setSign(at: number, color: string) {
    this.signAt = at;
    this.signCol = color;
  }

  // стрелку шкалы ведут: вместо записи — шум эфира
  setSearching(on: boolean) {
    this.search = on;
  }

  // форма записи (огибающая 0..1); без неё — пунктир, пока запись разбирается
  setEnv(e: ArrayLike<number> | null | undefined) {
    this.shape = e && e.length ? e : null;
  }

  // «rec» — волна растёт из живого уровня; «play» — вся запись и метка
  setMode(m: "play" | "rec") {
    this.mode = m;
    if (m === "rec") this.hist = [];
  }

  // мягкая вспышка — отклик на только что поставленную реакцию
  flash(at: number) {
    this.flashes.push({ at, t0: performance.now() });
  }

  get level() {
    return this.env;
  }

  get tone() {
    return this.toneLv;
  }

  // примерный размер экрана — по нему считаются мелкие смещения
  get ringRadiusCss() {
    return (Math.min(this.w, this.h) * 0.31) / this.dpr;
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.round(this.canvas.clientWidth * this.dpr);
    this.h = Math.round(this.canvas.clientHeight * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    // громкость и тембр считаем всегда — решётка динамика берёт их отсюда даже при скрытом экране
    const s = this.source?.() ?? null;
    const target = s ? s.level : 0;
    this.env += (target - this.env) * (target > this.env ? 0.45 : 0.1);
    this.toneLv += ((s?.tone ?? 0.3) - this.toneLv) * 0.08;
    if (this.mode === "rec" && s && now - this.lastSample > SAMPLE_MS) {
      this.lastSample = now;
      this.hist.push(Math.min(1, this.env * (0.6 + 0.6 * Math.random())));
      if (this.hist.length > 600) this.hist.shift();
    }
    if (!this.w || !this.h) return;

    const ctx = this.ctx;
    const d = this.dpr;
    const c = ink();
    const W = this.w;
    const H = this.h;
    paintScreen(ctx, W, H, d);

    // печатная графика: сетка плюсов с одним крестиком и три кольца — тихо, цветом «faint»
    plusGrid(ctx, W - 80 * d, 46 * d, 4, 2, 20 * d, 5 * d, c.faint, d, this.signAt >> 2, this.signAt < 0 ? -1 : this.signAt & 3, this.signCol || c.faint);
    // три кольца — только на экране записи: в эфире это место занято именем говорящего
    if (this.mode === "rec") ringTrio(ctx, W - 26 * d, H - 118 * d, 8 * d, 22 * d, c.faint, d);

    const x0 = 18 * d;
    const x1 = W - 18 * d;
    const cy = Math.round(H * 0.42);
    const maxH = Math.min(H * 0.3, 120 * d);

    if (this.mode === "rec") {
      const step = 6 * d;
      const stop = Math.round(W * 0.62);
      const n = this.hist.length;
      const head = Math.min(x0 + n * step, stop);
      const count = Math.floor((head - x0) / step) + 1;
      ctx.fillStyle = c.ink;
      for (let i = 0; i < count && i < n; i++) {
        const v = this.hist[n - 1 - i];
        const bh = Math.max(2 * d, v * maxH);
        ctx.fillRect(Math.round(head - i * step - d), Math.round(cy - bh / 2), 2 * d, Math.round(bh));
      }
      ticks(ctx, head + step, x1, cy, step, c.faint, d);
      if (n) playhead(ctx, head, cy - maxH * 0.62, cy + maxH * 0.62, d);
      return;
    }

    if (this.search) {
      // поиск: столбики дрожат вместе с шумом и обрывками голосов
      ctx.fillStyle = c.dim;
      for (let x = x0; x <= x1; x += 6 * d) {
        const bh = Math.max(2 * d, (0.08 + Math.random() * (0.25 + this.env * 0.6)) * maxH);
        ctx.fillRect(Math.round(x - d), Math.round(cy - bh / 2), 2 * d, Math.round(bh));
      }
      return;
    }

    const hx = x0 + (x1 - x0) * this.progress;
    if (this.shape) {
      const len = this.shape.length;
      const step = (x1 - x0) / Math.max(1, len - 1);
      let peak = 0;
      for (let i = 0; i < len; i++) peak = Math.max(peak, this.shape[i]);
      for (let i = 0; i < len; i++) {
        const x = x0 + i * step;
        const near = Math.abs(x - hx) < step * 2.2 ? 1 + this.env * 0.9 : 1;
        const v = this.shape[i] / (peak || 1);
        const bh = Math.max(2 * d, (0.12 + 0.88 * v) * maxH * near);
        ctx.fillStyle = x <= hx + 0.5 ? c.ink : c.faint;
        ctx.fillRect(Math.round(x - d), Math.round(cy - bh / 2), 2 * d, Math.round(bh));
      }
    } else ticks(ctx, x0, x1, cy, 6 * d, c.faint, d);

    // ответы: ⊕ на своём моменте, нить к волне; прозвучавшие — оранжевые
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const top = cy - maxH * 0.5 - 30 * d;
    for (const m of this.marks) {
      const x = x0 + (x1 - x0) * m.at;
      const done = m.at <= this.progress + 0.002;
      if (m.kind === "reply") {
        ctx.strokeStyle = done ? ORANGE : c.dim;
        ctx.lineWidth = 1.5 * d;
        ctx.beginPath();
        ctx.moveTo(x, top + 9 * d);
        ctx.lineTo(x, cy - maxH * 0.5 + 4 * d);
        ctx.stroke();
        ctx.fillStyle = done ? ORANGE : c.scr;
        ctx.beginPath();
        ctx.arc(x, top, 8 * d, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = done ? "#2A1206" : c.dim;
        ctx.beginPath();
        ctx.moveTo(x - 4 * d, top);
        ctx.lineTo(x + 4 * d, top);
        ctx.moveTo(x, top - 4 * d);
        ctx.lineTo(x, top + 4 * d);
        ctx.stroke();
      } else {
        // популярность — размером, а не цифрой
        const size = (13 + Math.min(m.count ?? 1, 12)) * d;
        ctx.globalAlpha = done ? 1 : 0.55;
        ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText(m.text, Math.min(Math.max(x, size), W - size), cy + maxH * 0.5 + 14 * d);
        ctx.globalAlpha = 1;
      }
    }

    this.flashes = this.flashes.filter((f) => now - f.t0 < 1000);
    for (const f of this.flashes) {
      const k = (now - f.t0) / 1000;
      ctx.strokeStyle = ORANGE;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2 * d;
      ctx.beginPath();
      ctx.arc(x0 + (x1 - x0) * f.at, cy, (6 + k * 34) * d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    playhead(ctx, hx, cy - maxH * 0.62, cy + maxH * 0.62, d);
  };
}

function playhead(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, d: number) {
  ctx.fillStyle = ORANGE;
  ctx.fillRect(Math.round(x - d), y0, 2 * d, y1 - y0);
  ctx.beginPath();
  ctx.arc(x, y0, 5 * d, 0, Math.PI * 2);
  ctx.fill();
}

function ticks(ctx: CanvasRenderingContext2D, from: number, to: number, cy: number, step: number, col: string, d: number) {
  ctx.fillStyle = col;
  for (let x = from; x < to; x += step) ctx.fillRect(Math.round(x), cy - 3 * d, d, 6 * d);
}

export function plusGrid(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, gap: number, s: number, col: string, d: number, xr = 1, xc = 2, xcol = col) {
  ctx.lineWidth = 1.6 * d;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const px = x + k * gap;
      const py = y + r * gap;
      ctx.strokeStyle = r === xr && k === xc ? xcol : col;
      ctx.beginPath();
      if (r === xr && k === xc) {
        const q = s * 0.7;
        ctx.moveTo(px - q, py - q);
        ctx.lineTo(px + q, py + q);
        ctx.moveTo(px + q, py - q);
        ctx.lineTo(px - q, py + q);
      } else {
        ctx.moveTo(px - s, py);
        ctx.lineTo(px + s, py);
        ctx.moveTo(px, py - s);
        ctx.lineTo(px, py + s);
      }
      ctx.stroke();
    }
}

function ringTrio(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, col: string, d: number) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4 * d;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y + i * gap, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x, y + r * 0.5);
  ctx.stroke();
}

// решётка динамика под экраном: точки вспыхивают оранжевым на громких местах
export class Grille {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bins = new Float32Array(48);

  constructor(private canvas: HTMLCanvasElement, private level: () => number) {
    this.ctx = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.round(this.canvas.clientWidth * this.dpr);
    this.h = Math.round(this.canvas.clientHeight * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    if (!this.w || !this.h) return;
    const lv = this.level();
    for (let i = 0; i < this.bins.length; i++) {
      const wobble = 0.5 + 0.5 * Math.sin(i * 1.7 + now / 90);
      this.bins[i] += (lv * wobble * 1.4 - this.bins[i]) * 0.3;
    }
    const ctx = this.ctx;
    const d = this.dpr;
    ctx.clearRect(0, 0, this.w, this.h);
    const sp = 6 * d;
    const cols = Math.floor(this.w / sp);
    const rows = Math.floor(this.h / sp);
    const ox = (this.w - (cols - 1) * sp) / 2;
    const oy = (this.h - (rows - 1) * sp) / 2;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const b = this.bins[(k * 3 + r * 5) % this.bins.length];
        ctx.fillStyle = b > 0.5 ? ORANGE : "#B7B8B1";
        ctx.beginPath();
        ctx.arc(ox + k * sp, oy + r * sp, (1.35 + Math.min(b, 1) * 1.1) * d, 0, Math.PI * 2);
        ctx.fill();
      }
  };
}
