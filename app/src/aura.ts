// Аура голоса: у каждого человека свой пастельный цвет — его узнаёшь раньше,
// чем прочтёшь имя, как узнаёшь голос. Три оттенка: основной и два соседних.

export type Aura = [number, number, number];

// FNV-1a + перемешивание битов, чтобы похожие имена не давали похожий цвет;
// 15 оттенков с шагом 24° — достаточно далеко друг от друга, чтобы различать на глаз
function mix(name: string) {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}
const hashHue = (name: string) => (Math.round(((mix(name) % 1000) / 1000) * 15) % 15) * 24;

// личный знак на экране прибора: цвет лампочки и место крестика в сетке плюсов (8 мест)
export const voiceColor = (name: string) => `hsl(${hashHue(name)}, 86%, 64%)`;
export const voiceCross = (name: string) => (mix(name) >>> 11) % 8;

export function aura(name: string): Aura {
  const h = hashHue(name);
  return [h, (h + 40) % 360, (h + 320) % 360];
}

export const hsl = (hue: number, alpha = 1, light = 78) => `hsla(${hue}, 82%, ${light}%, ${alpha})`;

// задать ауру элементу: CSS-переменные --a1..--a3 (переход между аурами плавный, см. @property)
export function paintAura(el: HTMLElement, a: Aura) {
  el.style.setProperty("--a1", hsl(a[0]));
  el.style.setProperty("--a2", hsl(a[1], 1, 80));
  el.style.setProperty("--a3", hsl(a[2], 1, 82));
  el.style.setProperty("--h", String(a[0])); // сам оттенок — для насыщенного тела персонажа
}

export const auraGradient = (a: Aura) => `linear-gradient(135deg, ${hsl(a[0], 1, 72)}, ${hsl(a[1], 1, 76)}, ${hsl(a[2], 1, 78)})`;
