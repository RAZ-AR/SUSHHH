// Диск голоса. Сам диск — чистый: ни текста, ни дорожки. Голос живёт в цветном свечении
// за диском (CSS, --lv и --tone), имя и прогресс — под диском. Этот холст рисует только
// метки вокруг края: реакции — эмодзи (чем больше их, тем крупнее), ответы — точки цвета
// ауры того, кто ответил. Метки стоят на том моменте записи, к которому относятся.

import { hsl, type Aura } from "./aura";

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;
export type Mark = { at: number; kind: "reply" | "reaction"; text: string; count?: number; aura?: Aura };

export const N = 40; // разрешение огибающей записи

export class Visual {
  private ctx: CanvasRenderingContext2D;
  private env = 0;
  private toneLv = 0.3;
  private source: LevelSource | null = null;
  private progress = 0;
  private marks: Mark[] = [];
  private flashes: { at: number; t0: number }[] = [];
  private aura: Aura = [190, 250, 320];
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

  setAura(a: Aura) {
    this.aura = a;
  }

  // мягкая вспышка у края — отклик на только что поставленную реакцию
  flash(at: number) {
    this.flashes.push({ at, t0: performance.now() });
  }

  get level() {
    return this.env;
  }

  // тембр 0..1 — сдвигает оттенки свечения
  get tone() {
    return this.toneLv;
  }

  // радиус диска в CSS-пикселях — по нему CSS рисует диск и свечение
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
    if (!this.w || !this.h) return;
    const s = this.source?.() ?? null;
    const target = s ? s.level : 0;
    this.env += (target - this.env) * (target > this.env ? 0.45 : 0.1);
    this.toneLv += ((s?.tone ?? 0.3) - this.toneLv) * 0.08;

    const ctx = this.ctx;
    const d = this.dpr;
    ctx.clearRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = Math.min(this.w, this.h) * 0.31;
    const pos = (a: number, r: number) => [
      cx + Math.cos(a * Math.PI * 2 - Math.PI / 2) * r,
      cy + Math.sin(a * Math.PI * 2 - Math.PI / 2) * r,
    ];

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const m of this.marks) {
      // ещё не прозвучавшие метки бледнее
      ctx.globalAlpha = m.at <= this.progress + 0.002 ? 1 : 0.5;
      if (m.kind === "reply") {
        const a = m.aura ?? this.aura;
        const [x, y] = pos(m.at, R + 14 * d);
        const g = ctx.createLinearGradient(x - 7 * d, y - 7 * d, x + 7 * d, y + 7 * d);
        g.addColorStop(0, hsl(a[0], 1, 66));
        g.addColorStop(1, hsl(a[1], 1, 70));
        ctx.save();
        ctx.shadowColor = hsl(a[0], 0.6, 66);
        ctx.shadowBlur = 8 * d;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 6 * d, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5 * d;
        ctx.stroke();
      } else {
        // популярность — размером, а не цифрой
        const size = (15 + Math.min(m.count ?? 1, 12) * 1.2) * d;
        const [x, y] = pos(m.at, R + size * 0.75);
        ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText(m.text, Math.min(Math.max(x, size), this.w - size), Math.min(Math.max(y, size), this.h - size));
      }
    }
    ctx.globalAlpha = 1;

    this.flashes = this.flashes.filter((f) => now - f.t0 < 1200);
    for (const f of this.flashes) {
      const k = (now - f.t0) / 1200;
      const [fx, fy] = pos(f.at, R);
      ctx.strokeStyle = hsl(this.aura[0], 1 - k, 66);
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.arc(fx, fy, (4 + k * 22) * d, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
}
