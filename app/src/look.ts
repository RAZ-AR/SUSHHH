// Режим экрана прибора: тёмный (строки развёртки, белые чернила) или светлый (бумага в клетку,
// оливковые чернила). Корпус и клавиши одинаковые в обоих режимах. Хранится на устройстве,
// ставится до первой отрисовки; переключается боковой кнопкой на корпусе.

export type Look = "dark" | "light";
export const LOOKS: Look[] = ["dark", "light"];
const KEY = "sushhh.look";

function read(): Look {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // без хранилища — по умолчанию
  }
  return "dark";
}

export let look: Look = read();
document.documentElement.dataset.look = look;

const listeners: (() => void)[] = [];
export function onLook(fn: () => void) {
  listeners.push(fn);
}

export function setLook(l: Look) {
  look = l;
  document.documentElement.dataset.look = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // не сохранится, но вид сменится сейчас
  }
  for (const fn of listeners) fn();
}

export const flipLook = () => setLook(look === "dark" ? "light" : "dark");

// цвета экрана — общие для всех холстов
export type Ink = { scr: string; scan: string | null; grid: string | null; ink: string; dim: string; faint: string };
export const INK: Record<Look, Ink> = {
  dark: { scr: "#0D0D0D", scan: "#161616", grid: null, ink: "#EDEDED", dim: "#8C8C8C", faint: "#3A3A3A" },
  light: { scr: "#E4E5D8", scan: null, grid: "#D3D5C3", ink: "#545930", dim: "#5F6438", faint: "#AEB197" },
};
export const ORANGE = "#F2611D";
export const ink = () => INK[look];

// фон экрана: строки развёртки в тёмном, клетка в светлом. step — шаг в пикселях холста
export function paintScreen(ctx: CanvasRenderingContext2D, w: number, h: number, d: number) {
  const c = ink();
  ctx.fillStyle = c.scr;
  ctx.fillRect(0, 0, w, h);
  if (c.scan) {
    ctx.fillStyle = c.scan;
    for (let y = 0; y < h; y += 3 * d) ctx.fillRect(0, y, w, d);
  }
  if (c.grid) {
    ctx.fillStyle = c.grid;
    const s = 14 * d;
    for (let x = 0; x < w; x += s) ctx.fillRect(x, 0, d, h);
    for (let y = 0; y < h; y += s) ctx.fillRect(0, y, w, d);
  }
}
