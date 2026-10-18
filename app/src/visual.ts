// «Кольцо расхождения» (по мотивам Rehoboam): тишина — идеально ровный тонкий круг,
// голос «распушает» линию там, где он звучит. Кольцо — время записи по часовой стрелке
// от верха. Реакции и ответы — метки с выносками на том моменте, к которому они относятся.
// Единственное оранжевое — «сейчас» и только что поставленная метка.

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;
export type Mark = { at: number; kind: "reply" | "reaction"; title: string; sub: string };
// что написано внутри кольца: тег, автор, секунды пиксельными цифрами, подпись
export type Readout = { top?: string; title?: string; digits?: string; label?: string; accent?: string };

export const N = 40; // разрешение огибающей записи
const TRACE = 120; // разрешение живого следа при записи
const FIBERS = 1500;

const INK = "17,17,17";
const GREY = "150,150,148";
export const ACCENT = "#FF5B1F";
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// 5×7 пиксельный шрифт для цифр
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
};

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
    return (Math.min(this.w, this.h) * 0.255) / this.dpr;
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
    const R = Math.min(this.w, this.h) * 0.255;
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
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(nx, ny, 4 * this.dpr, 0, TAU);
      ctx.fill();
    }

    this.drawReadout(cx, cy, R);
  };

  private drawMarks(cx: number, _cy: number, R: number, p: number, now: number, pos: (a: number, r: number) => number[]) {
    const ctx = this.ctx;
    const d = this.dpr;
    const fs = 9.5 * d;
    ctx.font = `500 ${fs}px ${MONO}`;
    ctx.textBaseline = "middle";
    this.flashes = this.flashes.filter((f) => now - f.t0 < 1400);

    for (const m of this.marks) {
      const passed = m.at <= p + 0.002;
      const hot = this.flashes.some((f) => Math.abs(f.at - m.at) < 0.03);
      const col = hot ? ACCENT : passed ? `rgb(${INK})` : `rgba(${GREY},0.9)`;
      const spread = this.envAt(m.at);
      const [ax, ay] = pos(m.at, R + spread * spread * 0.34 * R + 6 * d);
      const [bx, by] = pos(m.at, R * 1.3 + 8 * d);
      const right = bx >= cx;
      const ex = bx + (right ? 6 : -6) * d;

      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 0.8 * d;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(ex, by);
      ctx.stroke();
      // ответ — квадрат, реакция — точка
      if (m.kind === "reply") ctx.fillRect(ax - 2.5 * d, ay - 2.5 * d, 5 * d, 5 * d);
      else {
        ctx.beginPath();
        ctx.arc(ax, ay, 2.2 * d, 0, Math.PI * 2);
        ctx.fill();
      }

      const room = right ? this.w - ex - 4 * d : ex - 4 * d;
      ctx.textAlign = right ? "left" : "right";
      const tx = ex + (right ? 4 : -4) * d;
      ctx.fillText(fit(ctx, m.title, room), tx, by - fs * 0.62);
      ctx.fillStyle = hot ? ACCENT : `rgba(${GREY},1)`;
      ctx.fillText(fit(ctx, m.sub, room), tx, by + fs * 0.62);
    }
    ctx.textAlign = "left";

    for (const f of this.flashes) {
      const k = (now - f.t0) / 1400;
      const [fx, fy] = pos(f.at, R);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.arc(fx, fy, (4 + k * 22) * d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawReadout(cx: number, cy: number, R: number) {
    const ctx = this.ctx;
    const { top, title, digits, label, accent } = this.readout;
    const d = this.dpr;
    const room = R * 1.55;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (top) {
      ctx.font = `500 ${9.5 * d}px ${MONO}`;
      ctx.fillStyle = ACCENT;
      ctx.fillText(fit(ctx, top, room), cx, cy - R * 0.5);
    }
    if (title) {
      ctx.font = `600 ${15 * d}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = `rgb(${INK})`;
      ctx.fillText(fit(ctx, title, room), cx, cy - R * 0.27);
    }
    if (digits) {
      const cell = Math.max(2, Math.round(R * (title ? 0.045 : 0.07)));
      const gap = Math.max(1, Math.round(cell * 0.2));
      const glyphW = 5 * cell;
      const totalW = digits.length * glyphW + (digits.length - 1) * cell;
      let x0 = Math.round(cx - totalW / 2);
      const y0 = Math.round(title ? cy - R * 0.06 : cy - 3.5 * cell - (label ? cell : 0));
      ctx.fillStyle = `rgb(${INK})`;
      for (const ch of digits) {
        const g = GLYPHS[ch];
        if (g)
          for (let r = 0; r < 7; r++)
            for (let c = 0; c < 5; c++)
              if (g[r][c] === "1") ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - gap, cell - gap);
        x0 += glyphW + cell;
      }
    }
    if (label) {
      ctx.font = `500 ${9.5 * d}px ${MONO}`;
      const y = cy + R * (title ? 0.5 : 0.36);
      const full = label + (accent ? " " + accent : "");
      ctx.textAlign = "left";
      let x = cx - ctx.measureText(full).width / 2;
      ctx.fillStyle = `rgba(${GREY},1)`;
      ctx.fillText(label, x, y);
      if (accent) {
        x += ctx.measureText(label + " ").width;
        ctx.fillStyle = ACCENT;
        ctx.fillText(accent, x, y);
      }
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
