import { envelope, Player, Recorder } from "./audio";
import {
  addReaction, ago, blockAuthor, blockedAuthors, deleteRecording, findPost, hidePost, isHeard, isLater, laterIds,
  loadFeed, markHeard, me, mostDiscussed, myPosts, myThreads, reactionCount, removeLater, repliesToMe, report,
  saveRecording, storedToPost, streams, toggleLater, unblockAuthor, unheardToMe, visible,
  type Moment, type Post, type ReportReason, type Stored, type Stream,
} from "./feed";
import { playReaction, REACTIONS, type Reaction } from "./reactions";
import { LiveTranscript, speechSupported } from "./speech";
import { drawRing } from "./thumbs";
import { N, Visual, type Mark } from "./visual";

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

const two = (n: number) => String(Math.max(0, Math.min(99, Math.round(n)))).padStart(2, "0");
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const levelWord = (l: number) => (l < 0.12 ? "ТИХО" : l < 0.4 ? "РОВНО" : "ГРОМКО");

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

let toastTimer = 0;
function toast(text: string) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2200);
}

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
  requestAnimationFrame(renderChrome);
  window.scrollTo(0, 0);
}

document.querySelectorAll<HTMLElement>("[data-go]").forEach((b) => (b.onclick = () => showView(b.dataset.go as View)));
document.querySelectorAll<HTMLElement>("[data-rec]").forEach((b) => (b.onclick = () => openRecorder(null)));

const freshToMe = () => unheardToMe(feed).filter((x) => visible(x.reply) && visible(x.root));
const shown = (list: Post[]) => list.filter(visible);

function updateBadge() {
  const n = freshToMe().length;
  document.querySelectorAll<HTMLElement>("[data-badge]").forEach((b) => {
    b.hidden = n === 0;
    b.textContent = String(n);
  });
}

// тёмная плитка-циферблат в «Моё»: сутки по кругу, оранжевое — эфир 21–23, белая точка — сейчас
const AIR_FROM = 21;
const AIR_TO = 23;

function drawDial(cv: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (cv.width = Math.round(cv.clientWidth * dpr));
  cv.height = Math.round(cv.clientHeight * dpr);
  if (!w) return;
  const ctx = cv.getContext("2d")!;
  const cx = w / 2;
  const cy = cv.height / 2;
  const R = w * 0.34;
  const ang = (hr: number) => (hr / 24) * Math.PI * 2 - Math.PI / 2;
  for (let i = 0; i < 24; i++) {
    const a = ang(i);
    const air = i >= AIR_FROM && i < AIR_TO;
    ctx.strokeStyle = air ? "#FF5B1F" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = (air ? 2.5 : 1.2) * dpr;
    const r1 = R * (i % 6 === 0 ? 0.78 : 0.86);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  const d = new Date();
  const a = ang(d.getHours() + d.getMinutes() / 60);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * R * 1.18, cy + Math.sin(a) * R * 1.18, 2.6 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `500 ${9 * dpr}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, cx, cy);
}

function airLabel() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= AIR_FROM && h < AIR_TO) return `Эфир открыт · до ${AIR_TO}:00`;
  const until = (AIR_FROM - h + 24) % 24;
  const hh = Math.floor(until);
  const mm = Math.round((until - hh) * 60);
  return `До вечернего эфира ${hh ? `${hh} ч ` : ""}${mm} мин`;
}

function renderChrome() {
  document.querySelectorAll<HTMLCanvasElement>("[data-dial]").forEach(drawDial);
  document.querySelectorAll<HTMLElement>("[data-air]").forEach((e) => (e.textContent = airLabel()));
}
setInterval(renderChrome, 30_000);

// =================== эфир: очередь, каналы, сторис ===================

type Item = { post: Post; parent: Post | null };
// радио — бесконечный поток канала; сторис и списки — временная очередь с возвратом
type Mode =
  | { kind: "radio" }
  | { kind: "story"; index: number }
  | { kind: "list"; title: string; back: View };

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
  $("channels").innerHTML = channels
    .map((c) => `<button class="chan${c.id === channelId && mode.kind === "radio" ? " on" : ""}" data-ch="${c.id}">${escapeHtml(c.title)}</button>`)
    .join("");
}

$("channels").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ch]");
  if (b) tuneRadio(b.dataset.ch!, true);
});

function renderStories() {
  stories = mostDiscussed(shown(feed));
  const st = $("stories");
  st.innerHTML = "";
  stories.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "story" + (seen.has(p.id) ? " seen" : "");
    b.setAttribute("aria-label", `${p.author}: ${p.replies.length} ${plural(p.replies.length, "ответ", "ответа", "ответов")}`);
    b.innerHTML = `<canvas></canvas><span class="story-name">${escapeHtml(p.author)}</span>`;
    b.onclick = () => openStory(i);
    st.append(b);
    const cv = b.querySelector("canvas")!;
    const draw = () => drawRing(cv, p.env, true);
    draw();
    void ensureEnv(p).then(draw);
  });
}

// переключить радио на канал; play — играть сразу (если уже было касание)
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
  $("queueTitle").textContent = `Обсуждают · ${index + 1}/${stories.length}`;
  renderChannels();
  renderStories();
  setQueue(0, true);
}

function openQueue(list: Item[], title: string, start = 0, back: View = view) {
  if (!list.length) return;
  if (mode.kind === "radio") radioPos.set(channelId, qi);
  mode = { kind: "list", title, back };
  items = list;
  $("queueTitle").textContent = title;
  renderChannels();
  if (view !== "home") showView("home");
  setQueue(start, true);
}

function openThreadAt(root: Post, from: Post, back: View = view) {
  const list = [{ post: root, parent: null }, ...shown(root.replies).map((r) => ({ post: r, parent: root }))];
  openQueue(list, `Ветка · ${root.author}`, Math.max(0, list.findIndex((it) => it.post === from)), back);
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
  $("backLabel").textContent = mode.kind === "list" && mode.back === "mine" ? "Моё" : "Эфир";
  $("segments").hidden = !inQueue;
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

function show() {
  const { post: p, parent } = cur();
  // автор и тег — внутри кольца; здесь — откуда звучит запись
  const where = mode.kind === "radio" ? (channels.find((c) => c.id === channelId)?.title ?? "Эфир") : "Начало ветки";
  $("now").textContent = parent ? `Ответ · ${p.author}` : where;
  $("ago").textContent = ago(p.createdAt);
  $("synth").hidden = !p.synthetic;
  $("hook").textContent = p.hook;
  $("transcript").textContent = p.text ?? "Расшифровка появится после обработки.";
  $("tags").textContent = parent ? `↳ на «${parent.hook}»${p.at !== undefined ? ` · момент ${Math.round(p.at * 100)}%` : ""}` : "";
  $("live").textContent = `${p.author}: ${p.hook}`;
  const root = rootOf(cur());
  const n = shown(root.replies).length;
  $("threadCount").textContent = n ? String(n) : "";
  $("laterBtn").classList.toggle("on", isLater(p.id));
  renderReactionCounts();
  visual.setPortrait(p.env ?? null);
  visual.setMarks(marksFor(p, !parent));
  void ensureEnv(p).then(() => {
    if (cur()?.post === p) visual.setPortrait(p.env ?? null);
  });
  $("segments").innerHTML = mode.kind === "radio" ? "" : items.map((_, i) => `<span class="seg${i < qi ? " done" : ""}"><i></i></span>`).join("");
  $("fan").hidden = true;
}

function next() {
  if (mode.kind === "radio") return playAt(qi + 1); // радио не кончается: по кругу
  if (qi < items.length - 1) return playAt(qi + 1);
  if (mode.kind === "story" && mode.index < stories.length - 1) return openStory(mode.index + 1);
  leaveQueue();
}

function prev() {
  if (player.el.currentTime > 2) {
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

// «ветка»: послушать обсуждение целиком прямо сейчас
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

  // внутри кольца: тег, автор, сколько осталось, характер голоса
  const { post: p, parent } = cur();
  const top = parent ? "↳ ОТВЕТ" : p.tags[0] ? `#${p.tags[0].toUpperCase()}` : "ЭФИР";
  const left = d ? (d - el.currentTime) / rate : 0;
  if (!started) visual.setReadout({ top, title: p.author, digits: "", label: "НАЖМИ —", accent: "ВКЛЮЧИТЬ ЭФИР" });
  else if (!el.paused) visual.setReadout({ top, title: p.author, digits: two(Math.ceil(left)), label: "ГОЛОС:", accent: levelWord(visual.level) });
  else visual.setReadout({ top, title: p.author, digits: two(Math.ceil((d - el.currentTime) / rate)), label: "ПАУЗА" });
})();

// =================== метки на кольце ===================

const WORD: Record<string, string> = { "❤️": "СЕРДЦЕ", "😂": "СМЕХ", "🤗": "ОБЪЯТИЕ", "🔥": "ОГОНЬ", "😮": "ВАУ", "👏": "БРАВО" };
const ringDist = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

const progressNow = () => {
  const d = player.el.duration;
  return d && isFinite(d) ? Math.min(1, player.el.currentTime / d) : 0;
};

// ответы — на свой момент; реакции — группами по 6% записи, подпись — самая частая
function marksFor(p: Post, isRoot: boolean): Mark[] {
  const all: (Mark & { w: number })[] = [];
  if (isRoot)
    for (const r of shown(p.replies))
      if (r.at !== undefined) all.push({ at: r.at, kind: "reply", title: "ОТВЕТ", sub: r.author.toUpperCase(), w: 100 });

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
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const at = list.reduce((a, m) => a + m.at, 0) / list.length;
    all.push({ at, kind: "reaction", title: WORD[top] ?? "РЕАКЦИЯ", sub: `×${list.length}`, w: list.length });
  }

  // не больше пяти меток и не теснее 7% круга: важные первыми
  const kept: Mark[] = [];
  for (const { w: _w, ...m } of all.sort((a, b) => b.w - a.w))
    if (kept.length < 5 && kept.every((k) => ringDist(k.at, m.at) > 0.07)) kept.push(m);
  return kept;
}

// =================== реакции ===================

function renderReactionCounts() {
  const p = cur().post;
  const hearts = p.reactions["❤️"] ?? 0;
  const total = reactionCount(p) - hearts;
  $("heartCount").textContent = hearts ? String(hearts) : "";
  $("reactCount").textContent = total ? String(total) : "";
}

// реакция ставится в текущий момент записи; звук идёт через анализатор — кольцо вздрагивает
function react(r: Reaction, big = false) {
  const p = cur().post;
  const at = progressNow();
  addReaction(p, r, at);
  visual.setMarks(marksFor(p, !cur().parent));
  visual.flash(at);
  playReaction(r, player.fx(1100));
  renderReactionCounts();
  float(r, big);
  if (r === "❤️") {
    $("heartBtn").classList.remove("liked");
    void $("heartBtn").offsetWidth;
    $("heartBtn").classList.add("liked");
  }
}

function float(r: string, big = false) {
  const s = document.createElement("span");
  s.className = "float" + (big ? " big" : "");
  s.textContent = r;
  s.style.left = `${20 + Math.random() * 60}%`;
  $("floaters").append(s);
  setTimeout(() => s.remove(), 1600);
}

$("heartBtn").onclick = () => react("❤️");
$("fan").innerHTML = REACTIONS.map((r) => `<button data-r="${r}" aria-label="${WORD[r]}"><span>${r}</span></button>`).join("");
$("fanBtn").onclick = () => ($("fan").hidden = !$("fan").hidden);
$("fan").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
  if (!b) return;
  react(b.dataset.r as Reaction);
  b.classList.remove("pop");
  void b.offsetWidth;
  b.classList.add("pop");
});
document.addEventListener("pointerdown", (e) => {
  if (!(e.target as HTMLElement).closest("#fan, #fanBtn")) $("fan").hidden = true;
});

// =================== жесты на кольце ===================
// тап — пауза; двойной тап — сердце; свайп вверх/влево — дальше, вниз/вправо — назад;
// палец на самом кольце — перемотка по кругу

let down: { x: number; y: number; t: number; seek: boolean } | null = null;
let lastTap = 0;
let tapTimer = 0;

function ringAngle(e: PointerEvent) {
  const r = $("stage").getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  const dist = Math.hypot(dx, dy);
  const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  return { onRing: Math.abs(dist - visual.ringRadiusCss) < 26, frac: a / (Math.PI * 2) };
}

function seekTo(frac: number) {
  const d = player.el.duration;
  if (d && isFinite(d)) player.el.currentTime = frac * d;
}

$("stage").addEventListener("pointerdown", (e) => {
  const { onRing, frac } = ringAngle(e);
  const canSeek = onRing && !!player.el.getAttribute("src") && isFinite(player.el.duration);
  down = { x: e.clientX, y: e.clientY, t: performance.now(), seek: canSeek };
  if (canSeek) {
    $("stage").setPointerCapture(e.pointerId);
    seekTo(frac);
  }
});
$("stage").addEventListener("pointermove", (e) => {
  if (down?.seek) seekTo(ringAngle(e).frac);
});
$("stage").addEventListener("pointerup", (e) => {
  if (!down) return;
  const { x, y, t, seek } = down;
  down = null;
  if (seek) return;
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

// =================== панель и подпись ===================

$("thread").onclick = playThread;
$("laterBtn").onclick = () => {
  const on = toggleLater(cur().post.id);
  $("laterBtn").classList.toggle("on", on);
  toast(on ? "Сохранено в «Моё» · ответишь позже" : "Убрано из «ответить позже»");
};
$("speed").onclick = () => {
  rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
  player.el.playbackRate = rate;
  $("speed").textContent = `${rate}×`;
};
const toggleText = () => ($("transcript").hidden = !$("transcript").hidden);
$("hook").onclick = toggleText;
$("hook").onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleText());
$("markBtn").onclick = () => (mode.kind === "radio" ? toggle() : leaveQueue());

document.addEventListener("keydown", (e) => {
  if (!$("sheet").hidden) {
    if (e.code === "Escape") closeSheet();
    return;
  }
  if (!$("recorder").hidden || $("home").hidden) return;
  if ((e.target as HTMLElement).closest("button, [role=button]") && (e.code === "Space" || e.code === "Enter")) return;
  if (e.code === "Space") (e.preventDefault(), toggle());
  if (e.code === "ArrowRight" || e.code === "ArrowDown") void next();
  if (e.code === "ArrowLeft" || e.code === "ArrowUp") void prev();
  if (e.code === "Escape" && mode.kind !== "radio") leaveQueue();
});

// =================== «⋯»: жалоба, скрыть, заблокировать, удалить ===================

type SheetRow = { label: string; note?: string; danger?: boolean; onClick: () => void };
let resumeAfterSheet = false;

function openSheet(title: string, sub: string, rows: SheetRow[], note = "") {
  $("sheetTitle").textContent = title;
  $("sheetSub").textContent = sub;
  const body = $("sheetBody");
  body.innerHTML = "";
  for (const r of rows) {
    const b = document.createElement("button");
    b.className = "sheet-row" + (r.danger ? " danger" : "");
    b.innerHTML = `<span>${escapeHtml(r.label)}</span>${r.note ? `<small>${escapeHtml(r.note)}</small>` : ""}`;
    b.onclick = r.onClick;
    body.append(b);
  }
  if (note) body.insertAdjacentHTML("beforeend", `<p class="sheet-note">${escapeHtml(note)}</p>`);
  $("sheet").hidden = false;
  (body.querySelector("button") as HTMLElement | null)?.focus();
}

function closeSheet(resume = true) {
  $("sheet").hidden = true;
  if (resume && resumeAfterSheet) void player.el.play().catch(() => {});
  resumeAfterSheet = false;
  $("moreBtn").focus();
}

$("sheetCancel").onclick = () => closeSheet();
$("sheet").addEventListener("click", (e) => e.target === $("sheet") && closeSheet());

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

const REASONS: { id: ReportReason; label: string; note: string }[] = [
  { id: "abuse", label: "Оскорбления или травля", note: "кого-то унижают" },
  { id: "danger", label: "Угрозы или опасные действия", note: "насилие, оружие" },
  { id: "sexual", label: "Сексуальный контент", note: "" },
  { id: "personal", label: "Раскрыты личные данные", note: "телефон, адрес" },
  { id: "spam", label: "Спам или реклама", note: "" },
  { id: "crisis", label: "Автору может быть нужна помощь", note: "в приоритете" },
  { id: "other", label: "Другое", note: "" },
];

function openReport(p: Post) {
  openSheet(
    "Пожаловаться",
    "Что не так с этой записью?",
    REASONS.map((r) => ({
      label: r.label,
      note: r.note,
      onClick: () => {
        report(p.id, r.id);
        if (r.id === "crisis") {
          openSheet(
            "Спасибо за сигнал",
            "Модераторы посмотрят эту запись в первую очередь. Если кому-то угрожает опасность прямо сейчас — звони 112 или в местную экстренную службу.",
            [{ label: "Понятно", onClick: () => (closeSheet(false), dropHidden()) }],
          );
          return;
        }
        closeSheet(false);
        toast("Жалоба отправлена · запись скрыта");
        dropHidden();
      },
    })),
    "Автор не узнает, кто пожаловался. Запись сразу пропадёт у тебя из эфира.",
  );
}

function confirmBlock(p: Post) {
  openSheet(
    `Заблокировать ${p.author}?`,
    "Записи и ответы этого человека пропадут из твоего эфира, а тебе больше не смогут ответить с этого аккаунта. Вернуть можно в «Моё».",
    [
      {
        label: `Заблокировать ${p.author}`,
        danger: true,
        onClick: () => {
          blockAuthor(p.author);
          closeSheet(false);
          toast(`${p.author} — в блоке`);
          dropHidden();
        },
      },
    ],
  );
}

function confirmDelete(p: Post) {
  openSheet(
    "Удалить запись?",
    "Она пропадёт из эфира и из «Моё». Ответы других людей останутся с пометкой «исходная запись удалена».",
    [
      {
        label: "Удалить навсегда",
        danger: true,
        onClick: async () => {
          await deleteRecording(p.id);
          closeSheet(false);
          toast("Запись удалена");
          dropHidden();
        },
      },
    ],
  );
}

$("moreBtn").onclick = () => {
  const { post: p } = cur();
  resumeAfterSheet = !player.el.paused;
  player.el.pause();
  if (p.mine) {
    openSheet("Твоя запись", p.hook, [{ label: "Удалить запись", danger: true, onClick: () => confirmDelete(p) }]);
    return;
  }
  openSheet(`Запись · ${p.author}`, p.hook, [
    { label: "Пожаловаться", note: "модераторам", onClick: () => openReport(p) },
    {
      label: "Скрыть эту запись",
      note: "только у тебя",
      onClick: () => {
        hidePost(p.id);
        closeSheet(false);
        toast("Запись скрыта");
        dropHidden();
      },
    },
    { label: `Заблокировать ${p.author}`, danger: true, onClick: () => confirmBlock(p) },
  ]);
};

// =================== моё ===================

function row(p: Post, title: string, meta: string, opts: { isNew?: boolean; side?: HTMLElement[]; onOpen: () => void }) {
  const r = document.createElement("div");
  r.className = "row" + (opts.isNew ? " new" : "");
  r.setAttribute("role", "button");
  r.tabIndex = 0;
  r.innerHTML = `
    <canvas></canvas>
    <span class="row-main">
      <span class="row-title">${escapeHtml(title)}</span>
      <span class="row-meta">${escapeHtml(meta)}</span>
    </span>
    <span class="row-side"></span>`;
  r.querySelector(".row-side")!.append(...(opts.side ?? []));
  r.onclick = (e) => !(e.target as HTMLElement).closest(".chip") && opts.onOpen();
  r.onkeydown = (e) => e.key === "Enter" && opts.onOpen();
  const cv = r.querySelector("canvas")!;
  queueMicrotask(() => drawRing(cv, p.env, true));
  void ensureEnv(p).then(() => drawRing(cv, p.env, true));
  return r;
}

function chip(label: string, cls: string, onClick: () => void, aria?: string) {
  const b = document.createElement("button");
  b.className = `chip ${cls}`;
  b.textContent = label;
  if (aria) b.setAttribute("aria-label", aria);
  b.onclick = onClick;
  return b;
}

function fill(id: string, rows: HTMLElement[], empty: string) {
  const el = $(id);
  el.innerHTML = rows.length ? "" : `<p class="empty">${empty}</p>`;
  el.append(...rows);
}

const answers = (n: number) => `${n} ${plural(n, "ответ", "ответа", "ответов")}`;

function renderMine() {
  $("meName").textContent = `ты — ${me()}`;

  const toMe = repliesToMe(feed).filter((x) => visible(x.reply) && visible(x.root));
  const fresh = toMe.filter((x) => !isHeard(x.reply.id));
  $("newCount").textContent = fresh.length ? `· ${fresh.length} ${plural(fresh.length, "новый", "новых", "новых")}` : "";
  $("playNew").hidden = !fresh.length;
  fill(
    "toMe",
    toMe.map(({ reply, root }) =>
      row(reply, reply.hook, `${reply.author} → «${root.hook}» · ${ago(reply.createdAt)}`, {
        isNew: !isHeard(reply.id),
        onOpen: () => openThreadAt(root, reply, "mine"),
      }),
    ),
    "Пока тихо. Ответь кому-нибудь или запиши своё — ответы появятся здесь.",
  );

  const later = laterIds().flatMap((id) => findPost(feed, id) ?? []).filter((x) => visible(x.post));
  fill(
    "later",
    later.map(({ post, root }) =>
      row(post, post.hook, `${post.author} · ${ago(post.createdAt)}`, {
        onOpen: () => openThreadAt(root, post, "mine"),
        side: [
          chip("Ответить", "", () => openRecorder(root, post === root ? undefined : post.at)),
          chip("×", "x", () => {
            removeLater(post.id);
            renderMine();
          }, "Убрать"),
        ],
      }),
    ),
    "Нажми ⏱ во время прослушивания — запись подождёт тебя здесь.",
  );

  fill(
    "myPosts",
    shown(myPosts(feed)).map((p) =>
      row(p, p.hook, `${answers(p.replies.length)} · ${reactionCount(p)} ${plural(reactionCount(p), "реакция", "реакции", "реакций")} · ${ago(p.createdAt)}`, {
        onOpen: () => openThreadAt(p, p, "mine"),
      }),
    ),
    "Своих записей пока нет. Кнопка записи внизу — до 30 секунд.",
  );

  fill(
    "myThreads",
    shown(myThreads(feed)).map((p) =>
      row(p, p.hook, `${p.author} · ${answers(p.replies.length)} · ${ago(p.createdAt)}`, {
        onOpen: () => openThreadAt(p, p, "mine"),
      }),
    ),
    "Здесь будут обсуждения, в которых ты участвуешь.",
  );

  const names = blockedAuthors();
  $("blocked").innerHTML = names.length ? "" : `<p class="empty">Никого. Заблокировать можно через «⋯» во время прослушивания.</p>`;
  for (const name of names) {
    const r = document.createElement("div");
    r.className = "row lite";
    r.innerHTML = `<span class="row-main"><span class="row-title">${escapeHtml(name)}</span><span class="row-meta">Записи и ответы скрыты</span></span><span class="row-side"></span>`;
    r.querySelector(".row-side")!.append(
      chip("Разблокировать", "", () => {
        unblockAuthor(name);
        renderChannels();
        renderStories();
        renderMine();
        toast(`${name} — снова в эфире`);
      }),
    );
    $("blocked").append(r);
  }
}

$("playNew").onclick = () => {
  const fresh = freshToMe().reverse(); // от старых к новым — как шёл разговор
  openQueue(fresh.map((x) => ({ post: x.reply, parent: x.root })), "Новые ответы", 0, "mine");
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
let resumeAfter = false; // вернуть эфир после закрытия записи

recVisual.setSource(() => recorder.level() ?? preview.level());

// at — момент исходной записи, на который отвечают (0..1); sec — он же в секундах, если известен
function openRecorder(to: Post | null, at?: number, sec?: number) {
  resumeAfter = !player.el.paused && view === "home";
  player.el.pause();
  replyTo = to;
  replyAt = to ? at : undefined;
  maxMs = to ? REPLY_MS : POST_MS;
  const moment = sec !== undefined ? ` на ${clock(sec)}` : "";
  $("recTitle").textContent = to ? `Ответ${moment} · до ${REPLY_MS / 1000} с` : `Новая запись · до ${POST_MS / 1000} с`;
  $("recHead").textContent = to ? `↳ ${to.hook}` : "Что у тебя на уме?";
  $("recRules").textContent = to
    ? `Ответ услышат автор и все, кто слушает ветку`
    : `Запись будет в эфире 24 часа, потом останется в «Моё»`;
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
  recVisual.setTracing(false);
  recVisual.setPortrait(null);
  recVisual.setMarks([]);
  recVisual.setProgress(0);
  setRecState("idle");
}

let recState: "idle" | "live" | "done" = "idle";

function setRecState(s: "idle" | "live" | "done", note?: string) {
  recState = s;
  $("recBtn").classList.toggle("live", s === "live");
  $("recBtn").setAttribute("aria-label", s === "live" ? "Остановить запись" : "Начать запись");
  $("recIdle").hidden = s === "done";
  $("recDone").hidden = s !== "done";
  $("recNote").textContent =
    note ?? (s === "idle" ? "Нажми или удерживай" : s === "live" ? "Нажми ещё раз — или отпусти" : "Послушай и опубликуй");
  if (s === "idle") {
    setTimer(0);
    $("recText").textContent = speechSupported ? "" : "Расшифровка в этом браузере недоступна.";
  }
  $("listenBack").textContent = "Прослушать";
}

// секунды — пиксельными цифрами в центре; кольцо — время записи, голос рисует по нему след
function setTimer(ms: number) {
  const total = maxMs / 1000;
  const sec = Math.min(total, Math.floor(ms / 1000));
  if (recState === "live") recVisual.setProgress(ms / maxMs);
  const left = total - sec;
  const top = replyTo ? "↳ ОТВЕТ" : "ЗАПИСЬ";
  if (recState === "live")
    recVisual.setReadout(
      left <= 5
        ? { top, digits: two(sec), label: "ОСТАЛОСЬ", accent: `${left} С` }
        : { top, digits: two(sec), label: "ГОЛОС:", accent: levelWord(recVisual.level) },
    );
  else if (recState === "done") recVisual.setReadout({ top, digits: two(sec), label: "ДУБЛЬ ГОТОВ" });
  else recVisual.setReadout({ top, digits: "00", label: `ДО ${total} СЕКУНД` });
}

async function startRec() {
  try {
    await recorder.start(maxMs, () => void stopRec());
  } catch {
    setRecState("idle", "Нет доступа к микрофону. Разреши его в настройках браузера.");
    return;
  }
  setRecState("live");
  recVisual.setTracing(true);
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
  recVisual.setTracing(false);
  recVisual.setProgress(0);
  if (dur < MIN_MS) {
    reset();
    setRecState("idle", "Слишком коротко — скажи хотя бы пару слов.");
    return;
  }
  let env: number[] = [];
  try {
    env = Array.from(await envelope(blob, N));
    recVisual.setPortrait(env);
  } catch {
    // формат не декодируется — портрета не будет, запись всё равно сохраним
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
preview.el.addEventListener("play", () => ($("listenBack").textContent = "Пауза"));
preview.el.addEventListener("pause", () => ($("listenBack").textContent = "Прослушать"));
(function previewProgress() {
  const d = preview.el.duration;
  if (take && d && isFinite(d)) recVisual.setProgress(preview.el.ended ? 0 : preview.el.currentTime / d);
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
    // ответил — запись и её реплики уходят из «ответить позже»
    for (const id of laterIds()) if (findPost(feed, id)?.root === root) removeLater(id);
    // если слушаем эту ветку — ответ встаёт в конец её очереди
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
  toast(wasReply ? `Ответ отправлен${replyAt !== undefined ? ` · на ${Math.round(replyAt * 100)}% записи` : ""}` : "Опубликовано · 24 ч в эфире");
};

// ответ привязывается к моменту: где сейчас пауза в исходной записи,
// а если слушаем чужой ответ — к тому же моменту, что и он
$("reply").onclick = () => {
  const it = cur();
  if (it.parent) return openRecorder(it.parent, it.post.at);
  // запись ещё не слушали — ответ на неё целиком, без привязки к моменту
  if (!player.el.currentTime) return openRecorder(it.post);
  openRecorder(it.post, progressNow(), player.el.currentTime);
};
$("close").onclick = closeRecorder;

// =================== старт ===================

loadFeed().then((f) => {
  feed = f;
  renderChannels();
  renderStories();
  tuneRadio("foryou", false);
  showView("home");
});
