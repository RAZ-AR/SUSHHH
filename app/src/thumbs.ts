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

// мини-персонаж: матовое светлое тело, внутри — тёплое ядро цвета автора,
// снизу — холодный отсвет, края растворяются в ореоле.
// a = null — просмотрено: свет почти погас, глаза закрыты дугами
export function drawRing(canvas: HTMLCanvasElement, _env: ArrayLike<number> | undefined, a: Aura | null) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, dpr } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  const [h1, h2] = a ?? [250, 210];
  const vivid = a ? 1 : 0.3;

  // ореол: мягкий пастельный свет вокруг
  const halo = ctx.createRadialGradient(cx, cy + R * 0.1, R * 0.6, cx, cy + R * 0.1, R * 1.4);
  halo.addColorStop(0, hsl(h1, 0.8 * vivid, 78));
  halo.addColorStop(1, hsl(h1, 0, 80));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // тело: молочное, матовое
  ctx.fillStyle = "rgba(244,240,250,0.92)";
  ctx.fillRect(0, 0, w, h);
  // холодный отсвет снизу-слева
  const cool = ctx.createRadialGradient(cx - R * 0.5, cy + R * 0.8, 0, cx - R * 0.5, cy + R * 0.8, R * 1.1);
  cool.addColorStop(0, `oklch(0.8 ${0.1 * vivid} ${h1 + 170} / 0.8)`);
  cool.addColorStop(1, `oklch(0.8 0 ${h1 + 170} / 0)`);
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h);
  // тёплое ядро
  const core = ctx.createRadialGradient(cx, cy + R * 0.1, 0, cx, cy + R * 0.1, R * 1.05);
  core.addColorStop(0, `oklch(0.78 ${0.17 * vivid} ${h1 + 10} / 0.95)`);
  core.addColorStop(0.55, `oklch(0.84 ${0.12 * vivid} ${h2} / 0.6)`);
  core.addColorStop(1, `oklch(0.9 0 ${h2} / 0)`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);
  // края светлеют и растворяются
  const edge = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
  edge.addColorStop(0, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(255,255,255,0.7)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // глаза: открытые — тихие капсулы, закрытые — дуги ‿ ‿
  const ink = `oklch(${a ? 0.32 : 0.5} 0.05 ${h1 + 20})`;
  for (const dx of [-R * 0.24, R * 0.24]) {
    if (a) {
      const ew = R * 0.11;
      const eh = R * 0.3;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.roundRect(cx + dx - ew / 2, cy - eh / 2 - R * 0.06, ew, eh, ew / 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6 * dpr;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx + dx, cy - R * 0.12, R * 0.11, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
}
