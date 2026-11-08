import { describe, expect, it } from "vitest";
import { findPost, hookFrom, mostDiscussed, reactionCount, repliesToMe, type Post } from "./feed";

const post = (id: string, o: Partial<Post> = {}): Post => ({
  id, author: "a", createdAt: 0, hook: "", tags: [], src: "", palette: 0, reactions: {}, moments: [], replies: [], ...o,
});

describe("hookFrom", () => {
  it("берёт первое предложение без точки", () => expect(hookFrom("Привет, мир. Второе.", "x")).toBe("Привет, мир"));
  it("обрезает длинное по слову и ставит многоточие", () => {
    const h = hookFrom("слово ".repeat(20), "x");
    expect(h.endsWith("…")).toBe(true);
    expect(h.length).toBeLessThanOrEqual(53);
    expect(h).not.toMatch(/\s…$/);
  });
  it("без текста — запасной вариант", () => {
    expect(hookFrom(undefined, "x")).toBe("x");
    expect(hookFrom("   ", "x")).toBe("x");
  });
});

describe("лента", () => {
  const mine = post("m", { mine: true, createdAt: 10 });
  const before = post("r0", { createdAt: 5 });
  const after = post("r1", { createdAt: 20, reactions: { "❤️": 2, "😂": 1 } });
  mine.replies.push(before, after);
  const other = post("o", { replies: [post("o1")] });
  const feed = [mine, other];

  it("reactionCount суммирует все реакции", () => expect(reactionCount(after)).toBe(3));
  it("repliesToMe — только чужие ответы после моей записи", () =>
    expect(repliesToMe(feed).map((x) => x.reply.id)).toEqual(["r1"]));
  it("findPost находит ответ и его корень", () => {
    const f = findPost(feed, "o1");
    expect(f?.root.id).toBe("o");
    expect(f?.post.id).toBe("o1");
    expect(findPost(feed, "nope")).toBeNull();
  });
  it("mostDiscussed — только с ответами, по убыванию", () =>
    expect(mostDiscussed(feed).map((p) => p.id)).toEqual(["m", "o"]));
});
