import { describe, expect, it } from "vitest";
import { analyzeSamples } from "./audio";

const RATE = 8000;
// тишина 0,5 с → синус 1 с → тишина 1 с
function take(amp: number, lead = 0.5, tail = 1) {
  const ch = new Float32Array(Math.round((lead + 1 + tail) * RATE));
  for (let i = 0; i < RATE; i++) ch[Math.round(lead * RATE) + i] = amp * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return ch;
}

describe("analyzeSamples", () => {
  it("тихий голос усиливается до общего уровня", () => {
    const a = analyzeSamples(take(0.05), RATE, 16);
    expect(a.gain).toBeCloseTo(0.1 / (0.05 / Math.SQRT2), 1);
  });
  it("громкий голос приглушается, но не сильнее предела", () => {
    expect(analyzeSamples(take(0.4), RATE, 16).gain).toBeCloseTo(0.1 / (0.4 / Math.SQRT2), 1);
    expect(analyzeSamples(take(0.99), RATE, 16).gain).toBe(0.3);
    expect(analyzeSamples(take(0.01), RATE, 16).gain).toBe(4);
  });
  it("находит края речи с небольшим запасом", () => {
    const a = analyzeSamples(take(0.3), RATE, 16);
    expect(a.start).toBeCloseTo(0.35, 1);
    expect(a.end).toBeCloseTo(1.75, 1);
  });
  it("короткие паузы по краям не обрезает", () => {
    const a = analyzeSamples(take(0.3, 0.2, 0.2), RATE, 16);
    expect(a.start).toBe(0);
    expect(a.end).toBe(0);
  });
  it("тишина — без усиления, огибающая нулевая", () => {
    const a = analyzeSamples(new Float32Array(RATE), RATE, 8);
    expect(a.gain).toBe(1);
    expect([...a.env].every((x) => x === 0)).toBe(true);
  });
});
