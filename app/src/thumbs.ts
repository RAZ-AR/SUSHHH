// Маленькие круглые экраны: сторис, плитки в «Моё», обложка для экрана блокировки.
// На каждом — мини-волна записи в чернилах экрана; просмотренные — бледнее.

import { ink, paintScreen } from "./look";
import type { Aura } from "./aura";

function setup(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // холст вне страницы (обложка для экрана блокировки) рисуется в своём заданном размере
  const w = canvas.isConnected ? Math.round(canvas.clientWidth * dpr) : canvas.width;
  const h = canvas.isConnected ? Math.round(canvas.clientHeight * dpr) : canvas.height;
  if (!w || !h) return null;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, d: canvas.isConnected ? dpr : w / 120 };
}

// без огибающей — псевдоволна по цвету автора, чтобы круги не были пустыми
function seeded(n: number, seed: number) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(0.18 + 0.82 * Math.pow(s / 233280, 1.3));
  }
  return out;
}

// a = null — просмотрено: чернила бледнее
export function drawRing(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, a: Aura | null) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, d } = s;
  const c = ink();
  const R = Math.min(w, h) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
  ctx.clip();
  paintScreen(ctx, w, h, d);

  const bars = 13;
  const src = env && env.length ? Array.from(env) : seeded(bars, 17 + (a?.[0] ?? 90));
  let peak = 0;
  for (const v of src) peak = Math.max(peak, v);
  const step = 4 * d;
  const x0 = w / 2 - ((bars - 1) * step) / 2;
  const maxH = h * 0.28;
  ctx.fillStyle = a ? c.ink : c.faint;
  for (let i = 0; i < bars; i++) {
    const v = src[Math.floor((i / bars) * src.length)] / (peak || 1);
    const bh = Math.max(2 * d, (0.15 + 0.85 * v) * maxH);
    ctx.fillRect(Math.round(x0 + i * step - d), Math.round(h / 2 - bh / 2), 2 * d, Math.round(bh));
  }
  ctx.restore();
}
