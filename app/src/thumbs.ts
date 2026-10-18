// Статичная графика на Canvas 2D: мини-кольца из точек (сторис, строки)
// и ступенчатый график записи (потоки, прогресс в плеере).

import { ACCENT } from "./visual";

const INK = "#111111";
const DOT = "#9A9A98";
const LINE = "#B9B9B6";
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function setup(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return null;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, dpr };
}

// мини «кольцо расхождения»: тонкий круг, распушённый там, где в записи голос
export function drawRing(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, dark = false) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, dpr } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.3;
  const col = dark ? "17,17,17" : "150,150,148";
  ctx.strokeStyle = `rgba(${col},0.9)`;
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  if (!env?.length) return;
  ctx.lineWidth = 0.6 * dpr;
  const n = 260;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const e = env[Math.min(env.length - 1, Math.floor(t * env.length))];
    if (e < 0.05) continue;
    // детерминированный «шум», чтобы превью не мерцали при перерисовке
    const r1 = Math.sin(i * 12.9898) * 43758.5453;
    const k = r1 - Math.floor(r1);
    const side = k < 0.72 ? 1 : -1;
    const L = e * e * R * 0.55 * Math.pow(k, 1.4);
    const a = t * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = `rgba(${col},${0.25 + 0.5 * k})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R + side * L), cy + Math.sin(a) * (R + side * L));
    ctx.stroke();
  }
}

// огибающая → n ступеней (среднее по участку)
export function toSteps(env: ArrayLike<number>, n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * env.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * env.length) / n));
    let sum = 0;
    for (let j = a; j < b; j++) sum += env[j];
    out.push(sum / (b - a));
  }
  return out;
}

type StepOpts = { steps?: number; progress?: number; top?: string; left?: string; right?: string };

// ступенчатый график; текущая ступень — оранжевая с заливкой вниз
export function drawSteps(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, o: StepOpts = {}) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, dpr } = s;
  const n = o.steps ?? 14;
  const vals = env ? toSteps(env, n) : new Array(n).fill(0.15);
  const max = Math.max(...vals, 0.001);
  const labels = !!(o.top || o.left || o.right);
  const padTop = labels ? 22 * dpr : 4 * dpr;
  const base = h - 4 * dpr;
  const sw = w / n;
  const y = (v: number) => base - (v / max) * (base - padTop) * 0.85 - 2 * dpr;
  const cur = o.progress === undefined ? -1 : Math.min(n - 1, Math.floor(o.progress * n));

  // заливка текущей ступени
  if (cur >= 0) {
    const g = ctx.createLinearGradient(0, y(vals[cur]), 0, base);
    g.addColorStop(0, "rgba(255,91,31,0.32)");
    g.addColorStop(1, "rgba(255,91,31,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cur * sw, y(vals[cur]), sw, base - y(vals[cur]));
  }

  // линия-ступенька
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const yy = y(v);
    if (i === 0) ctx.moveTo(0, yy);
    else ctx.lineTo(i * sw, yy);
    ctx.lineTo((i + 1) * sw, yy);
  });
  ctx.stroke();

  if (cur >= 0) {
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(cur * sw, y(vals[cur]));
    ctx.lineTo((cur + 1) * sw, y(vals[cur]));
    ctx.stroke();
  }

  if (labels) {
    ctx.font = `400 ${9.5 * dpr}px ${MONO}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = DOT;
    if (o.left) ctx.fillText(o.left, 0, 2 * dpr);
    if (o.right) {
      ctx.textAlign = "right";
      ctx.fillText(o.right, w, 2 * dpr);
      ctx.textAlign = "left";
    }
    if (o.top && cur >= 0) {
      ctx.fillStyle = INK;
      ctx.textBaseline = "bottom";
      const x = Math.min(Math.max(cur * sw, 0), w - ctx.measureText(o.top).width);
      ctx.fillText(o.top, x, y(vals[cur]) - 5 * dpr);
    }
  }
}

// склеивает огибающие нескольких записей в одну, с паузами между ними
export function joinEnvelopes(envs: ArrayLike<number>[], n: number) {
  const gap = [0, 0, 0, 0];
  const all = envs.flatMap((e, i) => (i ? [...gap, ...Array.from(e)] : Array.from(e)));
  if (!all.length) return undefined;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * all.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * all.length) / n));
    let max = 0;
    for (let j = from; j < to; j++) max = Math.max(max, all[j]);
    out[i] = max;
  }
  return out;
}
