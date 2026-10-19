// Питомец вида «плитка» — живая клетка по референсу (видео 23 с, разобрано по кадрам
// через каждые 0,5 с). Клетка ведёт себя как диффузор динамика под музыку:
// - размер скачет втрое — от комочка до почти всего кадра — за секунду-две;
// - контур бугристый, бугры растут и переползают за полсекунды, бывают вмятины;
// - снаружи толстая насыщенная бирюзовая скорлупа с чётким внешним краем,
//   к противоположной стороне она тает; внутри — бело-персиковый зазор,
//   фиолетово-синее кольцо, чёрное пятно сверху-справа и большое кислотно-красное ядро;
// - ядро дёргается внутри само по себе, независимо от контура.
// У нас этим управляет голос: громкость — размер и бугры, тембр — куда смещается ядро
// и куда поворачивается скорлупа. В тишине клетка маленькая и медленно дышит.

type Pt = { x: number; y: number };

const TAU = Math.PI * 2;

// бугристый контур: гармоники 2–6, амплитуда растёт с голосом, фазы бегут со временем
function blobPath(ctx: CanvasRenderingContext2D, c: Pt, r: number, t: number, seed: number, bump: number) {
  const n = 90;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k =
      1 +
      bump *
        (0.5 * Math.sin(2 * a + seed + t * 0.9) +
          0.38 * Math.sin(3 * a + seed * 1.7 - t * 1.3) +
          0.26 * Math.sin(4 * a + seed * 2.9 + t * 1.7) +
          0.16 * Math.sin(6 * a + seed * 4.1 - t * 2.3));
    const x = c.x + Math.cos(a) * r * k;
    const y = c.y + Math.sin(a) * r * k;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function radial(ctx: CanvasRenderingContext2D, c: Pt, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(1, r));
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export type CellState = {
  t: number; // «внутреннее» время клетки — бежит быстрее, когда громко
  size: number; // 0.6 … 1.3 — общий масштаб
  bump: number; // бугристость контура
  tone: number; // 0 … 1 — тембр
  jx: number; // рывок ядра
  jy: number;
};

export const restState = (t: number): CellState => ({ t, size: 0.55, bump: 0.035, tone: 0.4, jx: 0, jy: 0 });

// один кадр; возвращает, где ядро (для глаз), сплющенность и масштаб
export function drawCellFrame(ctx: CanvasRenderingContext2D, w: number, h: number, s: CellState, fade = 1) {
  const c = { x: w / 2, y: h / 2 };
  const R = Math.min(w, h) * 0.27 * s.size;
  const t = s.t;
  // скорлупа поворачивается медленно и сдвигается тембром
  const dir = -0.9 + t * 0.12 + (s.tone - 0.4) * 1.6;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  // лёгкая перспектива: линза то шире, то уже
  const squash = 0.86 + 0.14 * Math.cos(t * 0.37);

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(c.x, c.y);
  ctx.rotate(dir + 0.8);
  ctx.scale(squash, 1);
  ctx.rotate(-dir - 0.8);
  ctx.translate(-c.x, -c.y);

  // 1. бирюзовая скорлупа: внешний край чёткий, внутрь — прозрачнее; со стороны,
  //    противоположной сдвигу, она стирается — получается толстый полумесяц
  const shell = { x: c.x + ux * R * 0.26, y: c.y + uy * R * 0.26 };
  ctx.filter = `blur(${R * 0.015}px)`;
  blobPath(ctx, shell, R * 1.18, t * 0.8, 0.4, s.bump * 0.7);
  ctx.fillStyle = radial(ctx, shell, R * 1.24, [
    [0, "rgba(34,222,240,0.15)"],
    [0.45, "rgba(34,222,240,0.6)"],
    [0.75, "rgba(36,226,242,0.95)"],
    [1, "rgba(44,230,246,1)"],
  ]);
  ctx.fill();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "destination-out";
  const er = ctx.createLinearGradient(c.x - ux * R * 1.1, c.y - uy * R * 1.1, c.x + ux * R * 0.35, c.y + uy * R * 0.35);
  er.addColorStop(0, "rgba(0,0,0,1)");
  er.addColorStop(0.55, "rgba(0,0,0,0.9)");
  er.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = er;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  // 2. персиковая дымка — с противоположной скорлупе стороны, широко и мягко;
  //    в середине — белёсый зазор между скорлупой и телом
  ctx.filter = `blur(${R * 0.18}px)`;
  const haze = { x: c.x - ux * R * 0.22, y: c.y - uy * R * 0.22 };
  ctx.fillStyle = radial(ctx, haze, R * 1.45, [
    [0, "rgba(255,238,232,0.95)"],
    [0.45, "rgba(255,170,140,0.8)"],
    [0.75, "rgba(255,186,160,0.45)"],
    [1, "rgba(255,200,186,0)"],
  ]);
  ctx.beginPath();
  ctx.arc(haze.x, haze.y, R * 1.45, 0, TAU);
  ctx.fill();

  // 3. тело: фиолетово-синее кольцо вокруг будущего ядра
  ctx.filter = `blur(${R * 0.07}px)`;
  const body = { x: c.x - ux * R * 0.04, y: c.y - uy * R * 0.04 };
  blobPath(ctx, body, R * 0.8, t, 2.1, s.bump);
  ctx.fillStyle = radial(ctx, body, R * 0.86, [
    [0, "rgba(70,40,220,1)"],
    [0.65, "rgba(110,60,236,0.95)"],
    [0.88, "rgba(160,96,244,0.8)"],
    [1, "rgba(255,176,170,0.4)"],
  ]);
  ctx.fill();
  ctx.save();
  blobPath(ctx, body, R * 0.8, t, 2.1, s.bump);
  ctx.clip();
  const blue = { x: c.x + ux * R * 0.35, y: c.y + uy * R * 0.35 };
  ctx.fillStyle = radial(ctx, blue, R * 0.6, [[0, "rgba(40,50,255,0.95)"], [1, "rgba(40,50,255,0)"]]);
  ctx.fillRect(0, 0, w, h);
  const violet = { x: c.x - uy * R * 0.4 - ux * R * 0.15, y: c.y + ux * R * 0.4 - uy * R * 0.15 };
  ctx.fillStyle = radial(ctx, violet, R * 0.55, [[0, "rgba(170,80,255,0.9)"], [1, "rgba(170,80,255,0)"]]);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 4. чёрное пятно и кислотно-красное ядро; ядро дёргается само по себе
  const core = {
    x: c.x - ux * R * 0.08 + (s.jx + 0.05 * Math.sin(t * 1.9)) * R,
    y: c.y - uy * R * 0.08 + (s.jy + 0.05 * Math.cos(t * 1.6)) * R,
  };
  const dark = { x: core.x + ux * R * 0.3 - uy * R * 0.1, y: core.y + uy * R * 0.3 + ux * R * 0.1 };
  ctx.filter = `blur(${R * 0.08}px)`;
  ctx.fillStyle = radial(ctx, dark, R * 0.36, [[0, "rgba(10,0,8,0.95)"], [0.55, "rgba(10,0,8,0.6)"], [1, "rgba(10,0,8,0)"]]);
  ctx.beginPath();
  ctx.arc(dark.x, dark.y, R * 0.36, 0, TAU);
  ctx.fill();
  ctx.filter = `blur(${R * 0.05}px)`;
  blobPath(ctx, core, R * 0.5, t * 1.4, 4.2, s.bump * 1.4);
  ctx.fillStyle = radial(ctx, core, R * 0.52, [
    [0, "rgba(255,52,30,1)"],
    [0.6, "rgba(255,30,16,1)"],
    [1, "rgba(240,20,20,0.75)"],
  ]);
  ctx.fill();

  // 5. две бледные контурные петли
  ctx.filter = "none";
  ctx.lineWidth = Math.max(1, R * 0.007);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  blobPath(ctx, { x: c.x + ux * R * 0.04, y: c.y + uy * R * 0.04 }, R * 0.66, t * 0.7, 5.5, s.bump * 0.9);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  blobPath(ctx, { x: c.x - uy * R * 0.05, y: c.y + ux * R * 0.05 }, R * 0.74, t * 0.6, 7.9, s.bump * 1.1);
  ctx.stroke();
  ctx.restore();

  // где оказалось ядро после перспективы — туда ставим глаза
  const a = dir + 0.8;
  const dx = core.x - c.x;
  const dy = core.y - c.y;
  const along = (dx * Math.cos(a) + dy * Math.sin(a)) * squash;
  const across = -dx * Math.sin(a) + dy * Math.cos(a);
  return { x: along * Math.cos(a) - across * Math.sin(a), y: along * Math.sin(a) + across * Math.cos(a), squash, scale: s.size };
}

// живая клетка внутри элемента .orb: свой холст; громкость и тембр берёт у сцены (--lv, --tone)
export class Cell {
  private cv = document.createElement("canvas");
  private ctx = this.cv.getContext("2d")!;
  private s = restState(Math.random() * 20);
  private last = performance.now();
  private peak = 0;
  private calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private orb: HTMLElement, private active: () => boolean) {
    this.cv.className = "cell";
    this.cv.setAttribute("aria-hidden", "true");
    orb.prepend(this.cv);
    requestAnimationFrame(this.frame);
  }

  private frame = () => {
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.active() || !this.orb.offsetParent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.cv.clientWidth * dpr);
    const h = Math.round(this.cv.clientHeight * dpr);
    if (!w || !h) return;
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }

    const stage = this.orb.closest<HTMLElement>(".stage");
    const raw = parseFloat(stage?.style.getPropertyValue("--lv") || "0") || 0;
    const tone = parseFloat(stage?.style.getPropertyValue("--tone") || "0.4") || 0.4;
    // громкость с усилением; пик быстро взлетает и медленно опадает — как стрелка VU-метра
    // контраст: тихие слоги почти не раздувают, ударные — сильно
    const L = Math.pow(Math.min(1, Math.max(0, (raw - 0.08) * 2.1)), 1.5);
    this.peak = Math.max(L, this.peak - dt * 0.9);
    const s = this.s;
    const k = (to: number, v: number, up: number, down: number) => v + (to - v) * Math.min(1, dt * (to > v ? up : down));

    if (this.calm) {
      s.size = 0.8;
      s.bump = 0.04;
    } else {
      // время клетки: в тишине — медленно, на голосе — быстро
      s.t += dt * (0.35 + L * 2.6);
      // размер: тишина — 0.66 с дыханием, громко — до 1.3
      const breath = 0.03 * Math.sin(now / 1400);
      s.size = k(0.5 + breath + L * 0.8 + this.peak * 0.14, s.size, 16, 6);
      s.bump = k(0.035 + L * 0.15 + this.peak * 0.04, s.bump, 12, 4);
      s.tone = k(tone, s.tone, 3, 3);
      // ядро дёргается на атаках: чем резче звук, тем дальше прыжок
      if (L > 0.25 && Math.random() < dt * 6 * L) {
        s.jx = (Math.random() - 0.5) * 0.22 * L;
        s.jy = (Math.random() - 0.5) * 0.22 * L;
      }
      s.jx = k(0, s.jx, 2.2, 2.2);
      s.jy = k(0, s.jy, 2.2, 2.2);
    }

    const eye = drawCellFrame(this.ctx, w, h, s);
    this.orb.style.setProperty("--px", `${(eye.x / dpr).toFixed(1)}px`);
    this.orb.style.setProperty("--py", `${(eye.y / dpr).toFixed(1)}px`);
    this.orb.style.setProperty("--sq", eye.squash.toFixed(3));
    this.orb.style.setProperty("--es", (0.75 + eye.scale * 0.35).toFixed(3));
  };
}
