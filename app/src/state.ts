// Общее состояние ленты: записи, разбор звука, что видно и что ново.

import { analyze } from "./audio";
import { type Post, unheardToMe, visible } from "./feed";
import { Field } from "./bokeh";
import { N } from "./visual";

// вид «боке»: облако точек во весь экран, позади всего интерфейса
export const field = new Field(() => false);

export const POST_MS = 30_000;
export const REPLY_MS = 15_000;
export const RATES = [1, 1.25, 1.5];

export let feed: Post[] = [];
export function setFeed(f: Post[]) {
  feed = f;
}

// разбор записи (огибающая, громкость, края тишины) — один раз, кэшируется в самом посте
const pending = new Map<Post, Promise<void>>();
export function ensureEnv(p: Post): Promise<void> {
  if (p.env && p.loud) return Promise.resolve();
  let job = pending.get(p);
  if (!job) {
    job = analyze(p.src, N)
      .then((a) => {
        p.env ??= a.env;
        p.loud = { gain: a.gain, start: a.start, end: a.end };
      })
      .catch(() => {});
    pending.set(p, job);
  }
  return job;
}

export const shown = (list: Post[]) => list.filter(visible);
export const freshToMe = () => unheardToMe(feed).filter((x) => visible(x.reply) && visible(x.root));

// id моих записей и ответов — по ним ищем запросы на звуки
export function myIds() {
  const ids = new Set<string>();
  for (const p of feed) {
    if (p.mine) ids.add(p.id);
    for (const r of p.replies) if (r.mine) ids.add(r.id);
  }
  return ids;
}
