// «Кольцо расхождения» (по мотивам Rehoboam): тишина — идеально ровный тонкий круг,
// голос «распушает» линию там, где он звучит. Кольцо — время записи по часовой стрелке
// от верха. Реакции и ответы — пузырьки на том моменте, к которому они относятся.
// Никакого цвета, кроме эмодзи: «сейчас» — тёмная точка.

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;
// реакция — светлый пузырёк «😂 8», ответ — тёмный «↳»
export type Mark = { at: number; kind: "reply" | "reaction"; text: string };
// внутри кольца: главное (автор или время) и тихая подпись под ним
export type Readout = { title?: string; sub?: string; big?: boolean };

export const N = 40; // разрешение огибающей записи
const TRACE = 120; // разрешение живого следа при записи
const FIBERS = 1500;

const INK = "31,31,31";
const GREY = "170,170,165";
const SANS = '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif';

export class Visual {
  private ctx: CanvasRenderingContext2D;
  private fa = new Float32Array(FIBERS); // угол 0..1
  private fl = new Float32Array(FIBERS); // длина 0..1
  private fs = new Float32Array(FIBERS); // наружу (1) или внутрь (-1)
  private fw = new Float32Array(FIBERS); // «толщина» 0..1 → прозрачность
  private env = 0;
  private source: LevelSource | null = null;
  private portrait = new Float32Array(N);
  private hasPortrait = false;
  private trace = new Float32Array(TRACE);
  private tracing = false;
  private progress = 0;
  private marks: Mark[] = [];
  private flashes: { at: number; t0: number }[] = [];
  private readout: Readout = {};
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    for (let i = 0; i < FIBERS; i++) {
      this.fa[i] = Math.random();
      this.fl[i] = Math.pow(Math.random(), 1.6);
      this.fs[i] = Math.random() < 0.72 ? 1 : -1;
      this.fw[i] = Math.random();
    }
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  setSource(src: LevelSource | null) {
    this.source = src;
  }

  setPortrait(env: ArrayLike<number> | null) {
    this.hasPortrait = !!env;
    this.portrait.fill(0);
    if (env) this.portrait.set(Array.from(env).slice(0, N));
  }

  setProgress(p: number) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  setMarks(m: Mark[]) {
    this.marks = m;
  }

  // оранжевый импульс на моменте записи — отклик на только что поставленную реакцию
  flash(at: number) {
    this.flashes.push({ at, t0: performance.now() });
  }

  // запись: голос сам «рисует» след по кольцу по мере хода времени
  setTracing(on: boolean) {
    this.tracing = on;
    if (on) this.trace.fill(0);
  }

  setReadout(r: Readout) {
    this.readout = r;
  }

  // геометрия кольца в CSS-пикселях — для перемотки пальцем по кольцу
  get ringRadiusCss() {
    return (Math.min(this.w, this.h) * 0.31) / this.dpr;
  }

  get level() {
    return this.env;
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.round(this.canvas.clientWidth * this.dpr);
    this.h = Math.round(this.canvas.clientHeight * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  private envAt(a: number) {
    if (this.tracing) return this.trace[Math.min(TRACE - 1, Math.floor(a * TRACE))];
    if (!this.hasPortrait) return 0;
    const x = a * (N - 1);
    const i = Math.floor(x);
    const f = x - i;
    return this.portrait[i] * (1 - f) + this.portrait[Math.min(N - 1, i + 1)] * f;
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    if (!this.w || !this.h) return;
    const ctx = this.ctx;
    const t = this.reduced ? 0 : now / 1000;
    const s = this.source?.() ?? null;
    const target = s ? s.level : 0;
    this.env += (target - this.env) * (target > this.env ? 0.45 : 0.1);
    const lv = this.env;
    const p = this.progress;

    if (this.tracing) {
      const i = Math.min(TRACE - 1, Math.floor(p * TRACE));
      this.trace[i] = Math.max(this.trace[i], Math.min(1, lv * 1.3));
    }

    ctx.clearRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = Math.min(this.w, this.h) * 0.31;
    const TAU = Math.PI * 2;
    const pos = (a: number, r: number) => [cx + Math.cos(a * TAU - Math.PI / 2) * r, cy + Math.sin(a * TAU - Math.PI / 2) * r];
    const live = !!s || this.tracing;

    // основа: пройденная часть — чернилами, остальное — тонко и серо
    ctx.lineWidth = 1 * this.dpr;
    ctx.strokeStyle = `rgba(${GREY},0.7)`;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2 + p * TAU, -Math.PI / 2 + TAU);
    ctx.stroke();
    if (p > 0) {
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.strokeStyle = `rgb(${INK})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.stroke();
    }

    // волокна: длина — громкость в этом месте записи, у «сейчас» — живая турбулентность
    const ink = [new Path2D(), new Path2D(), new Path2D()];
    const faint = new Path2D();
    for (let i = 0; i < FIBERS; i++) {
      const a = this.fa[i];
      const played = a <= p;
      const e = this.envAt(a);
      const back = p - a;
      const near = live && back >= 0 && back < 0.035 ? 1 - back / 0.035 : 0;
      if (e < 0.03 && near === 0) continue;
      if (!played && !this.hasPortrait) continue;
      const sway = near * lv * Math.sin(t * 9 + this.fw[i] * 40) * R * 0.08;
      const L = (e * e * 0.34 + near * lv * 0.22) * R * this.fl[i] + Math.abs(sway);
      const side = this.fs[i];
      const da = (this.fw[i] - 0.5) * 0.012 * (e + near);
      const [x1, y1] = pos(a, R);
      const [x2, y2] = pos(a + da, R + side * L);
      const path = played ? ink[Math.min(2, Math.floor(this.fw[i] * 3))] : faint;
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
    }
    ctx.lineWidth = 0.7 * this.dpr;
    ctx.strokeStyle = `rgba(${GREY},0.35)`;
    ctx.stroke(faint);
    [0.22, 0.42, 0.7].forEach((al, k) => {
      ctx.strokeStyle = `rgba(${INK},${al})`;
      ctx.stroke(ink[k]);
    });

    this.drawMarks(cx, cy, R, p, now, pos);

    // «сейчас»
    if (p > 0 || live) {
      const [nx, ny] = pos(p, R);
      ctx.fillStyle = `rgb(${INK})`;
      ctx.beginPath();
      ctx.arc(nx, ny, 4.5 * this.dpr, 0, TAU);
      ctx.fill();
    }

    this.drawReadout(cx, cy, R);
  };

  private drawMarks(_cx: number, _cy: number, R: number, p: number, now: number, pos: (a: number, r: number) => number[]) {
    const ctx = this.ctx;
    const d = this.dpr;
    const fs = 12 * d;
    const h = 24 * d;
    ctx.font = `500 ${fs}px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    this.flashes = this.flashes.filter((f) => now - f.t0 < 1400);

    for (const m of this.marks) {
      const passed = m.at <= p + 0.002;
      const spread = this.envAt(m.at);
      const [x, y] = pos(m.at, R + spread * spread * 0.34 * R + 22 * d);
      const w = Math.max(h, ctx.measureText(m.text).width + 16 * d);
      // пузырёк не вылезает за края холста
      const bx = Math.min(Math.max(x, w / 2 + 2 * d), this.w - w / 2 - 2 * d);
      const by = Math.min(Math.max(y, h / 2 + 2 * d), this.h - h / 2 - 2 * d);
      const reply = m.kind === "reply";
      ctx.globalAlpha = passed ? 1 : 0.55;
      ctx.fillStyle = reply ? `rgb(${INK})` : "#ffffff";
      ctx.beginPath();
      ctx.roundRect(bx - w / 2, by - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = reply ? "#ffffff" : `rgb(${INK})`;
      ctx.fillText(m.text, bx, by + 0.5 * d);
      // точка на самом кольце
      const [rx, ry] = pos(m.at, R);
      ctx.fillStyle = `rgb(${INK})`;
      ctx.beginPath();
      ctx.arc(rx, ry, 1.8 * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";

    for (const f of this.flashes) {
      const k = (now - f.t0) / 1400;
      const [fx, fy] = pos(f.at, R);
      ctx.strokeStyle = `rgb(${INK})`;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.arc(fx, fy, (4 + k * 22) * d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawReadout(cx: number, cy: number, _R: number) {
    const ctx = this.ctx;
    const { title, sub, big } = this.readout;
    const d = this.dpr;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ts = (big ? 40 : 18) * d;
    if (title) {
      ctx.font = `${big ? 500 : 600} ${ts}px ${SANS}`;
      ctx.fillStyle = `rgb(${INK})`;
      ctx.fillText(fit(ctx, title, _R * 1.5), cx, sub ? cy - ts * 0.35 : cy);
    }
    if (sub) {
      ctx.font = `500 ${13 * d}px ${SANS}`;
      ctx.fillStyle = `rgba(${GREY},1)`;
      ctx.fillText(fit(ctx, sub, _R * 1.5), cx, cy + (title ? ts * 0.6 : 0));
    }
    ctx.textAlign = "left";
  }
}

function fit(ctx: CanvasRenderingContext2D, s: string, room: number) {
  if (ctx.measureText(s).width <= room) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + "…").width > room) t = t.slice(0, -1);
  return t + "…";
}
