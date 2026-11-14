import { describe, expect, it } from "vitest";
import { TITLE_MAX, cleanTitle } from "./title";

describe("название голоса", () => {
  it("лишние пробелы и переносы схлопываются", () => {
    expect(cleanTitle("  про   утро\n\nи кофе  ")).toBe("про утро и кофе");
    expect(cleanTitle("   ")).toBe("");
  });

  it("убирает управляющие символы и смену направления текста", () => {
    expect(cleanTitle("abc‮gpj.exe")).toBe("abc gpj.exe");
    expect(cleanTitle("a​b\u0007c")).toBe("a b c");
  });

  it("обрезает по длине, не разрывая эмодзи", () => {
    expect([...cleanTitle("я".repeat(100))].length).toBe(TITLE_MAX);
    const t = cleanTitle("🙂".repeat(TITLE_MAX + 5));
    expect([...t].length).toBe(TITLE_MAX);
    expect(t.endsWith("🙂")).toBe(true);
  });
});
