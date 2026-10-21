// Вид интерфейса: «мягкий свет» (по умолчанию) или «боке» — голос как облако цветных
// точек во весь экран, управление — жидкое стекло поверх. Хранится на устройстве, ставится до первой отрисовки.

export type Look = "soft" | "bokeh";
export const LOOKS: Look[] = ["soft", "bokeh"];
const KEY = "sushhh.look";

function read(): Look {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "bokeh" || v === "soft") return v;
    if (v === "tile") return "bokeh"; // прежний вид «плитка» заменён на «боке»
  } catch {
    // без хранилища — по умолчанию
  }
  return "soft";
}

export let look: Look = read();
document.documentElement.dataset.look = look;

export function setLook(l: Look) {
  look = l;
  document.documentElement.dataset.look = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // не сохранится, но вид сменится сейчас
  }
}
