// Статичные мини-портреты на Canvas 2D для сторис и карточек потоков:
// WebGL-контекстов в браузере мало, а превью нужно много.

import type { Palette } from "./visual";

export function drawPortrait(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, p: Palette, gain = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, p.bgTop);
  bg.addColorStop(1, p.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const n = env?.length ?? 0;
  if (!n) return;
  const m = w * 0.06;
  const bw = (w - 2 * m) / n;
  const cy = h / 2;

  for (let i = 0; i < n; i++) {
    const a = env![i];
    const half = (0.03 + a * 0.3 * gain) * h * 1.35;
    const g = ctx.createLinearGradient(0, cy - half, 0, cy + half);
    g.addColorStop(0, hexA(p.edge, 0));
    g.addColorStop(0.18, p.edge);
    g.addColorStop(0.36, p.mid);
    g.addColorStop(0.5, p.core);
    g.addColorStop(0.64, p.mid);
    g.addColorStop(0.82, p.edge);
    g.addColorStop(1, hexA(p.edge, 0));
    ctx.fillStyle = g;
    ctx.fillRect(m + i * bw, cy - half, bw + 0.6, half * 2);
    // тень у левого края полосы — те же «рёбра», что в шейдере
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(m + i * bw, cy - half, bw * 0.18, half * 2);
  }
}

function hexA(hex: string, a: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

// склеивает огибающие нескольких записей в одну полосу из n значений;
// между записями — пауза, чтобы было видно, сколько голосов в потоке
export function joinEnvelopes(envs: ArrayLike<number>[], n: number) {
  const gap = [0, 0, 0, 0, 0, 0];
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
