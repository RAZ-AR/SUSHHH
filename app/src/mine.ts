// «Моё»: ответы мне, позже, мои записи, звуки.

import { findPost, isHeard, laterIds, me, myPosts, myThreads, type Post, repliesToMe, visible } from "./feed";
import { aura } from "./aura";
import { t, tn } from "./i18n";
import { icon } from "./icons";
import { allowsWithoutAsking, type CommunitySound, mySounds, playClip, requestsForMe, setAllowWithoutAsking, setStatus } from "./sounds";
import { drawRing } from "./thumbs";
import { $, escapeHtml, toast } from "./ui";
import { ensureEnv, feed, freshToMe, myIds, shown } from "./state";
import { updateBadge } from "./nav";
import { openQueue, openThreadAt, player } from "./air";
import { renderFan } from "./fan";

// =================== моё: всё для слушания ===================

type MineTab = "toMe" | "later" | "posts" | "sounds";
let mineTab: MineTab = "toMe";
export function setMineTab(tab: MineTab) {
  mineTab = tab;
}

document.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
  b.onclick = () => {
    mineTab = b.dataset.tab as MineTab;
    renderMine();
  };
});

function tile(p: Post, name: string, isNew: boolean, onOpen: () => void) {
  const el = document.createElement("button");
  el.className = "tile" + (isNew ? " new" : "");
  el.setAttribute("aria-label", `${name}: ${p.hook}${isNew ? t("newAria") : ""}`);
  el.innerHTML = `<canvas></canvas><span>${escapeHtml(name)}</span>`;
  el.onclick = onOpen;
  const cv = el.querySelector("canvas")!;
  queueMicrotask(() => drawRing(cv, p.env, aura(p.author)));
  void ensureEnv(p).then(() => drawRing(cv, p.env, aura(p.author)));
  return el;
}

function emptyState(ic: string, text: string) {
  const e = document.createElement("p");
  e.className = "empty";
  e.innerHTML = `${icon(ic)}${escapeHtml(text)}`;
  return e;
}

export function renderMine() {
  $("meHeadName").textContent = me();
  const thumb = $<HTMLCanvasElement>("meThumb");
  queueMicrotask(() => drawRing(thumb, undefined, aura(me())));
  const fresh = freshToMe();
  $("playNewText").textContent = fresh.length ? tn("newReplies", fresh.length) : t("noNew");
  $("playNew").classList.toggle("quiet", !fresh.length);
  $("playNew").classList.toggle("dark", !!fresh.length);

  document.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === mineTab;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
  });

  const g = $("grid");
  g.innerHTML = "";
  let tiles: HTMLElement[] = [];

  if (mineTab === "toMe") {
    tiles = repliesToMe(feed)
      .filter((x) => visible(x.reply) && visible(x.root))
      .map(({ reply, root }) => tile(reply, reply.author, !isHeard(reply.id), () => openThreadAt(root, reply, "mine")));
    if (!tiles.length) tiles = [emptyState("message", t("emptyToMe"))];
  } else if (mineTab === "later") {
    tiles = laterIds()
      .flatMap((id) => findPost(feed, id) ?? [])
      .filter((x) => visible(x.post))
      .map(({ post, root }) => tile(post, post.author, false, () => openThreadAt(root, post, "mine")));
    if (!tiles.length) tiles = [emptyState("clock", t("emptyLater"))];
  } else if (mineTab === "posts") {
    tiles = [...shown(myPosts(feed)), ...shown(myThreads(feed))].map((p) =>
      tile(p, p.mine ? t("you") : p.author, false, () => openThreadAt(p, p, "mine")),
    );
    if (!tiles.length) tiles = [emptyState("mic", t("emptyPosts"))];
  } else {
    tiles = soundTiles();
  }
  g.append(...tiles);
}

// вкладка «звуки»: запросы на звуки из моих записей, мои живые звуки, настройка согласия
export function soundRow(c: CommunitySound, text: string, sub: string, buttons: HTMLElement[]) {
  const r = document.createElement("div");
  r.className = "snd-row";
  r.innerHTML = `<span class="snd-ico">${escapeHtml(c.icon)}</span><span class="snd-text">${escapeHtml(text)}<small>«${escapeHtml(sub)}»</small></span>`;
  r.append(...buttons);
  return r;
}

function pillBtn(content: string, aria: string, onClick: () => void, dark = false) {
  const b = document.createElement("button");
  b.className = "pill icon-only" + (dark ? " dark" : "");
  b.innerHTML = content;
  b.setAttribute("aria-label", aria);
  b.onclick = onClick;
  return b;
}

function previewSound(c: CommunitySound) {
  const src = findPost(feed, c.postId)?.post.src;
  if (src) void playClip(src, c.start, c.dur, player.fx(c.dur * 1000 + 300));
}

function soundTiles(): HTMLElement[] {
  const ids = myIds();
  const out: HTMLElement[] = [];
  const section = (t: string) => {
    const h = document.createElement("p");
    h.className = "snd-section";
    h.textContent = t;
    out.push(h);
  };

  const reqs = requestsForMe(ids);
  if (reqs.length) {
    section(t("sndRequests"));
    for (const c of reqs)
      out.push(
        soundRow(c, t("sndWants", { name: c.by }), c.name, [
          pillBtn(icon("play"), t("listen"), () => previewSound(c)),
          pillBtn(icon("x"), t("decline"), () => {
            setStatus(c.id, "declined");
            renderMine();
            updateBadge();
            toast(t("declined"));
          }),
          pillBtn(icon("check"), t("allow"), () => {
            setStatus(c.id, "live");
            renderFan();
            renderMine();
            updateBadge();
            toast(t("nowCommunity", { icon: c.icon }));
          }, true),
        ]),
      );
  }

  const live = mySounds(ids);
  if (live.length) {
    section(t("yourSounds"));
    for (const c of live)
      out.push(
        soundRow(c, c.uses ? tn("played", c.uses) : t("notPlayed"), c.name, [
          pillBtn(icon("play"), t("listen"), () => previewSound(c)),
          pillBtn(icon("x"), t("revoke"), () => {
            setStatus(c.id, "revoked");
            renderFan();
            renderMine();
            toast(t("revoked"));
          }),
        ]),
      );
  }

  // неоморфный переключатель: вкл — звуки из моих записей появляются без вопроса
  const on = allowsWithoutAsking();
  const row = document.createElement("div");
  row.className = "switch-row";
  row.innerHTML = `<span>${escapeHtml(t("allowNoAsk"))}</span>`;
  const sw = document.createElement("button");
  sw.className = "switch" + (on ? " on" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(on));
  sw.setAttribute("aria-label", t("allowNoAskAria"));
  sw.onclick = () => {
    setAllowWithoutAsking(!on);
    renderMine();
  };
  row.append(sw);
  out.push(row);

  if (!reqs.length && !live.length) out.unshift(emptyState("wave", t("emptySounds")));
  return out;
}

$("playNew").onclick = () => {
  const fresh = freshToMe().reverse(); // от старых к новым — как шёл разговор
  if (!fresh.length) return;
  openQueue(fresh.map((x) => ({ post: x.reply, parent: x.root })), 0, "mine");
};
