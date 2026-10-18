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

// мини-превью записи: белый диск, а за ним цветные пятна там, где в записи громче —
// у каждой записи свой «цветовой отпечаток». color = false — приглушённо (просмотрено)
const UNI = ["#8fe6f2", "#b9a7f7", "#f5a8dc", "#a8efc8", "#f2e7a1"];

export function drawRing(canvas: HTMLCanvasElement, env: ArrayLike<number> | undefined, color = false) {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;

  // энергия по пяти секторам записи
  const n = UNI.length;
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
    const alpha = color ? 0.35 + energy[k] * 0.6 : 0.18;
    g.addColorStop(0, hexA(color ? UNI[k] : "#a3b1c6", alpha));
    g.addColorStop(1, hexA(color ? UNI[k] : "#a3b1c6", 0));
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

function hexA(hex: string, a: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
