// Языки голосов. Интерфейс переведён на пять языков, а голоса в эфире звучат на любом — без фильтра
// они шли бы вперемешку. Голос помечается языком, на котором у автора интерфейс (тег «lang:ru» в
// записи: таблицу менять не нужно), а слушатель выбирает, какие языки слышать. Голоса без отметки
// (старые, из v1, демо) слышны всегда — иначе эфир опустел бы.

import { LANGS, lang, type Lang } from "../src/i18n";

const KEY = "sushhh.v2.langs";
const TAG = "lang:";

export const ALL_LANGS = LANGS;
export const langTag = (l: Lang = lang) => `${TAG}${l}`;
export const langOf = (tags: readonly string[] | null | undefined): Lang | undefined => {
  const t = tags?.find((x) => x.startsWith(TAG));
  const l = t?.slice(TAG.length) as Lang | undefined;
  return l && LANGS.some((x) => x.id === l) ? l : undefined;
};

// какие языки слушать: по умолчанию — язык интерфейса
export function chosen(): Lang[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(v)) {
      const ok = v.filter((x): x is Lang => LANGS.some((l) => l.id === x));
      if (ok.length) return ok;
    }
  } catch {
    // без хранилища — язык интерфейса
  }
  return [lang];
}

// включить или выключить язык; последний выключить нельзя — эфир не может быть без языка
export function toggle(l: Lang): Lang[] {
  const now = chosen();
  const next = now.includes(l) ? now.filter((x) => x !== l) : [...now, l];
  if (!next.length) return now;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // не запомнится
  }
  return next;
}

// голос слышен: язык не отмечен или выбран
export const audible = (l: Lang | undefined) => !l || chosen().includes(l);
