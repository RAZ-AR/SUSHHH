import { describe, expect, it } from "vitest";
import type { RemotePost } from "./backend";
import { bandPosts, findPost, hookFrom, mergeRemote, mostDiscussed, reactionCount, repliesToMe, signalOf, type Post } from "./feed";

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

describe("mergeRemote", () => {
  const remote = (id: string, o: Partial<RemotePost> = {}): RemotePost => ({
    id, author_id: "u2", author_name: "b", reply_to: null, at: null, text: null, tags: [], audio_path: "", env: null, palette: 0,
    created_at: "2026-11-01T00:00:00Z", ...o,
  });
  const toPost = (r: RemotePost) => post(r.id, { author: r.author_name });

  it("чужие голоса встают в ленту и в ветки, свои не дублируются", () => {
    const feed = [post("mine", { mine: true }), post("demo", { synthetic: true })];
    mergeRemote(feed, { posts: [remote("reply", { reply_to: "mine" }), remote("new"), remote("mine")], reactions: [] }, "me", toPost);
    expect(feed.map((p) => p.id)).toEqual(["new", "mine", "demo"]);
    expect(feed[1].replies.map((p) => p.id)).toEqual(["reply"]);
  });
  it("чужие реакции считаются, свои — нет", () => {
    const feed = [post("p")];
    const rx = (user_id: string) => ({ post_id: "p", user_id, emoji: "❤️", at: 0.5 });
    mergeRemote(feed, { posts: [], reactions: [rx("u2"), rx("me"), rx("u3")] }, "me", toPost);
    expect(feed[0].reactions["❤️"]).toBe(2);
    expect(feed[0].moments).toHaveLength(2);
  });
  it("пять живых голосов убирают демо-записи", () => {
    const feed = [post("demo", { synthetic: true })];
    mergeRemote(feed, { posts: ["a", "b", "c", "d", "e"].map((id) => remote(id)), reactions: [] }, "me", toPost);
    expect(feed.some((p) => p.synthetic)).toBe(false);
    expect(feed).toHaveLength(5);
  });
});

describe("диапазоны", () => {
  const H = 3600_000;
  const at = 100 * H;
  const fresh = post("fresh", { tags: ["слух"], createdAt: at - 2 * H, reactions: { "✓": 1, "✗": 3 } });
  const trusted = post("trusted", { tags: ["слух"], createdAt: at - 20 * H, reactions: { "✓": 9 } });
  const stale = post("stale", { tags: ["слух"], createdAt: at - 25 * H });
  const friend = post("friend", { author: "арам", createdAt: 5 });
  const other = post("other", { author: "кто-то", createdAt: 9, replies: [post("friendReply", { author: "арам", createdAt: 7 })] });
  const feed = [fresh, trusted, stale, friend, other];

  it("слухи — только свежие, сначала те, которым верят", () =>
    expect(bandPosts(feed, "rumor", [], at).map((p) => p.id)).toEqual(["trusted", "fresh"]));
  it("город — без слухов", () =>
    expect(bandPosts(feed, "city", [], at).map((p) => p.id).sort()).toEqual(["friend", "other"]));
  it("свои — записи и ответы сохранённых голосов, новые первыми", () =>
    expect(bandPosts(feed, "own", ["арам"], at).map((p) => p.id)).toEqual(["friendReply", "friend"]));
  it("сигнал растёт с ответами и реакциями", () => {
    expect(signalOf(post("quiet"))).toEqual({ bars: 1, radius: 0 });
    expect(signalOf(post("loud", { reactions: { "❤️": 10 }, replies: [post("a"), post("b")] }))).toEqual({ bars: 4, radius: 2 });
  });
});
