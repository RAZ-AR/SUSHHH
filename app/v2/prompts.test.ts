import { describe, expect, it } from "vitest";
import { hasSpeech, nextPrompt } from "./prompts";

const RATE = 16000;
// «речь»: тон с паузами — громко 300 мс, тихо 200 мс
function speechLike(sec: number, noise = 0.002) {
  const ch = new Float32Array(sec * RATE);
  for (let i = 0; i < ch.length; i++) {
    const on = (i / RATE) % 0.5 < 0.3;
    ch[i] = (on ? 0.3 * Math.sin((i / RATE) * 2 * Math.PI * 180) : 0) + (Math.random() * 2 - 1) * noise;
  }
  return ch;
}

describe("hasSpeech", () => {
  it("находит голос с паузами", () => expect(hasSpeech(speechLike(3), RATE)).toBe(true));
  it("тишина — не речь", () => expect(hasSpeech(new Float32Array(3 * RATE), RATE)).toBe(false));
  it("ровный шум — не речь", () => {
    const ch = new Float32Array(3 * RATE).map(() => (Math.random() * 2 - 1) * 0.1);
    expect(hasSpeech(ch, RATE)).toBe(false);
  });
  it("слишком коротко — не речь", () => expect(hasSpeech(speechLike(0.3), RATE)).toBe(false));
});

describe("nextPrompt", () => {
  it("не повторяет подсказку подряд", () => {
    let prev = nextPrompt("post");
    for (let i = 0; i < 30; i++) {
      const p = nextPrompt("post");
      expect(p).not.toBe(prev);
      prev = p;
    }
  });
});
