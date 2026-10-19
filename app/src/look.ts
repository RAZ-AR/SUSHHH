// Вид интерфейса: «мягкий свет» (по умолчанию) или «плитка» — питомец в стеклянной
// плитке на перфорированной бумаге. Хранится на устройстве, ставится до первой отрисовки.

export type Look = "soft" | "tile";
export const LOOKS: Look[] = ["soft", "tile"];
const KEY = "sushhh.look";

function read(): Look {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "tile" || v === "soft") return v;
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
