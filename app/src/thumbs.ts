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

// мини-персонаж: светлая жемчужная капля, сквозь неё — аура автора.
// a = null — просмотрено: аура бледная, глаза закрыты
export function drawRing(canvas: HTMLCanvasElement, _env: ArrayLike<number> | undefined, a: Aura | null) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, dpr } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.38;
  const [h1, h2, h3] = a ?? [230, 250, 210];
  const vivid = a ? 1 : 0.35;

  // аура вокруг и чуть ниже капли: три цветных пятна
  for (const [hue, dx, dy] of [[h1, -0.35, -0.1], [h2, 0.4, 0.25], [h3, 0, 0.5]] as const) {
    const x = cx + dx * R;
    const y = cy + dy * R;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.25);
    g.addColorStop(0, hsl(hue, 0.75 * vivid, 70));
    g.addColorStop(1, hsl(hue, 0, 70));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // тело: светлое жемчужное стекло, снизу — отсвет ауры
  const body = ctx.createRadialGradient(cx, cy - R * 0.1, R * 0.1, cx, cy, R);
  body.addColorStop(0, "rgba(255,255,255,0.9)");
  body.addColorStop(0.7, "rgba(248,244,253,0.75)");
  body.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  const tint = ctx.createRadialGradient(cx + R * 0.3, cy + R * 0.5, 0, cx + R * 0.3, cy + R * 0.5, R * 0.8);
  tint.addColorStop(0, hsl(h2, 0.55 * vivid, 72));
  tint.addColorStop(1, hsl(h2, 0, 72));
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // жемчужная кромка
  const rim = ctx.createConicGradient(0, cx, cy);
  ["#ffb3d1", "#c9a8ff", "#9fd3ff", "#8ff0d8", "#fff0a8", "#ffc4a3", "#ffb3d1"].forEach((col, i, all) => rim.addColorStop(i / (all.length - 1), col));
  ctx.strokeStyle = rim;
  ctx.globalAlpha = a ? 0.9 : 0.4;
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, R - dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // блики
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.32, cy - R * 0.5, R * 0.22, R * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // глаза: глубокие, в тон ауры; закрытые — чёрточки
  ctx.fillStyle = a ? `oklch(0.34 0.08 ${h1})` : "oklch(0.55 0.02 250)";
  const ew = R * 0.14;
  const eh = a ? R * 0.36 : R * 0.07;
  for (const dx of [-R * 0.21, R * 0.21]) {
    ctx.beginPath();
    ctx.roundRect(cx + dx - ew / 2, cy - eh / 2 - R * 0.02, ew, eh, ew / 2);
    ctx.fill();
  }
}
