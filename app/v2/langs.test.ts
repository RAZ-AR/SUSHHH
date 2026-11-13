import { beforeEach, describe, expect, it } from "vitest";
import { audible, chosen, langOf, langTag, toggle } from "./langs";
import { lang } from "../src/i18n";

describe("языки голосов", () => {
  beforeEach(() => localStorage.clear());

  it("язык читается из тегов записи; чужие и пустые теги — без языка", () => {
    expect(langOf(["моё", "lang:de"])).toBe("de");
    expect(langOf(["lang:xx"])).toBeUndefined();
    expect(langOf([])).toBeUndefined();
    expect(langOf(null)).toBeUndefined();
    expect(langTag("fr")).toBe("lang:fr");
  });

  it("по умолчанию слышен язык интерфейса и голоса без отметки", () => {
    expect(chosen()).toEqual([lang]);
    expect(audible(lang)).toBe(true);
    expect(audible(undefined)).toBe(true);
    const other = lang === "en" ? "de" : "en";
    expect(audible(other)).toBe(false);
  });

  it("языки включаются и выключаются, но последний выключить нельзя", () => {
    const other = lang === "en" ? "de" : "en";
    expect(toggle(other)).toEqual([lang, other]);
    expect(audible(other)).toBe(true);
    expect(toggle(lang)).toEqual([other]);
    expect(toggle(other)).toEqual([other]); // последний остаётся
  });
});
