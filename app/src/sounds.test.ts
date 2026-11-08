import { describe, expect, it } from "vitest";
import { wordsAt } from "./sounds";

describe("wordsAt", () => {
  const text = "Раз, два. Три четыре — пять шесть!";
  it("берёт n слов вокруг доли записи, без знаков, в нижнем регистре", () => {
    expect(wordsAt(text, 0, 2)).toBe("раз два");
    expect(wordsAt(text, 1, 2)).toBe("пять шесть");
    expect(wordsAt(text, 0.5, 2)).toBe("три четыре");
  });
  it("короткий текст — сколько есть", () => expect(wordsAt("Привет", 0.5)).toBe("привет"));
  it("без текста — пусто", () => expect(wordsAt(undefined, 0.5)).toBe(""));
});
