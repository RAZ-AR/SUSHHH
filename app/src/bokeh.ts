// Вид «боке»: голос — облако цветных точек, которое летит на тебя (по референсу
// Cecilia Erlich: бледно-лавандовый фон, сотни насыщенных точек разного размера,
// почти все — не в фокусе). Каждый слог выпускает из центра горсть точек; они летят
// к зрителю, растут, проходят плоскость фокуса (становятся резкими) и снова
// размываются. Главное — цветные сферы: в тишине они невесомо висят и дрейфуют
// в пространстве, как туманности; на голосе каждая превращается в чашку с волнами
// Фарадея (faraday.ts), голос стих — решётка тает обратно в мягкую сферу.
// Точки — лёгкая пыль вокруг, тонкий поток медленно закручивается вихрем.
// Звук: пятна раздуваются и ускоряются, точки летят быстрее и гуще, вихрь крутится
// сильнее, а на начале каждого слога — толчок: точки на миг вырастают и выбрасывается
// свежая горсть. При записи наоборот: твой голос улетает вдаль.
// Часть точек — в цвете ауры автора, так у каждого голоса свой оттенок облака.

import { hsl, type Aura } from "./aura";
import { MAX_SPOTS, rgb, Surface, type Spot } from "./faraday";

type P = { x: number; y: number; z: number; vz: number; vx: number; vy: number; s: number; c: number };
// сфера в пространстве: где висит, куда дрейфует, размер, цвет и насколько она уже «чашка»
type Orb = { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; c: number; morph: number; seed: number };

// насыщенная палитра референса
const BASE = ["#ff1f4b", "#2f5bff", "#00c86a", "#ffd21f", "#00bfe0", "#d21cf2", "#ff7a1a", "#8a2bff", "#ff4fa3", "#6ad11b", "#18d9b0", "#3040ff"];
const LEVELS = 7; // ступени размытия
const SPR = 96; // размер спрайта

// спрайт точки: b = 0 — резкий кружок, b = 1 — мягкое пятно
function sprite(color: string, b: number) {
  const c = document.createElement("canvas");
  c.width = c.height = SPR;
  const x = c.getContext("2d")!;
  const r = SPR / 2;
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  const solid = Math.max(0, 0.62 - b * 0.62);
  const peak = 0.95 - b * 0.4;
  g.addColorStop(0, withAlpha(color, peak));
  g.addColorStop(solid, withAlpha(color, peak));
  g.addColorStop(Math.min(0.99, solid + 0.06 + b * 0.5), withAlpha(color, peak * 0.45));
  g.addColorStop(1, withAlpha(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, SPR, SPR);
  return c;
}

function withAlpha(color: string, a: number) {
  if (color.startsWith("#")) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }
  return color.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `hsla($1,$2,$3,${a.toFixed(3)})`);
}

// размер точки: много мелких, немного крупных
const size = () => 0.006 + Math.pow(Math.random(), 2.4) * 0.032;

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export type FieldSource = () => { level: number; tone?: number; out: boolean; idle: boolean };

// симметрия волн Фарадея по автору: квадраты, шестиугольники, 8- и 12-лучевые квазикристаллы
const SYMS = [3, 4, 2, 6, 3, 4, 6, 2, 4, 3, 6, 4, 3, 2, 6];

export class Field {
  private cv = document.createElement("canvas");
  private ctx = this.cv.getContext("2d")!;
  private ps: P[] = [];
  private sprites: HTMLCanvasElement[][] = [];
  private colors: string[] = [...BASE];
  private last = performance.now();
  private debt = 0;
  private L = 0;
  private prev = 0; // прошлая громкость — чтобы ловить начало слога
  private pulse = 0; // толчок на атаке, быстро гаснет
  private phase = Math.random() * 100; // время пятен фона
  private spin = 0.04; // скорость вихря
  private spotColors: string[] = [];
  private spotRgb: [number, number, number][] = [];
  private surface = new Surface();
  private sym = 3;
  private orbs: Orb[] = Array.from({ length: MAX_SPOTS }, (_, i) => ({
    // по сетке 3×3 с разбросом — чтобы сферы заполняли всё пространство
    x: ((i % 3) - 1) * 0.75 + (Math.random() - 0.5) * 0.4,
    y: (Math.floor(i / 3) - 1) * 1.05 + (Math.random() - 0.5) * 0.4,
    z: 1 + Math.random() * 1.4,
    vx: (Math.random() - 0.5) * 0.05,
    vy: (Math.random() - 0.5) * 0.05,
    vz: (Math.random() - 0.5) * 0.04,
    r: 0.16 + Math.random() * 0.2,
    c: i,
    morph: 0,
    seed: Math.random() * 10,
  }));
  private k = 16; // частота решётки (в радиусах сферы)
  private osc = 0; // фаза колебания поверхности
  private rot = Math.random() * 3;
  private calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  source: FieldSource = () => ({ level: 0, out: false, idle: true });

  constructor(private active: () => boolean) {
    this.cv.className = "field";
    this.cv.setAttribute("aria-hidden", "true");
    document.body.prepend(this.cv);
    // поверхность с волнами Фарадея — под точками
    if (this.surface.ok) {
      this.surface.canvas.className = "field field-bg";
      this.surface.canvas.setAttribute("aria-hidden", "true");
      document.body.prepend(this.surface.canvas);
    }
    this.setAura([250, 290, 210]);
    requestAnimationFrame(this.frame);
  }

  // цвета автора: три оттенка ауры, насыщенные, рядом с базовой палитрой
  setAura(a: Aura) {
    // большие пятна фона: пастельные, но насыщенные; одно — в цвете автора
    this.spotColors = ["#ff7aa8", "#6f9bff", "#4fdcb4", "#ffbe5c", "#b38aff", "#ff9a6b", "#7fd1ff", hsl(a[0], 1, 62), hsl(a[1], 1, 66)];
    this.spotRgb = this.spotColors.map(rgb);
    this.sym = SYMS[Math.round(a[0] / 24) % SYMS.length];
    this.colors = [...BASE, ...a.map((h) => hsl(h, 1, 52)), hsl(a[0], 1, 58)];
    this.sprites = this.colors.map((c) => Array.from({ length: LEVELS }, (_, i) => sprite(c, i / (LEVELS - 1))));
  }

  // всплеск — на реакцию: горсть точек сразу
  burst(n = 40) {
    for (let i = 0; i < n; i++) this.spawn(false, 0.9);
  }

  private spawn(out: boolean, energy: number) {
    const own = Math.random() < 0.15; // доля точек в цвете автора — оттенок, а не заливка
    const c = own ? BASE.length + Math.floor(Math.random() * (this.colors.length - BASE.length)) : Math.floor(Math.random() * BASE.length);
    const speed = (0.22 + energy * 0.3) * (0.7 + Math.random() * 0.6);
    if (out) {
      this.ps.push({ x: gauss() * 0.05, y: gauss() * 0.05, z: 0.12 + Math.random() * 0.1, vz: speed, vx: gauss() * 0.02, vy: gauss() * 0.02, s: size(), c });
    } else {
      this.ps.push({ x: gauss() * 0.62, y: gauss() * 0.8, z: 1 + Math.random() * 0.35, vz: -speed, vx: gauss() * 0.04, vy: gauss() * 0.04, s: size(), c });
    }
  }

  private frame = () => {
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.active()) {
      if (this.cv.width) this.cv.width = 0;
      if (this.surface.canvas.width) this.surface.canvas.width = 0;
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(innerWidth * dpr);
    const H = Math.round(innerHeight * dpr);
    if (this.cv.width !== W || this.cv.height !== H) {
      this.cv.width = W;
      this.cv.height = H;
    }
    const src = this.source();
    const target = this.calm ? 0 : Math.pow(Math.min(1, Math.max(0, (src.level - 0.06) * 1.8)), 1.15);
    this.L += (target - this.L) * Math.min(1, dt * (target > this.L ? 18 : 5));
    const L = this.L;
    // атака слога: резкий рост громкости — толчок
    const onset = Math.max(0, target - this.prev);
    this.prev = target;
    this.pulse = Math.max(this.pulse * Math.exp(-dt * 4.5), Math.min(1, onset * 7));
    if (onset > 0.12 && !this.calm) for (let i = 0; i < 10 + onset * 60; i++) this.spawn(src.out, L);

    // темп всего поля: тишина — плывёт, голос — летит
    const tempo = this.calm ? 0 : src.idle ? 0.3 : 0.55 + L * 1.7 + this.pulse * 0.6;
    this.phase += dt * (this.calm ? 0 : 0.1 + L * 0.8 + this.pulse * 0.6);
    this.spin += ((src.idle ? 0.03 : 0.06 + L * 0.45) - this.spin) * Math.min(1, dt * 2);

    // выпуск: всегда есть тонкий поток, голос — сотни точек в секунду
    const rate = this.calm ? 0 : (src.idle ? 8 : 12) + L * 240;
    const cap = src.idle ? 100 : 240; // точки — лёгкая пыль вокруг сфер, а не главное
    this.debt += rate * dt;
    while (this.debt >= 1 && this.ps.length < cap) {
      this.spawn(src.out, L);
      this.debt -= 1;
    }
    if (this.ps.length >= cap) this.debt = 0;

    const ctx = this.ctx;
    const m = Math.min(W, H);
    // 1. сферы: в тишине невесомо дрейфуют в пространстве (параллакс, медленный поворот),
    //    на голосе замирают и превращаются в чашки с волнами Фарадея; тяжёлые — медленнее
    const drive = this.calm ? 0 : Math.min(1, Math.max(0, (L - 0.1) / 0.4)) * (0.85 + this.pulse * 0.3);
    const tone = src.tone ?? 0.4;
    this.k += (Math.PI * 2 * (2 + tone * 2.8) - this.k) * Math.min(1, dt * 1.2);
    if (!this.calm) {
      this.osc += dt * Math.PI * 2 * (1.1 + L * 1.8);
      this.rot += dt * (0.02 + L * 0.06);
    }
    const drift = this.calm ? 0 : 1 - drive * 0.7;
    const turn = dt * 0.03 * drift;
    for (const o of this.orbs) {
      o.x += o.vx * dt * drift;
      o.y += o.vy * dt * drift + Math.sin(this.phase * 0.7 + o.seed) * 0.004 * dt * drift;
      o.z += o.vz * dt * drift;
      // медленный поворот всей сцены вокруг вертикальной оси — глубина видна по параллаксу
      const cx = o.x;
      const cz = o.z - 1.7;
      o.x = cx * Math.cos(turn) - cz * Math.sin(turn);
      o.z = 1.7 + cx * Math.sin(turn) + cz * Math.cos(turn);
      // мягкие стенки пространства: сферы плавно разворачиваются, а не исчезают
      if (Math.abs(o.x) > 1.1) o.vx -= Math.sign(o.x) * 0.03 * dt;
      if (Math.abs(o.y) > 1.5) o.vy -= Math.sign(o.y) * 0.03 * dt;
      if (o.z < 0.9 || o.z > 2.5) o.vz -= Math.sign(o.z - 1.7) * 0.03 * dt;
      // превращение: быстрее у маленьких, медленнее у больших
      const mass = 0.6 + o.r * 2.5;
      o.morph += (drive - o.morph) * Math.min(1, (dt * (drive > o.morph ? 3.2 : 1.3)) / mass);
    }
    const cw = innerWidth;
    const ch = innerHeight;
    const cm = Math.min(cw, ch);
    const spots: Spot[] = [...this.orbs]
      .sort((a, b) => b.z - a.z)
      .map((o) => ({
        x: 0.5 + ((o.x / o.z) * 0.62 * cm) / cw,
        y: 0.5 + ((o.y / o.z) * 0.62 * cm) / ch,
        r: (o.r / o.z) * (1 + this.pulse * 0.06 * o.morph),
        morph: o.morph,
        rgb: this.spotRgb[o.c],
        alpha: Math.min(0.92, 0.5 + 0.55 / o.z),
      }));
    if (this.surface.ok) {
      this.surface.draw(Math.round(cw), Math.round(ch), spots, { k: this.k, sym: this.sym, osc: this.osc, rot: this.rot });
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#eef0fa";
      ctx.fillRect(0, 0, W, H);
      for (const sp of spots) {
        const x = sp.x * W;
        const y = sp.y * H;
        const r = sp.r * m * 1.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${sp.rgb.map((v) => Math.round(v * 255)).join(",")},${sp.alpha})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // 2. точки: летят по глубине, закручиваются вихрем вокруг центра
    const f = 0.5 * m;
    const rot = this.spin * dt * (src.out ? -1 : 1);
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const alive: P[] = [];
    for (const p of this.ps) {
      p.z += p.vz * dt * tempo;
      const x = p.x + p.vx * dt * tempo;
      const y = p.y + p.vy * dt * tempo;
      p.x = x * cs - y * sn;
      p.y = x * sn + y * cs;
      const sx = W / 2 + (p.x / p.z) * f;
      const sy = H / 2 + (p.y / p.z) * f;
      const r = (p.s / p.z) * f;
      if (p.z < 0.06 || p.z > 1.5 || sx < -r * 2 || sx > W + r * 2 || sy < -r * 2 || sy > H + r * 2) continue;
      alive.push(p);
    }
    this.ps = alive;
    alive.sort((a, b) => b.z - a.z);
    const pop = 1 + this.pulse * 0.3;
    for (const p of alive) {
      const sx = W / 2 + (p.x / p.z) * f;
      const sy = H / 2 + (p.y / p.z) * f;
      // глубина резкости: фокус на z = 0.35, дальше и ближе — мягче
      const b = Math.min(1, Math.abs(Math.log(p.z / 0.35)) * 0.8);
      const r = (p.s / p.z) * f * (1 + b * 0.55) * pop;
      // появление издалека и исчезновение у самого носа / на краю пути
      const fade = p.vz < 0 ? Math.min(1, (1.35 - p.z) / 0.35) * Math.min(1, (p.z - 0.06) / 0.08) : Math.min(1, (1.5 - p.z) / 0.4);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.drawImage(this.sprites[p.c][Math.round(b * (LEVELS - 1))], sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  };
}

// мини-облако для превью в «Моё» и кабинете: горсть точек в цвете автора и палитре.
// Просмотренное — бледнее. Раскладка зависит от оттенка — у каждого автора своя
export function drawBokehThumb(ctx: CanvasRenderingContext2D, w: number, h: number, hue: number, fresh: boolean) {
  let seed = Math.round(hue) * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const m = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = fresh ? 1 : 0.4;
  for (let i = 0; i < 22; i++) {
    const own = rnd() < 0.45;
    const color = own ? hsl(hue + (rnd() - 0.5) * 40, 1, 52) : BASE[Math.floor(rnd() * BASE.length)];
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.7) * m * 0.36;
    const x = w / 2 + Math.cos(a) * d;
    const y = h / 2 + Math.sin(a) * d;
    const b = rnd();
    const r = m * (0.03 + rnd() * 0.07) * (1 + b * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const peak = 0.95 - b * 0.4;
    g.addColorStop(0, withAlpha(color, peak));
    g.addColorStop(Math.max(0, 0.62 - b * 0.62), withAlpha(color, peak));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
