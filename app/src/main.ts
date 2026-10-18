import { envelope, Player, Recorder } from "./audio";
import {
  addReaction, ago, findPost, isHeard, isLater, laterIds, loadFeed, markHeard, me, mostDiscussed, myPosts,
  myThreads, reactionCount, removeLater, repliesToMe, saveRecording, storedToPost, streams, toggleLater, unheardToMe,
  type Post, type Stored, type Stream,
} from "./feed";
import { playReaction, REACTIONS, type Reaction } from "./reactions";
import { LiveTranscript, speechSupported } from "./speech";
import { drawPortrait, joinEnvelopes } from "./thumbs";
import { N, PALETTES, Visual } from "./visual";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const pal = (p: Post) => PALETTES[p.palette % PALETTES.length];

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// =================== главный экран ===================

let stories: Post[] = [];
const seen = new Set<string>();

function renderHome() {
  stories = mostDiscussed(feed);
  const st = $("stories");
  st.innerHTML = "";
  stories.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "story" + (seen.has(p.id) ? " seen" : "");
    b.innerHTML = `
      <span class="story-ring"><canvas></canvas><b>${p.replies.length}</b></span>
      <span class="story-name">${escapeHtml(p.author)}</span>`;
    b.onclick = () => openStory(i);
    st.append(b);
    const cv = b.querySelector("canvas")!;
    const draw = () => drawPortrait(cv, p.env, pal(p), 1.2);
    draw();
    void ensureEnv(p).then(draw);
  });

  const list = $("streams");
  list.innerHTML = "";
  for (const s of streams(feed)) {
    const b = document.createElement("button");
    b.className = "stream";
    const n = s.posts.length;
    b.innerHTML = `
      <span class="stream-head">
        <span class="stream-title">${escapeHtml(s.title)}</span>
        <span class="stream-count">${n} ${plural(n, "голос", "голоса", "голосов")}</span>
      </span>
      <span class="stream-note">${escapeHtml(s.note)}</span>
      <canvas class="stream-strip"></canvas>`;
    b.onclick = () => openStream(s);
    list.append(b);
    const cv = b.querySelector("canvas")!;
    const draw = () => drawPortrait(cv, joinEnvelopes(s.posts.flatMap((p) => (p.env ? [p.env] : [])), 90), pal(s.posts[0]), 0.9);
    draw();
    void Promise.all(s.posts.map(ensureEnv)).then(draw);
  }
}

// =================== навигация ===================

type View = "home" | "mine";
let view: View = "home";

function showView(v: View) {
  view = v;
  player.el.pause();
  $("player").hidden = true;
  $("home").hidden = v !== "home";
  $("mine").hidden = v !== "mine";
  if (v === "home") renderHome();
  else renderMine();
  updateBadge();
  window.scrollTo(0, 0);
}

const goBack = () => showView(view);

function updateBadge() {
  const n = unheardToMe(feed).length;
  document.querySelectorAll<HTMLElement>("[data-badge]").forEach((b) => {
    b.hidden = n === 0;
    b.textContent = String(n);
  });
}

document.querySelectorAll<HTMLElement>("[data-go]").forEach((b) => (b.onclick = () => showView(b.dataset.go as View)));
document.querySelectorAll<HTMLElement>("[data-rec]").forEach((b) => (b.onclick = () => openRecorder(null)));

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
  const cv = r.querySelector("canvas")!;
  queueMicrotask(() => drawPortrait(cv, p.env, pal(p), 1.2));
  void ensureEnv(p).then(() => drawPortrait(cv, p.env, pal(p), 1.2));
  return r;
}

function chip(label: string, cls: string, onClick: () => void) {
  const b = document.createElement("button");
  b.className = `chip ${cls}`;
  b.textContent = label;
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

  const toMe = repliesToMe(feed);
  const fresh = toMe.filter((x) => !isHeard(x.reply.id));
  $("newCount").textContent = fresh.length ? `· ${fresh.length} ${plural(fresh.length, "новый", "новых", "новых")}` : "";
  $("playNew").hidden = !fresh.length;
  fill(
    "toMe",
    toMe.map(({ reply, root }) =>
      row(reply, reply.hook, `${reply.author} → «${root.hook}» · ${ago(reply.createdAt)}`, {
        isNew: !isHeard(reply.id),
        onOpen: () => openThreadAt(root, reply),
      }),
    ),
    "Пока тихо. Ответь кому-нибудь или запиши своё — ответы появятся здесь.",
  );

  const later = laterIds().flatMap((id) => findPost(feed, id) ?? []);
  fill(
    "later",
    later.map(({ post, root }) =>
      row(post, post.hook, `${post.author} · ${ago(post.createdAt)}`, {
        onOpen: () => openThreadAt(root, post),
        side: [
          chip("ответить", "", () => openRecorder(root)),
          chip("×", "x", () => {
            removeLater(post.id);
            renderMine();
          }),
        ],
      }),
    ),
    "Нажми «позже» во время прослушивания — запись подождёт тебя здесь.",
  );

  fill(
    "myPosts",
    myPosts(feed).map((p) =>
      row(p, p.hook, `${answers(p.replies.length)} · ${reactionCount(p)} ${plural(reactionCount(p), "реакция", "реакции", "реакций")} · ${ago(p.createdAt)}`, {
        onOpen: () => openThreadAt(p, p),
      }),
    ),
    "Своих записей пока нет. Красная кнопка внизу — до 30 секунд.",
  );

  fill(
    "myThreads",
    myThreads(feed).map((p) =>
      row(p, p.hook, `${p.author} · ${answers(p.replies.length)} · ${ago(p.createdAt)}`, {
        onOpen: () => openThreadAt(p, p),
      }),
    ),
    "Здесь будут обсуждения, в которых ты участвуешь.",
  );
}

$("playNew").onclick = () => {
  const fresh = unheardToMe(feed).reverse(); // от старых к новым — как шёл разговор
  openQueue(fresh.map((x) => ({ post: x.reply, parent: x.root })), "Новые ответы");
};

// =================== плеер ===================

type Item = { post: Post; parent: Post | null };
type Source = { kind: "story"; index: number } | { kind: "list" };

const player = new Player();
const visual = new Visual($<HTMLCanvasElement>("cv"), PALETTES[0]);
visual.setSource(player.level);

let items: Item[] = [];
let qi = 0;
let source: Source | null = null;
let rate = 1.25;
let showText = false;

const parentOf = (p: Post) => feed.find((f) => f.replies.includes(p)) ?? null;
const rootOf = (it: Item) => it.parent ?? it.post;

function openStory(index: number) {
  const p = stories[index];
  seen.add(p.id);
  source = { kind: "story", index };
  items = [{ post: p, parent: null }, ...p.replies.map((r) => ({ post: r, parent: p }))];
  $("queueTitle").textContent = `Обсуждают · ${index + 1}/${stories.length}`;
  openPlayer();
}

function openStream(s: Stream) {
  openQueue(s.posts.map((p) => ({ post: p, parent: parentOf(p) })), s.title);
}

// ветка целиком, начиная с нужной реплики
function openThreadAt(root: Post, from: Post) {
  const list = [{ post: root, parent: null }, ...root.replies.map((r) => ({ post: r, parent: root }))];
  openQueue(list, `Ветка · ${root.author}`, Math.max(0, list.findIndex((it) => it.post === from)));
}

function openQueue(list: Item[], title: string, start = 0) {
  if (!list.length) return;
  source = { kind: "list" };
  items = list;
  $("queueTitle").textContent = title;
  openPlayer(start);
}

function openPlayer(start = 0) {
  $("home").hidden = true;
  $("mine").hidden = true;
  $("player").hidden = false;
  void playAt(start);
}

async function playAt(i: number) {
  qi = Math.max(0, Math.min(i, items.length - 1));
  markHeard(items[qi].post.id);
  updateBadge();
  show();
  try {
    await player.play(items[qi].post.src, rate);
  } catch {
    // автозапуск заблокирован — ждём тап
  }
}

function show() {
  const { post: p, parent } = items[qi];
  $("now").textContent = parent ? "Ответ:" : "Сейчас:";
  $("author").textContent = p.author;
  $("ago").textContent = ago(p.createdAt);
  $("synth").hidden = !p.synthetic;
  $("hook").textContent = p.hook;
  $("transcript").textContent = p.text ?? "Расшифровка появится после обработки.";
  $("transcript").hidden = !showText;
  $("tags").classList.toggle("ref", !!parent);
  $("tags").textContent = parent ? `↳ на «${parent.hook}»` : p.tags.map((t) => `#${t}`).join("  ");
  $("thread").textContent = `ветка · ${rootOf(items[qi]).replies.length}`;
  $("laterBtn").textContent = isLater(p.id) ? "позже ✓" : "позже";
  $("laterBtn").classList.toggle("on", isLater(p.id));
  visual.setPalette(pal(p));
  visual.setPortrait(p.env ?? null);
  void ensureEnv(p).then(() => {
    if (items[qi]?.post === p) visual.setPortrait(p.env ?? null);
  });
  renderSegments();
  renderReactions();
}

function renderSegments() {
  $("segments").innerHTML = items.map((_, i) => `<span class="seg${i < qi ? " done" : ""}"><i></i></span>`).join("");
}

function next() {
  if (qi < items.length - 1) return playAt(qi + 1);
  // очередь кончилась: из сторис — к следующей сторис, из потока — домой
  if (source?.kind === "story" && source.index < stories.length - 1) return openStory(source.index + 1);
  goBack();
}

function prev() {
  if (player.el.currentTime > 2) {
    player.el.currentTime = 0;
    return;
  }
  if (qi > 0) return playAt(qi - 1);
  if (source?.kind === "story" && source.index > 0) return openStory(source.index - 1);
  player.el.currentTime = 0;
}

function toggle() {
  if (player.el.paused) void player.el.play().catch(() => playAt(qi));
  else player.el.pause();
}

// «ветка»: послушать обсуждение целиком прямо сейчас
function playThread() {
  const it = items[qi];
  const root = rootOf(it);
  if (!root.replies.length) return;
  const replies = root.replies.map((r) => ({ post: r, parent: root }));
  if (it.parent) items.splice(qi + 1, 0, { post: root, parent: null }, ...replies);
  else if (items[qi + 1]?.parent !== root) items.splice(qi + 1, 0, ...replies);
  void playAt(qi + 1);
}

player.el.addEventListener("play", sync);
player.el.addEventListener("pause", sync);
player.el.addEventListener("ended", () => setTimeout(() => !$("player").hidden && next(), 400));

function sync() {
  const on = !player.el.paused;
  $("play").classList.toggle("on", on);
  $("hint").classList.toggle("off", on || !!player.el.currentTime);
}

(function progress() {
  const d = player.el.duration;
  const prog = player.el.ended ? 1 : d ? player.el.currentTime / d : 0;
  const bar = $("segments").children[qi]?.firstElementChild as HTMLElement | undefined;
  if (bar) bar.style.width = `${prog * 100}%`;
  visual.setProgress(player.el.ended ? 0 : prog);
  requestAnimationFrame(progress);
})();

// реакции: звук идёт через анализатор плеера — графика вздрагивает
function renderReactions() {
  const p = items[qi].post;
  $("reactions").innerHTML = REACTIONS.map((r) => {
    const n = p.reactions[r] ?? 0;
    return `<button data-r="${r}"><span>${r}</span><small>${n || ""}</small></button>`;
  }).join("");
}

$("reactions").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  const r = b.dataset.r as Reaction;
  const p = items[qi].post;
  addReaction(p, r);
  playReaction(r, player.fx(1100));
  b.querySelector("small")!.textContent = String(p.reactions[r]);
  b.classList.remove("pop");
  void b.offsetWidth;
  b.classList.add("pop");
  float(r);
});

function float(r: string) {
  const s = document.createElement("span");
  s.className = "float";
  s.textContent = r;
  s.style.left = `${20 + Math.random() * 60}%`;
  $("floaters").append(s);
  setTimeout(() => s.remove(), 1600);
}

// тап — пауза, свайп — следующая/предыдущая
let downX = 0;
let downT = 0;
$("stage").addEventListener("pointerdown", (e) => {
  downX = e.clientX;
  downT = performance.now();
});
$("stage").addEventListener("pointerup", (e) => {
  const dx = e.clientX - downX;
  if (Math.abs(dx) > 50) void (dx < 0 ? next() : prev());
  else if (performance.now() - downT < 400) toggle();
});

$("play").onclick = toggle;
$("next").onclick = () => void next();
$("prev").onclick = () => void prev();
$("back").onclick = goBack;
$("laterBtn").onclick = () => {
  const on = toggleLater(items[qi].post.id);
  $("laterBtn").textContent = on ? "позже ✓" : "позже";
  $("laterBtn").classList.toggle("on", on);
  if (on) float("⏱");
};
$("thread").onclick = playThread;

$("speed").onclick = () => {
  rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
  player.el.playbackRate = rate;
  $("speed").textContent = `${rate}×`;
};

$("tr").onclick = () => {
  showText = !showText;
  $("tr").classList.toggle("on", showText);
  $("transcript").hidden = !showText;
};

document.addEventListener("keydown", (e) => {
  if (!$("recorder").hidden || $("player").hidden) return;
  if (e.code === "Space") (e.preventDefault(), toggle());
  if (e.code === "ArrowRight") void next();
  if (e.code === "ArrowLeft") void prev();
  if (e.code === "Escape") goBack();
});

// =================== запись ===================

const MIN_MS = 1_000;
const HOLD_MS = 350; // дольше — значит держат кнопку, отпускание завершает запись

const recorder = new Recorder();
const recVisual = new Visual($<HTMLCanvasElement>("cv2"), PALETTES[3]);
const preview = new Player();
const transcript = new LiveTranscript();
let replyTo: Post | null = null;
let maxMs = POST_MS;
let take: { blob: Blob; text: string; env: number[] } | null = null;
let previewUrl = "";
let pressedAt = 0;

recVisual.setSource(() => recorder.level() ?? preview.level());

function openRecorder(to: Post | null) {
  player.el.pause();
  replyTo = to;
  maxMs = to ? REPLY_MS : POST_MS;
  $("recTitle").innerHTML = to ? `<em>Ответ на:</em> ${escapeHtml(to.hook)}` : "<em>Новая запись</em>";
  recVisual.setPalette(to ? pal(to) : PALETTES[3], true);
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
}

function reset() {
  preview.el.pause();
  take = null;
  recVisual.setPortrait(null);
  recVisual.setProgress(0);
  setRecState("idle");
}

function setRecState(s: "idle" | "live" | "done", note?: string) {
  $("recBtn").classList.toggle("live", s === "live");
  $("recIdle").hidden = s === "done";
  $("recDone").hidden = s !== "done";
  const idle = `Нажми или удерживай. ${replyTo ? "Ответ" : "Запись"} — до ${maxMs / 1000} секунд.`;
  $("recNote").textContent =
    note ?? (s === "idle" ? idle : s === "live" ? "Говори. Нажми ещё раз — или отпусти." : "Послушай и опубликуй.");
  if (s === "idle") {
    setTimer(0);
    $("recText").textContent = speechSupported ? "" : "Расшифровка в этом браузере недоступна.";
  }
  $("listenBack").textContent = "прослушать";
}

function setTimer(ms: number) {
  const s = Math.min(maxMs / 1000, Math.floor(ms / 1000));
  $("timer").innerHTML = `0:${String(s).padStart(2, "0")} <span>/ 0:${maxMs / 1000}</span>`;
  $("timer").classList.toggle("warn", ms > maxMs - 5_000);
  // кольцо вокруг кнопки: длина окружности 2πr, r = 46 в координатах SVG
  const c = 2 * Math.PI * 46;
  $("ring").style.strokeDashoffset = String(c * (1 - Math.min(ms / maxMs, 1)));
  $("ring").style.opacity = ms > 0 ? "1" : "0"; // иначе скруглённый край рисует точку
}

async function startRec() {
  try {
    await recorder.start(maxMs, () => void stopRec());
  } catch {
    setRecState("idle", "Нет доступа к микрофону. Разреши его в настройках браузера.");
    return;
  }
  setRecState("live");
  transcript.start((t) => ($("recText").textContent = t));
  (function tick() {
    if (!recorder.active) return;
    setTimer(performance.now() - recorder.startedAt);
    requestAnimationFrame(tick);
  })();
}

async function stopRec() {
  if (!recorder.active) return;
  const dur = performance.now() - recorder.startedAt;
  transcript.stop();
  const blob = await recorder.stop();
  if (dur < MIN_MS) {
    reset();
    setRecState("idle", "Слишком коротко — скажи хотя бы пару слов.");
    return;
  }
  setTimer(dur);
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
preview.el.addEventListener("play", () => ($("listenBack").textContent = "пауза"));
preview.el.addEventListener("pause", () => ($("listenBack").textContent = "прослушать"));
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
    palette: replyTo ? replyTo.palette : Math.floor(Math.random() * PALETTES.length),
    replyTo: replyTo?.id,
    text: take.text || undefined,
    env: take.env.length ? take.env : undefined,
  };
  await saveRecording(stored);
  const post = storedToPost(stored);
  closeRecorder();

  if (replyTo) {
    const root = replyTo;
    root.replies.push(post);
    // ответил — запись и её реплики уходят из «ответить позже»
    for (const id of laterIds()) if (findPost(feed, id)?.root === root) removeLater(id);
    if (!$("player").hidden) {
      // если слушаем эту ветку — ответ встаёт в конец её очереди
      const last = items.map((it) => rootOf(it) === root).lastIndexOf(true);
      if (last >= 0) items.splice(last + 1, 0, { post, parent: root });
      show();
    } else showView(view);
  } else {
    feed.unshift(post);
    if ($("player").hidden) showView(view);
  }
};

$("reply").onclick = () => openRecorder(rootOf(items[qi]));
$("close").onclick = closeRecorder;

// =================== старт ===================

loadFeed().then((f) => {
  feed = f;
  showView("home");
});
