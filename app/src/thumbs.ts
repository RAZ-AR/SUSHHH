// Мини-кольца расхождения на Canvas 2D — превью в сторис и в «Моё».

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

import { hsl, type Aura } from "./aura";

// мини-превью записи: белый диск, за ним пятна ауры автора — ярче там, где в записи громче.
// a = null — приглушённо серым (просмотрено)
export function drawRing(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, a: Aura | null) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;

  // энергия по пяти секторам записи
  const n = 5;
  const hues = a ? [a[0], a[1], a[2], a[0], a[1]] : [];
  const energy = new Array(n).fill(0.35);
  if (env?.length) {
    for (let k = 0; k < n; k++) {
      let sum = 0;
      const from = Math.floor((k * env.length) / n);
      const to = Math.floor(((k + 1) * env.length) / n);
      for (let j = from; j < to; j++) sum += env[j];
      energy[k] = sum / Math.max(1, to - from);
    }
  }

  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R * 0.42;
    const y = cy + Math.sin(a) * R * 0.42;
    const r = R * (0.45 + energy[k] * 0.55);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = a ? 0.4 + energy[k] * 0.55 : 0.18;
    g.addColorStop(0, a ? hsl(hues[k], alpha, 74) : `rgba(163,177,198,${alpha})`);
    g.addColorStop(1, a ? hsl(hues[k], 0, 74) : "rgba(163,177,198,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // белый выпуклый диск в центре
  const d = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  d.addColorStop(0, "#f8fbff");
  d.addColorStop(1, "#e3e8f0");
  ctx.fillStyle = d;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.56, 0, Math.PI * 2);
  ctx.fill();
}
