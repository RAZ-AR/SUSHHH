// «Кольцо расхождения» (по мотивам Rehoboam): тишина — идеально ровный тонкий круг,
// голос «распушает» линию там, где он звучит. Кольцо — время записи по часовой стрелке
// от верха. Реакции и ответы — пузырьки на том моменте, к которому они относятся.
// Неоморфизм «единорог»: прослушанное переливается пастелью по кругу,
// «сейчас» — светящаяся мятная точка.

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;
// реакция — светлый пузырёк «😂 8», ответ — тёмный «↳»
export type Mark = { at: number; kind: "reply" | "reaction"; text: string };
// внутри кольца: главное (автор или время) и тихая подпись под ним
export type Readout = { title?: string; sub?: string; big?: boolean };

export const N = 40; // разрешение огибающей записи

const INK = "79,93,117";
const GREY = "163,177,198";
const MINT = "#6bf2c8";
const BG = "#e8edf4";
const SANS = '"Nunito", -apple-system, "Helvetica Neue", Arial, sans-serif';
// перелив по кругу: голубой → сирень → розовый → мята → лимон → снова голубой
const UNI = ["#7fd8ea", "#a48cf2", "#ee8fcd", "#7fe0b0", "#e8d77a", "#7fd8ea"];

function uniGradient(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const g = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  UNI.forEach((c, i) => g.addColorStop(i / (UNI.length - 1), c));
  return g;
}

export class Visual {
  private ctx: CanvasRenderingContext2D;
  private env = 0;
  private toneLv = 0.3;
  private source: LevelSource | null = null;
  private tracing = false;
  private progress = 0;
  private marks: Mark[] = [];
  private flashes: { at: number; t0: number }[] = [];
  private readout: Readout = {};
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

  // оранжевый импульс на моменте записи — отклик на только что поставленную реакцию
  flash(at: number) {
    this.flashes.push({ at, t0: performance.now() });
  }

  // запись: голос сам «рисует» след по кольцу по мере хода времени
  setTracing(on: boolean) {
    this.tracing = on;
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

  // тембр 0..1 — сдвигает оттенки свечения
  get tone() {
    return this.toneLv;
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
    const ctx = this.ctx;
    const s = this.source?.() ?? null;
    const target = s ? s.level : 0;
    this.env += (target - this.env) * (target > this.env ? 0.45 : 0.1);
    this.toneLv += ((s?.tone ?? 0.3) - this.toneLv) * 0.08;
    const p = this.progress;


    ctx.clearRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = Math.min(this.w, this.h) * 0.31;
    const TAU = Math.PI * 2;
    const pos = (a: number, r: number) => [cx + Math.cos(a * TAU - Math.PI / 2) * r, cy + Math.sin(a * TAU - Math.PI / 2) * r];
    const live = !!s || this.tracing;

    // на диске нет волн: голос живёт в цветном свечении за диском (CSS, --lv и --tone).
    // Здесь — только тонкая дорожка времени: пройденное переливом, остальное едва видно
    const uni = uniGradient(ctx, cx, cy);
    ctx.lineWidth = 1 * this.dpr;
    ctx.strokeStyle = `rgba(${GREY},0.35)`;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2 + p * TAU, -Math.PI / 2 + TAU);
    ctx.stroke();
    if (p > 0) {
      ctx.lineWidth = 2.5 * this.dpr;
      ctx.strokeStyle = uni;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.stroke();
    }

    this.drawMarks(cx, cy, R, p, now, pos);

    // «сейчас» — светящаяся мятная точка, как индикатор «вкл» в Soft GUI
    if (p > 0 || live) {
      const [nx, ny] = pos(p, R);
      ctx.save();
      ctx.shadowColor = MINT;
      ctx.shadowBlur = 12 * this.dpr;
      ctx.fillStyle = "#f6fffb";
      ctx.beginPath();
      ctx.arc(nx, ny, 5.5 * this.dpr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = MINT;
      ctx.beginPath();
      ctx.arc(nx, ny, 3 * this.dpr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    this.drawReadout(cx, cy, R);
  };

  private drawMarks(_cx: number, _cy: number, R: number, p: number, now: number, pos: (a: number, r: number) => number[]) {
    const ctx = this.ctx;
    const d = this.dpr;
    const fs = 12 * d;
    const h = 24 * d;
    ctx.font = `700 ${fs}px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    this.flashes = this.flashes.filter((f) => now - f.t0 < 1400);

    for (const m of this.marks) {
      const passed = m.at <= p + 0.002;
      const [x, y] = pos(m.at, R + 24 * d);
      const w = Math.max(h, ctx.measureText(m.text).width + 16 * d);
      // пузырёк не вылезает за края холста
      const bx = Math.min(Math.max(x, w / 2 + 2 * d), this.w - w / 2 - 2 * d);
      const by = Math.min(Math.max(y, h / 2 + 2 * d), this.h - h / 2 - 2 * d);
      const reply = m.kind === "reply";
      ctx.globalAlpha = passed ? 1 : 0.6;
      // выпуклая таблетка: тёмная тень снизу-справа и светлая сверху-слева
      ctx.save();
      for (const [ox, oy, col] of [[2.5, 2.5, `rgba(${GREY},0.7)`], [-2, -2, "rgba(255,255,255,0.9)"]] as const) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 5 * d;
        ctx.shadowOffsetX = ox * d;
        ctx.shadowOffsetY = oy * d;
        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.roundRect(bx - w / 2, by - h / 2, w, h, h / 2);
        ctx.fill();
      }
      ctx.restore();
      if (reply) {
        const g = ctx.createLinearGradient(bx - w / 2, by - h / 2, bx + w / 2, by + h / 2);
        g.addColorStop(0, UNI[0]);
        g.addColorStop(0.5, UNI[1]);
        g.addColorStop(1, UNI[2]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(bx - w / 2, by - h / 2, w, h, h / 2);
        ctx.fill();
      }
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
      ctx.strokeStyle = MINT;
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
      ctx.font = `${big ? 700 : 800} ${ts}px ${SANS}`;
      ctx.fillStyle = `rgb(${INK})`;
      ctx.fillText(fit(ctx, title, _R * 1.5), cx, sub ? cy - ts * 0.35 : cy);
    }
    if (sub) {
      ctx.font = `700 ${13 * d}px ${SANS}`;
      ctx.fillStyle = "#97b6ca";
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
