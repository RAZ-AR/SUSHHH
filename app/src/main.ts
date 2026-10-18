import { envelope, Player, Recorder } from "./audio";
import {
  addReaction, blockAuthor, blockedAuthors, deleteRecording, findPost, hidePost, isHeard, isLater, laterIds,
  loadFeed, markHeard, me, mostDiscussed, myPosts, myThreads, removeLater, repliesToMe, report,
  saveRecording, storedToPost, streams, toggleLater, unblockAuthor, unheardToMe, visible,
  type Moment, type Post, type ReportReason, type Stored, type Stream,
} from "./feed";
import { aura, auraGradient, hsl, paintAura } from "./aura";
import { icon, paintIcons } from "./icons";
import { MEMES, NAMES, playReaction, REACTIONS, type Reaction } from "./reactions";
import {
  allowsWithoutAsking, authorAllows, countUse, createSound, durationOf, isSoundKey, liveSounds, MAX_DUR, mySounds,
  playClip, requestsForMe, setAllowWithoutAsking, setStatus, SOUND_ICONS, soundByKey, soundKey, wordsAt,
  type CommunitySound,
} from "./sounds";
import { LiveTranscript } from "./speech";
import { drawRing } from "./thumbs";
import { N, Visual, type Mark } from "./visual";

paintIcons();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const POST_MS = 30_000;
const REPLY_MS = 15_000;
const RATES = [1, 1.25, 1.5];

let feed: Post[] = [];

// огибающие считаются один раз и кэшируются в самом посте
const pending = new Map<Post, Promise<void>>();
function ensureEnv(p: Post): Promise<void> {
  if (p.env) return Promise.resolve();
  let job = pending.get(p);
  if (!job) {
    job = envelope(p.src, N).then((e) => void (p.env = e)).catch(() => {});
    pending.set(p, job);
  }
  return job;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

let toastTimer = 0;
function toast(text: string) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2000);
}

const shown = (list: Post[]) => list.filter(visible);
const freshToMe = () => unheardToMe(feed).filter((x) => visible(x.reply) && visible(x.root));

// =================== навигация ===================

type View = "home" | "mine";
let view: View = "home";

function showView(v: View) {
  view = v;
  $("home").hidden = v !== "home";
  $("mine").hidden = v !== "mine";
  if (v === "mine") {
    player.el.pause();
    renderMine();
  } else renderStories();
  updateBadge();
}

document.querySelectorAll<HTMLElement>("[data-go]").forEach((b) => (b.onclick = () => showView(b.dataset.go as View)));
document.querySelectorAll<HTMLElement>("[data-rec]").forEach((b) => (b.onclick = () => openRecorder(null)));

// id моих записей и ответов — по ним ищем запросы на звуки
function myIds() {
  const ids = new Set<string>();
  for (const p of feed) {
    if (p.mine) ids.add(p.id);
    for (const r of p.replies) if (r.mine) ids.add(r.id);
  }
  return ids;
}

function updateBadge() {
  const n = freshToMe().length + requestsForMe(myIds()).length;
  document.querySelectorAll<HTMLElement>("[data-badge]").forEach((b) => {
    b.hidden = n === 0;
    b.textContent = String(n);
  });
}

// =================== лист действий ===================

type SheetRow = { icon: string; label: string; on?: boolean; danger?: boolean; onClick: () => void };
let resumeAfterSheet = false;

function openSheet(title: string, sub: string, rows: SheetRow[], note = "", custom?: HTMLElement) {
  $("sheetTitle").textContent = title;
  $("sheetSub").textContent = sub;
  const body = $("sheetBody");
  body.innerHTML = "";
  for (const r of rows) {
    const b = document.createElement("button");
    b.className = "sheet-row" + (r.on ? " on" : "") + (r.danger ? " danger" : "");
    b.innerHTML = `${icon(r.icon)}<span>${escapeHtml(r.label)}</span>`;
    b.onclick = r.onClick;
    body.append(b);
  }
  if (custom) body.append(custom);
  if (note) body.insertAdjacentHTML("beforeend", `<p class="sheet-note">${escapeHtml(note)}</p>`);
  $("sheet").hidden = false;
  ($("sheet").querySelector(".sheet") as HTMLElement).focus(); // фокус на лист, а не на первый пункт
}

function closeSheet(resume = true) {
  $("sheet").hidden = true;
  if (resume && resumeAfterSheet) void player.el.play().catch(() => {});
  resumeAfterSheet = false;
}

$("sheetCancel").onclick = () => closeSheet();
$("sheet").addEventListener("click", (e) => e.target === $("sheet") && closeSheet());

// =================== эфир: очередь, каналы, сторис ===================

type Item = { post: Post; parent: Post | null };
// радио — бесконечный поток канала; сторис и списки — временная очередь с возвратом
type Mode = { kind: "radio" } | { kind: "story"; index: number } | { kind: "list"; back: View };

const player = new Player();
const visual = new Visual($<HTMLCanvasElement>("cv"));
visual.setSource(player.level);

let channels: Stream[] = [];
let channelId = "foryou";
const radioPos = new Map<string, number>(); // где остановились в каждом канале
let mode: Mode = { kind: "radio" };
let items: Item[] = [];
let qi = 0;
let rate = 1.25;
let started = false; // браузер не даст играть звук до первого касания
let stories: Post[] = [];
const seen = new Set<string>();

const parentOf = (p: Post) => feed.find((f) => f.replies.includes(p)) ?? null;
const rootOf = (it: Item) => it.parent ?? it.post;
const cur = () => items[qi];

function renderChannels() {
  channels = streams(shown(feed));
  $("chanName").textContent = channels.find((c) => c.id === channelId)?.title ?? "Эфир";
}

$("chanBtn").onclick = () =>
  openSheet(
    "Что слушаем",
    "",
    channels.map((c) => ({
      icon: c.id === channelId ? "check" : "headphones",
      label: c.title,
      on: c.id === channelId && mode.kind === "radio",
      onClick: () => {
        closeSheet(false);
        tuneRadio(c.id, true);
      },
    })),
  );

function renderStories() {
  stories = mostDiscussed(shown(feed));
  const st = $("stories");
  st.innerHTML = "";
  stories.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "story" + (seen.has(p.id) ? " seen" : "");
    b.setAttribute("aria-label", `${p.author}, ${p.replies.length} ${plural(p.replies.length, "ответ", "ответа", "ответов")}`);
    b.innerHTML = `<canvas></canvas>`;
    b.style.setProperty("--ring", auraGradient(aura(p.author)));
    b.onclick = () => openStory(i);
    st.append(b);
    const cv = b.querySelector("canvas")!;
    const draw = () => drawRing(cv, p.env, seen.has(p.id) ? null : aura(p.author));
    draw();
    void ensureEnv(p).then(draw);
  });
}

function tuneRadio(id: string, play: boolean) {
  if (mode.kind === "radio") radioPos.set(channelId, qi);
  channelId = id;
  mode = { kind: "radio" };
  const ch = channels.find((c) => c.id === id) ?? channels[0];
  items = ch.posts.map((p) => ({ post: p, parent: parentOf(p) })).filter((it) => visible(it.post));
  renderChannels();
  setQueue(radioPos.get(ch.id) ?? 0, play);
}

function openStory(index: number) {
  if (mode.kind === "radio") radioPos.set(channelId, qi);
  const p = stories[index];
  seen.add(p.id);
  mode = { kind: "story", index };
  items = [{ post: p, parent: null }, ...shown(p.replies).map((r) => ({ post: r, parent: p }))];
  renderStories();
  setQueue(0, true);
}

function openQueue(list: Item[], start = 0, back: View = view) {
  if (!list.length) return;
  if (mode.kind === "radio") radioPos.set(channelId, qi);
  mode = { kind: "list", back };
  items = list;
  if (view !== "home") showView("home");
  setQueue(start, true);
}

function openThreadAt(root: Post, from: Post, back: View = view) {
  const list = [{ post: root, parent: null }, ...shown(root.replies).map((r) => ({ post: r, parent: root }))];
  openQueue(list, Math.max(0, list.findIndex((it) => it.post === from)), back);
}

// выйти из сторис/ветки обратно: в радио или в «Моё»
function leaveQueue() {
  const back = mode.kind === "list" ? mode.back : "home";
  if (back === "mine") {
    player.el.pause();
    mode = { kind: "radio" };
    tuneRadio(channelId, false);
    showView("mine");
  } else tuneRadio(channelId, started);
}
$("back").onclick = leaveQueue;

function setQueue(start: number, play: boolean) {
  const inQueue = mode.kind !== "radio";
  $("context").hidden = !inQueue;
  $("stories").hidden = inQueue;
  $("back").setAttribute("aria-label", mode.kind === "list" && mode.back === "mine" ? "Назад в «Моё»" : "Назад в эфир");
  if (play && started) void playAt(start);
  else {
    qi = Math.max(0, Math.min(start, items.length - 1));
    player.el.pause();
    player.el.removeAttribute("src");
    show();
  }
}

async function playAt(i: number) {
  qi = (i + items.length) % items.length;
  markHeard(cur().post.id);
  updateBadge();
  show();
  try {
    await player.play(cur().post.src, rate);
    started = true;
  } catch {
    // автозапуск заблокирован — ждём касания
  }
}

// направление смены записи: 1 — следующий голос снизу, -1 — предыдущий сверху
let swapDir = 0;

function show() {
  const { post: p, parent } = cur();
  // аура говорящего: цвет за диском, дорожка времени; переход между аурами плавный (CSS @property)
  const a = aura(p.author);
  paintAura($("home"), a); // аура на весь экран: её видят и свечение, и волосок под диском
  visual.setAura(a);
  if (swapDir) {
    const st = $("stage");
    st.classList.remove("swap-next", "swap-prev");
    void st.offsetWidth;
    st.classList.add(swapDir > 0 ? "swap-next" : "swap-prev");
    swapDir = 0;
  }
  $("hook").textContent = p.hook;
  $("hook").classList.remove("open");
  $("transcript").textContent = p.text ?? "Расшифровка появится после обработки.";
  $("transcript").hidden = true;
  $("live").textContent = `${p.author}: ${p.hook}`;
  const n = shown(rootOf(cur()).replies).length;
  $("threadCount").textContent = n ? String(n) : "";
  $("laterBtn").classList.toggle("on", isLater(p.id));
  $("heartBtn").classList.remove("liked");
  $("heartBtn").querySelector(".ico")!.outerHTML = icon("heart");
  renderReactionCounts();
  visual.setMarks(marksFor(p, !parent));
  void ensureEnv(p).then(() => {
  });
  // «гусеница»: пройденные шарики переливаются, текущий светится
  $("segments").innerHTML =
    mode.kind === "radio" ? "" : items.map((_, i) => `<span class="seg${i < qi ? " done" : i === qi ? " now" : ""}"><i></i></span>`).join("");
  $("fan").hidden = true;
}

function next() {
  swapDir = 1;
  if (mode.kind === "radio") return playAt(qi + 1); // радио не кончается: по кругу
  if (qi < items.length - 1) return playAt(qi + 1);
  if (mode.kind === "story" && mode.index < stories.length - 1) return openStory(mode.index + 1);
  leaveQueue();
}

function prev() {
  swapDir = -1;
  if (player.el.currentTime > 2) {
    swapDir = 0;
    player.el.currentTime = 0;
    return;
  }
  if (qi > 0 || mode.kind === "radio") return playAt(qi - 1);
  if (mode.kind === "story" && mode.index > 0) return openStory(mode.index - 1);
  player.el.currentTime = 0;
}

function toggle() {
  if (player.el.paused) {
    if (player.el.getAttribute("src")) void player.el.play().then(() => (started = true)).catch(() => playAt(qi));
    else void playAt(qi);
  } else player.el.pause();
}

function playThread() {
  const it = cur();
  const root = rootOf(it);
  const replies = shown(root.replies);
  if (!replies.length) return toast("Ответов пока нет — будь первым");
  openThreadAt(root, it.parent ? it.post : replies[0], view);
}

player.el.addEventListener("ended", () => setTimeout(() => !$("home").hidden && next(), 400));

(function progress() {
  requestAnimationFrame(progress);
  if ($("home").hidden || !cur()) return;
  const el = player.el;
  const d = isFinite(el.duration) ? el.duration : 0;
  const prog = el.ended ? 1 : d ? el.currentTime / d : 0;
  const bar = $("segments").children[qi]?.firstElementChild as HTMLElement | undefined;
  if (bar) bar.style.width = `${prog * 100}%`;
  visual.setProgress(el.ended ? 0 : prog);
  glow($("stage"), visual);

  // диск чистый: имя и волосок прогресса — под ним
  const { post: p, parent } = cur();
  $("who").textContent = parent ? `↳ ${p.author}` : p.author;
  $("hairFill").style.width = `${(el.ended ? 0 : prog) * 100}%`;
  $("hair").setAttribute("aria-valuenow", String(Math.round(prog * 100)));
  $("startBtn").hidden = started;
})();

// цвет за диском: размер — по кольцу, пульс — по громкости, вращение быстрее, когда говорят,
// в тишине — медленное дыхание. При «уменьшении движения» цвет не вращается.
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const spin = new WeakMap<HTMLElement, number>();

function glow(stage: HTMLElement, v: Visual) {
  const breath = 0.04 + 0.035 * Math.sin(performance.now() / 1300);
  const lv = Math.max(v.level, calm ? 0 : breath);
  const rot = (spin.get(stage) ?? 0) + (calm ? 0 : 0.1 + v.level * 2.8);
  spin.set(stage, rot % 1800); // 1800 — общий период обоих слоёв, без скачка
  stage.style.setProperty("--r", `${v.ringRadiusCss}px`);
  stage.style.setProperty("--lv", lv.toFixed(3));
  stage.style.setProperty("--rot", `${rot.toFixed(1)}deg`);
  stage.style.setProperty("--tone", v.tone.toFixed(3));
}

// =================== метки на кольце ===================

const ringDist = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

const progressNow = () => {
  const d = player.el.duration;
  return d && isFinite(d) ? Math.min(1, player.el.currentTime / d) : 0;
};

// ответы — тёмный «↳» на своём моменте; реакции — «😂 8», группами по 6% записи
function marksFor(p: Post, isRoot: boolean): Mark[] {
  const all: (Mark & { w: number })[] = [];
  if (isRoot) for (const r of shown(p.replies)) if (r.at !== undefined) all.push({ at: r.at, kind: "reply", text: "↳", aura: aura(r.author), w: 100 });

  const bins = new Map<number, Moment[]>();
  for (const m of p.moments) {
    const b = Math.round(m.at / 0.06);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b)!.push(m);
  }
  for (const list of bins.values()) {
    if (list.length < 2 && p.moments.length > 4) continue; // одиночки не шумят, если реакций много
    const count = new Map<string, number>();
    for (const m of list) count.set(m.emoji, (count.get(m.emoji) ?? 0) + 1);
    const topKey = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const top = isSoundKey(topKey) ? (soundByKey(topKey)?.icon ?? "🔊") : topKey;
    const at = list.reduce((a, m) => a + m.at, 0) / list.length;
    all.push({ at, kind: "reaction", text: top, count: list.length, w: list.length });
  }

  // не больше пяти меток и не теснее 7% круга: важные первыми
  const kept: Mark[] = [];
  for (const { w: _w, ...m } of all.sort((a, b) => b.w - a.w))
    if (kept.length < 5 && kept.every((k) => ringDist(k.at, m.at) > 0.07)) kept.push(m);
  return kept;
}

// =================== реакции ===================

function renderReactionCounts() {
  const hearts = cur().post.reactions["❤️"] ?? 0;
  $("heartCount").textContent = hearts ? String(hearts) : "";
}

// реакция ставится в текущий момент записи; звук идёт через анализатор — кольцо вздрагивает
function react(r: Reaction, big = false) {
  const p = cur().post;
  const at = progressNow();
  addReaction(p, r, at);
  visual.setMarks(marksFor(p, !cur().parent));
  visual.flash(at);
  playReaction(r, player.fx(2600)); // мемы длиннее эмоций — держим анализатор открытым
  toastMeme(r);
  renderReactionCounts();
  float(r, big);
  if (r === "❤️") {
    $("heartBtn").classList.add("liked");
    $("heartBtn").querySelector(".ico")!.outerHTML = icon("heartFill");
  }
}

// звук сообщества как реакция: кусок чужой записи звучит поверх, эфир чуть тише
async function reactSound(snd: CommunitySound) {
  const src = findPost(feed, snd.postId)?.post.src;
  if (!src) return;
  const p = cur().post;
  const at = progressNow();
  addReaction(p, soundKey(snd), at);
  countUse(snd);
  visual.setMarks(marksFor(p, !cur().parent));
  visual.flash(at);
  float(snd.icon);
  toast(`«${snd.name}»`);
  player.el.volume = 0.3;
  const ms = await playClip(src, snd.start, snd.dur, player.fx(MAX_DUR * 1000 + 400));
  setTimeout(() => (player.el.volume = 1), ms + 100);
}

function float(r: string, big = false) {
  const s = document.createElement("span");
  s.className = "float" + (big ? " big" : "");
  s.textContent = r;
  s.style.left = `${20 + Math.random() * 60}%`;
  $("floaters").append(s);
  setTimeout(() => s.remove(), 1600);
}

// сердце: тап — ❤️, удержание (или правый клик) — веер остальных реакций
let holdTimer = 0;
let fanByHold = false;
$("heartBtn").addEventListener("pointerdown", () => {
  fanByHold = false;
  holdTimer = window.setTimeout(() => {
    fanByHold = true;
    $("fan").hidden = false;
  }, 420);
});
$("heartBtn").addEventListener("pointerleave", () => clearTimeout(holdTimer));
$("heartBtn").addEventListener("contextmenu", (e) => {
  e.preventDefault();
  $("fan").hidden = false;
});
$("heartBtn").onclick = () => {
  clearTimeout(holdTimer);
  if (fanByHold) return;
  react("❤️");
  // один раз подскажем, где остальные реакции
  try {
    if (!localStorage.getItem("sushhh.hintFan")) {
      localStorage.setItem("sushhh.hintFan", "1");
      setTimeout(() => toast("Удерживай ♡ — другие реакции"), 900);
    }
  } catch {
    // без хранилища подсказка просто не покажется
  }
};
$("heartBtn").onkeydown = (e) => {
  if (e.key === "ArrowUp") (e.preventDefault(), ($("fan").hidden = false));
};
// веер: верхний ряд — эмоции, нижний — ситком-мемы
const fanRow = (list: readonly Reaction[]) =>
  `<div class="fan-row">${list.map((r) => `<button data-r="${r}" aria-label="${NAMES[r]}" title="${NAMES[r]}"><span>${r}</span></button>`).join("")}</div>`;
function renderFan() {
  const community = liveSounds().slice(0, 6);
  $("fan").innerHTML =
    fanRow(REACTIONS) +
    fanRow(MEMES) +
    (community.length
      ? `<div class="fan-row community">${community
          .map((c) => `<button data-s="${c.id}" aria-label="Звук «${escapeHtml(c.name)}»" title="${escapeHtml(c.name)}"><span>${c.icon}</span></button>`)
          .join("")}</div>`
      : "");
}
renderFan();

// у мема есть имя — один раз подскажем, что это было
const memeSet = new Set<string>(MEMES);
function toastMeme(r: Reaction) {
  if (memeSet.has(r)) toast(NAMES[r]);
}
$("fan").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-r], [data-s]");
  if (!b) return;
  if (b.dataset.s) {
    const snd = liveSounds().find((c) => c.id === b.dataset.s);
    if (snd) void reactSound(snd);
  } else react(b.dataset.r as Reaction);
  b.classList.remove("pop");
  void b.offsetWidth;
  b.classList.add("pop");
});
document.addEventListener("pointerdown", (e) => {
  if (!(e.target as HTMLElement).closest("#fan, #heartBtn")) $("fan").hidden = true;
});

// =================== жесты на кольце ===================
// тап — пауза; двойной тап — сердце; свайп вверх/влево — дальше, вниз/вправо — назад;
// палец на самом кольце — перемотка по кругу

let down: { x: number; y: number; t: number } | null = null;
let lastTap = 0;
let tapTimer = 0;

function seekTo(frac: number) {
  const d = player.el.duration;
  if (d && isFinite(d)) player.el.currentTime = Math.max(0, Math.min(1, frac)) * d;
}

// перемотка — касанием или протяжкой по волоску под именем
function hairSeek(e: PointerEvent) {
  const r = $("hair").getBoundingClientRect();
  seekTo((e.clientX - r.left) / r.width);
}
$("hair").addEventListener("pointerdown", (e) => {
  if (!player.el.getAttribute("src")) return;
  $("hair").setPointerCapture(e.pointerId);
  hairSeek(e);
});
$("hair").addEventListener("pointermove", (e) => $("hair").hasPointerCapture(e.pointerId) && hairSeek(e));
$("hair").addEventListener("keydown", (e) => {
  const d = player.el.duration;
  if (!d || !isFinite(d)) return;
  if (e.key === "ArrowRight") player.el.currentTime = Math.min(d, player.el.currentTime + 2);
  if (e.key === "ArrowLeft") player.el.currentTime = Math.max(0, player.el.currentTime - 2);
});

$("stage").addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
$("stage").addEventListener("pointerup", (e) => {
  if (!down) return;
  const { x, y, t } = down;
  down = null;
  const dx = e.clientX - x;
  const dy = e.clientY - y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 50) {
    const forward = Math.abs(dy) > Math.abs(dx) ? dy < 0 : dx < 0;
    void (forward ? next() : prev());
    return;
  }
  if (performance.now() - t > 400) return;
  const now = performance.now();
  if (now - lastTap < 280) {
    clearTimeout(tapTimer);
    lastTap = 0;
    react("❤️", true);
    return;
  }
  lastTap = now;
  tapTimer = window.setTimeout(toggle, 280);
});

// =================== панель ===================

$("thread").onclick = playThread;
$("startBtn").onclick = (e) => {
  e.stopPropagation();
  void playAt(qi);
};
$("startBtn").addEventListener("pointerdown", (e) => e.stopPropagation());
$("startBtn").addEventListener("pointerup", (e) => e.stopPropagation());
$("laterBtn").onclick = () => {
  const on = toggleLater(cur().post.id);
  $("laterBtn").classList.toggle("on", on);
  toast(on ? "Сохранено в «Моё»" : "Убрано из «позже»");
};
$("hook").onclick = () => {
  $("hook").classList.toggle("open");
  $("transcript").hidden = !$("transcript").hidden;
};
$("hook").onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), $("hook").click());

document.addEventListener("keydown", (e) => {
  if (!$("sheet").hidden) {
    if (e.code === "Escape") closeSheet();
    return;
  }
  if (!$("recorder").hidden || $("home").hidden) return;
  if ((e.target as HTMLElement).closest?.("button, [role=button]") && (e.code === "Space" || e.code === "Enter")) return;
  if (e.code === "Space") (e.preventDefault(), toggle());
  if (e.code === "ArrowRight" || e.code === "ArrowDown") void next();
  if (e.code === "ArrowLeft" || e.code === "ArrowUp") void prev();
  if (e.code === "Escape" && mode.kind !== "radio") leaveQueue();
});

// =================== «⋯»: скорость, жалоба, скрыть, заблокировать, удалить ===================

// убрать из очереди всё, что стало невидимым, и продолжить со следующей записи
function dropHidden() {
  const ok = (it: Item) => visible(it.post) && (!it.parent || visible(it.parent));
  const nextIndex = items.slice(0, qi).filter(ok).length;
  items = items.filter(ok);
  renderChannels();
  renderStories();
  updateBadge();
  if (!items.length) {
    if (mode.kind === "radio") tuneRadio(channelId, started);
    else leaveQueue();
    return;
  }
  if (started) void playAt(nextIndex % items.length);
  else {
    qi = nextIndex % items.length;
    show();
  }
}

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "abuse", label: "Оскорбления или травля" },
  { id: "danger", label: "Угрозы или опасные действия" },
  { id: "sexual", label: "Сексуальный контент" },
  { id: "personal", label: "Раскрыты личные данные" },
  { id: "spam", label: "Спам или реклама" },
  { id: "crisis", label: "Автору может быть нужна помощь" },
  { id: "other", label: "Другое" },
];

function openReport(p: Post) {
  openSheet(
    "Что не так?",
    "",
    REASONS.map((r) => ({
      icon: r.id === "crisis" ? "heart" : "flag",
      label: r.label,
      onClick: () => {
        report(p.id, r.id);
        if (r.id === "crisis") {
          openSheet(
            "Спасибо за сигнал",
            "Модераторы посмотрят эту запись в первую очередь. Если кому-то угрожает опасность прямо сейчас — звони 112 или в местную экстренную службу.",
            [{ icon: "check", label: "Понятно", onClick: () => (closeSheet(false), dropHidden()) }],
          );
          return;
        }
        closeSheet(false);
        toast("Жалоба отправлена");
        dropHidden();
      },
    })),
    "Автор не узнает, кто пожаловался. Запись пропадёт из твоего эфира.",
  );
}

function confirmBlock(p: Post) {
  openSheet(`Заблокировать ${p.author}?`, "Записи и ответы этого человека пропадут из твоего эфира. Вернуть можно в «Моё».", [
    {
      icon: "ban",
      label: "Заблокировать",
      danger: true,
      onClick: () => {
        blockAuthor(p.author);
        closeSheet(false);
        toast(`${p.author} — в блоке`);
        dropHidden();
      },
    },
  ]);
}

function confirmDelete(p: Post) {
  openSheet("Удалить запись?", "Ответы других людей останутся с пометкой «исходная запись удалена».", [
    {
      icon: "trash",
      label: "Удалить навсегда",
      danger: true,
      onClick: async () => {
        await deleteRecording(p.id);
        closeSheet(false);
        toast("Запись удалена");
        dropHidden();
      },
    },
  ]);
}

$("moreBtn").onclick = () => {
  const { post: p } = cur();
  resumeAfterSheet = !player.el.paused;
  player.el.pause();
  const speedRow: SheetRow = {
    icon: "speed",
    label: `Скорость ${rate}×`,
    onClick: () => {
      rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
      player.el.playbackRate = rate;
      closeSheet();
      toast(`Скорость ${rate}×`);
    },
  };
  const soundRow: SheetRow = { icon: "scissors", label: "Сделать звук из этого момента", onClick: () => void openMakeSound(p) };
  if (p.mine) {
    openSheet(p.author, "", [speedRow, soundRow, { icon: "trash", label: "Удалить запись", danger: true, onClick: () => confirmDelete(p) }]);
    return;
  }
  openSheet(p.author, "", [
    speedRow,
    soundRow,
    { icon: "flag", label: "Пожаловаться", onClick: () => openReport(p) },
    {
      icon: "hide",
      label: "Скрыть эту запись",
      onClick: () => {
        hidePost(p.id);
        closeSheet(false);
        toast("Запись скрыта");
        dropHidden();
      },
    },
    { icon: "ban", label: `Заблокировать ${p.author}`, danger: true, onClick: () => confirmBlock(p) },
  ]);
};

// =================== звуки сообщества: создание ===================

// какой момент вырезать: где сейчас пауза, а если запись не слушали — самая «горячая» секунда
function hotMoment(p: Post) {
  const bins = new Map<number, number>();
  for (const m of p.moments) bins.set(Math.round(m.at / 0.08), (bins.get(Math.round(m.at / 0.08)) ?? 0) + 1);
  const best = [...bins.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] * 0.08 : 0.3;
}

async function openMakeSound(p: Post) {
  let d = 0;
  try {
    d = await durationOf(p.src);
  } catch {
    return toast("Не получилось открыть запись");
  }
  const played = cur()?.post === p && player.el.currentTime > 0;
  const center = played ? player.el.currentTime : hotMoment(p) * d;
  const dur = Math.min(MAX_DUR, d);
  const start = Math.max(0, Math.min(center - dur / 2, d - dur));
  const name = wordsAt(p.text, (start + dur / 2) / d) || `${p.author} · ${clock(start)}`;
  const allowed = p.mine || authorAllows(p.author, false);
  let chosen = SOUND_ICONS[0];

  const box = document.createElement("div");
  box.className = "make";
  box.innerHTML = `
    <p class="quote">«${escapeHtml(name)}»</p>
    <div class="icons">${SOUND_ICONS.map((ic, i) => `<button data-ic="${ic}" class="${i ? "" : "on"}" aria-label="Значок ${ic}">${ic}</button>`).join("")}</div>
    <div class="row">
      <button class="pill" data-act="play">${icon("play")}${clock(dur)}</button>
      <button class="pill dark" data-act="make">${icon("check")}Сделать звук</button>
    </div>
    <p class="hint">${allowed ? "Автор разрешает звуки — появится в веере сразу." : "Спросим автора — звук появится, когда автор разрешит."}</p>`;
  box.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const ic = t.closest<HTMLElement>("[data-ic]");
    if (ic) {
      chosen = ic.dataset.ic!;
      box.querySelectorAll("[data-ic]").forEach((x) => x.classList.toggle("on", x === ic));
      return;
    }
    const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "play") void playClip(p.src, start, dur, player.fx(dur * 1000 + 300));
    if (act === "make") {
      const snd = createSound({ postId: p.id, author: p.author, start, dur, icon: chosen, name, by: "ты" }, allowed);
      closeSheet();
      renderFan();
      if (allowed) return toast(`${chosen} теперь в веере`);
      toast("Спросили автора");
      // в прототипе «ответ автора» имитируется через несколько секунд
      setTimeout(() => {
        setStatus(snd.id, "live");
        renderFan();
        toast(`${chosen} «${name}» — звук одобрен`);
      }, 8000);
    }
  });
  openSheet("Новый звук", "Кусок этой записи станет реакцией для всех.", [], "", box);
}

// =================== моё: всё для слушания ===================

type MineTab = "toMe" | "later" | "posts" | "sounds" | "blocked";
let mineTab: MineTab = "toMe";

document.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
  b.onclick = () => {
    mineTab = b.dataset.tab as MineTab;
    renderMine();
  };
});

function tile(p: Post, name: string, isNew: boolean, onOpen: () => void) {
  const t = document.createElement("button");
  t.className = "tile" + (isNew ? " new" : "");
  t.setAttribute("aria-label", `${name}: ${p.hook}${isNew ? ", новое" : ""}`);
  t.innerHTML = `<canvas></canvas><span>${escapeHtml(name)}</span>`;
  t.onclick = onOpen;
  const cv = t.querySelector("canvas")!;
  queueMicrotask(() => drawRing(cv, p.env, aura(p.author)));
  void ensureEnv(p).then(() => drawRing(cv, p.env, aura(p.author)));
  return t;
}

function emptyState(ic: string, text: string) {
  const e = document.createElement("p");
  e.className = "empty";
  e.innerHTML = `${icon(ic)}${escapeHtml(text)}`;
  return e;
}

function renderMine() {
  const fresh = freshToMe();
  $("playNewText").textContent = fresh.length
    ? `${fresh.length} ${plural(fresh.length, "новый ответ", "новых ответа", "новых ответов")}`
    : "Новых ответов нет";
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
    if (!tiles.length) tiles = [emptyState("message", "Ответь кому-нибудь или запиши своё — ответы появятся здесь")];
  } else if (mineTab === "later") {
    tiles = laterIds()
      .flatMap((id) => findPost(feed, id) ?? [])
      .filter((x) => visible(x.post))
      .map(({ post, root }) => tile(post, post.author, false, () => openThreadAt(root, post, "mine")));
    if (!tiles.length) tiles = [emptyState("clock", "Нажми часы во время прослушивания — запись подождёт тебя здесь")];
  } else if (mineTab === "posts") {
    tiles = [...shown(myPosts(feed)), ...shown(myThreads(feed))].map((p) =>
      tile(p, p.mine ? "ты" : p.author, false, () => openThreadAt(p, p, "mine")),
    );
    if (!tiles.length) tiles = [emptyState("mic", "Своих записей пока нет. Микрофон внизу — до 30 секунд")];
  } else if (mineTab === "sounds") {
    tiles = soundTiles();
  } else {
    tiles = blockedAuthors().map((name) => {
      const r = document.createElement("div");
      r.className = "blocked-row";
      r.innerHTML = `<span>${escapeHtml(name)}</span>`;
      const b = document.createElement("button");
      b.className = "pill";
      b.textContent = "Вернуть";
      b.onclick = () => {
        unblockAuthor(name);
        renderChannels();
        renderStories();
        renderMine();
        toast(`${name} — снова в эфире`);
      };
      r.append(b);
      return r;
    });
    if (!tiles.length) tiles = [emptyState("ban", "Никого. Заблокировать можно через «⋯» в эфире")];
  }
  g.append(...tiles);
}

// вкладка «звуки»: запросы на звуки из моих записей, мои живые звуки, настройка согласия
function soundRow(c: CommunitySound, text: string, sub: string, buttons: HTMLElement[]) {
  const r = document.createElement("div");
  r.className = "snd-row";
  r.innerHTML = `<span class="snd-ico">${c.icon}</span><span class="snd-text">${escapeHtml(text)}<small>«${escapeHtml(sub)}»</small></span>`;
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
    section("Просят сделать звук");
    for (const c of reqs)
      out.push(
        soundRow(c, `${c.by} хочет звук`, c.name, [
          pillBtn(icon("play"), "Послушать", () => previewSound(c)),
          pillBtn(icon("x"), "Отказать", () => {
            setStatus(c.id, "declined");
            renderMine();
            updateBadge();
            toast("Отказано");
          }),
          pillBtn(icon("check"), "Разрешить", () => {
            setStatus(c.id, "live");
            renderFan();
            renderMine();
            updateBadge();
            toast(`${c.icon} теперь звук сообщества`);
          }, true),
        ]),
      );
  }

  const live = mySounds(ids);
  if (live.length) {
    section("Твои звуки");
    for (const c of live)
      out.push(
        soundRow(c, c.uses ? `звучал ${c.uses} ${plural(c.uses, "раз", "раза", "раз")}` : "ещё не звучал", c.name, [
          pillBtn(icon("play"), "Послушать", () => previewSound(c)),
          pillBtn(icon("x"), "Отозвать", () => {
            setStatus(c.id, "revoked");
            renderFan();
            renderMine();
            toast("Звук отозван");
          }),
        ]),
      );
  }

  // неоморфный переключатель: вкл — звуки из моих записей появляются без вопроса
  const on = allowsWithoutAsking();
  const row = document.createElement("div");
  row.className = "switch-row";
  row.innerHTML = `<span>Разрешать звуки без вопроса</span>`;
  const sw = document.createElement("button");
  sw.className = "switch" + (on ? " on" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(on));
  sw.setAttribute("aria-label", "Разрешать звуки из моих записей без вопроса");
  sw.onclick = () => {
    setAllowWithoutAsking(!on);
    renderMine();
  };
  row.append(sw);
  out.push(row);

  if (!reqs.length && !live.length) out.unshift(emptyState("wave", "Когда кто-то захочет сделать звук из твоей записи, ты решишь здесь"));
  return out;
}

$("playNew").onclick = () => {
  const fresh = freshToMe().reverse(); // от старых к новым — как шёл разговор
  if (!fresh.length) return;
  openQueue(fresh.map((x) => ({ post: x.reply, parent: x.root })), 0, "mine");
};

// =================== запись ===================

const MIN_MS = 1_000;
const HOLD_MS = 350; // дольше — значит держат кнопку, отпускание завершает запись

const recorder = new Recorder();
const recVisual = new Visual($<HTMLCanvasElement>("cv2"));
const preview = new Player();
const transcript = new LiveTranscript();
let replyTo: Post | null = null;
let replyAt: number | undefined;
let maxMs = POST_MS;
let take: { blob: Blob; text: string; env: number[] } | null = null;
let previewUrl = "";
let pressedAt = 0;
let resumeAfter = false;

recVisual.setSource(() => recorder.level() ?? preview.level());

function setIcon(el: HTMLElement, name: string) {
  el.querySelector(".ico")!.outerHTML = icon(name);
}

// at — момент исходной записи, на который отвечают (0..1)
function openRecorder(to: Post | null, at?: number) {
  resumeAfter = !player.el.paused && view === "home";
  player.el.pause();
  replyTo = to;
  replyAt = to ? at : undefined;
  maxMs = to ? REPLY_MS : POST_MS;
  const mine = aura(me());
  paintAura($("recStage"), mine);
  recVisual.setAura(mine);
  $("recWhat").innerHTML = to ? `${icon("reply")}${escapeHtml(to.author)}` : `${icon("mic")}до ${POST_MS / 1000} с`;
  reset();
  $("recorder").hidden = false;
}

function closeRecorder() {
  if (recorder.active) {
    transcript.stop();
    void recorder.stop();
  }
  preview.el.pause();
  $("recorder").hidden = true;
  if (resumeAfter) void player.el.play().catch(() => {});
}

function reset() {
  preview.el.pause();
  take = null;
  recVisual.setMarks([]);
  recVisual.setProgress(0);
  setRecState("idle");
}

let recState: "idle" | "live" | "done" = "idle";

function setRecState(s: "idle" | "live" | "done", note?: string) {
  recState = s;
  const btn = $("recBtn");
  btn.classList.toggle("live", s === "live");
  btn.setAttribute("aria-label", s === "live" ? "Остановить запись" : "Начать запись");
  setIcon(btn, s === "live" ? "stop" : "mic");
  $("recIdle").hidden = s === "done";
  $("recDone").hidden = s !== "done";
  $("recNote").textContent =
    note ?? (s === "idle" ? "Нажми или удерживай" : s === "done" ? (replyTo ? "Ответ услышит автор" : "24 часа в эфире") : "");
  if (s === "idle") {
    setTimer(0);
    $("recText").textContent = "";
  }
  setIcon($("listenBack"), "play");
}

// под диском — время и волосок до лимита; диск остаётся чистым, голос виден в свечении
function setTimer(ms: number) {
  const total = maxMs / 1000;
  const sec = Math.min(total, Math.floor(ms / 1000));
  $("recTime").textContent = recState === "live" && total - sec <= 5 ? `${clock(sec)} · ещё ${total - sec} с` : clock(sec);
  $("recHairFill").style.width = recState === "live" ? `${Math.min(1, ms / maxMs) * 100}%` : "0%";
}

async function startRec() {
  try {
    await recorder.start(maxMs, () => void stopRec());
  } catch {
    setRecState("idle", "Нужен доступ к микрофону");
    return;
  }
  setRecState("live");
  transcript.start((t) => ($("recText").textContent = t));
  (function tick() {
    if (!recorder.active) return;
    if (recState === "live") setTimer(performance.now() - recorder.startedAt);
    requestAnimationFrame(tick);
  })();
}

async function stopRec() {
  if (!recorder.active) return;
  const dur = performance.now() - recorder.startedAt;
  transcript.stop();
  const blob = await recorder.stop();
  recVisual.setProgress(0);
  if (dur < MIN_MS) {
    reset();
    setRecState("idle", "Слишком коротко — скажи пару слов");
    return;
  }
  let env: number[] = [];
  try {
    env = Array.from(await envelope(blob, N));
  } catch {
    // формат не декодируется — формы не будет, запись всё равно сохраним
  }
  take = { blob, text: transcript.text, env };
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  setRecState("done");
  setTimer(dur);
}

// тап — старт/стоп, удержание — запись, пока палец на кнопке
$("recBtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  $("recBtn").setPointerCapture(e.pointerId);
  pressedAt = performance.now();
  if (!recorder.active) void startRec();
});
$("recBtn").addEventListener("pointerup", () => {
  if (!recorder.active) return;
  const held = performance.now() - pressedAt;
  const sinceStart = performance.now() - recorder.startedAt;
  if (held > HOLD_MS || sinceStart > HOLD_MS + 100) void stopRec();
});

$("again").onclick = reset;
$("listenBack").onclick = () => {
  if (!take) return;
  if (!preview.el.paused) return preview.el.pause();
  void preview.play(previewUrl, 1);
};
preview.el.addEventListener("play", () => setIcon($("listenBack"), "pause"));
preview.el.addEventListener("pause", () => setIcon($("listenBack"), "play"));
(function previewProgress() {
  if (!$("recorder").hidden) glow($("recStage"), recVisual);
  const d = preview.el.duration;
  if (take && d && isFinite(d) && !preview.el.paused) $("recHairFill").style.width = `${(preview.el.currentTime / d) * 100}%`;
  requestAnimationFrame(previewProgress);
})();

$("publish").onclick = async () => {
  if (!take) return;
  const stored: Stored = {
    id: crypto.randomUUID(),
    blob: take.blob,
    createdAt: Date.now(),
    palette: 0,
    replyTo: replyTo?.id,
    at: replyAt,
    text: take.text || undefined,
    env: take.env.length ? take.env : undefined,
  };
  await saveRecording(stored);
  const post = storedToPost(stored);
  const wasReply = !!replyTo;
  resumeAfter = false;
  closeRecorder();

  if (replyTo) {
    const root = replyTo;
    root.replies.push(post);
    // ответил — запись и её реплики уходят из «позже»
    for (const id of laterIds()) if (findPost(feed, id)?.root === root) removeLater(id);
    const last = items.map((it) => rootOf(it) === root).lastIndexOf(true);
    if (last >= 0 && mode.kind !== "radio") items.splice(last + 1, 0, { post, parent: root });
    if (view === "home") show();
    else renderMine();
  } else {
    feed.unshift(post);
    renderChannels();
    if (view === "mine") renderMine();
  }
  renderStories();
  toast(wasReply ? "Ответ отправлен" : "В эфире");
};

// ответ привязывается к моменту: где сейчас пауза в исходной записи,
// а если слушаем чужой ответ — к тому же моменту, что и он
$("reply").onclick = () => {
  const it = cur();
  if (it.parent) return openRecorder(it.parent, it.post.at);
  if (!player.el.currentTime) return openRecorder(it.post);
  openRecorder(it.post, progressNow());
};
$("close").onclick = closeRecorder;

// =================== старт ===================

// моя аура — цвет кнопок, которыми говорю я: «ответить» и записать
{
  const mine = aura(me());
  document.documentElement.style.setProperty("--me1", hsl(mine[0], 1, 72));
  document.documentElement.style.setProperty("--me2", hsl(mine[1], 1, 76));
}

loadFeed().then((f) => {
  feed = f;
  renderChannels();
  renderStories();
  tuneRadio("foryou", false);
  showView("home");
});
