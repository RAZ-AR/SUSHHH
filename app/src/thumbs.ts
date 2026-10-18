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

// мини «кольцо расхождения»: тонкий круг, распушённый там, где в записи голос
export function drawRing(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, dark = false) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h, dpr } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.3;
  const col = dark ? "31,31,31" : "170,170,165";
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
