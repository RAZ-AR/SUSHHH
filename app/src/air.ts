// Эфир: плеер, очередь, каналы, сторис, кольцо, жесты, панель и лист «⋯».

import { Player } from "./audio";
import { blockAuthor, deleteRecording, hidePost, isLater, markHeard, type Moment, mostDiscussed, type Post, report, type ReportReason, type Stream, streams, toggleLater, visible } from "./feed";
import { aura, auraGradient, paintAura } from "./aura";
import { lang, LANGS, setLang, t, tn } from "./i18n";
import { icon } from "./icons";
import { isSoundKey, soundByKey } from "./sounds";
import { drawRing } from "./thumbs";
import { Grille, type Mark, Visual } from "./visual";
import { audioSession, initMediaSession, setNowPlaying, setPlaybackState, setPosition } from "./pwa";
import { $, closeSheet, openSheet, pauseForSheet, type SheetRow, toast } from "./ui";
import { ensureEnv, feed, field, RATES, shown } from "./state";
import { showView, updateBadge, view, type View } from "./nav";
import { openMakeSound, react, renderReactionCounts } from "./fan";

// =================== эфир: очередь, каналы, сторис ===================

type Item = { post: Post; parent: Post | null };
// радио — бесконечный поток канала; сторис и списки — временная очередь с возвратом
type Mode = { kind: "radio" } | { kind: "story"; index: number } | { kind: "list"; back: View };

export const player = new Player();
export const visual = new Visual($<HTMLCanvasElement>("cv"));
visual.setSource(player.level);
// решётка динамика под экраном вспыхивает от того же звука
new Grille($<HTMLCanvasElement>("grille"), () => visual.level);

let channels: Stream[] = [];
let channelId = "foryou";
const radioPos = new Map<string, number>(); // где остановились в каждом канале
export let mode: Mode = { kind: "radio" };
export let items: Item[] = [];
let qi = 0;
export let rate = 1.25;
// скорость по кругу: 1 → 1,25 → 1,5
export function cycleRate() {
  rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
  player.el.playbackRate = rate;
  showRate();
}
let keyPlaying: boolean | null = null;
const mmss = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

// плашка под экраном: скорость, по нажатию — следующая
function showRate() {
  $("rateText").textContent = `×${rate.toLocaleString(lang)}`;
}
showRate();
$("rateBtn").onclick = () => cycleRate();
export let started = false; // браузер не даст играть звук до первого касания
let stories: Post[] = [];
const seen = new Set<string>();

const parentOf = (p: Post) => feed.find((f) => f.replies.includes(p)) ?? null;
export const rootOf = (it: Item) => it.parent ?? it.post;
export const cur = () => items[qi];

export function renderChannels() {
  channels = streams(shown(feed));
  $("chanName").textContent = channels.find((c) => c.id === channelId)?.title ?? t("air");
}

$("chanBtn").onclick = () =>
  openSheet(
    t("listenWhat"),
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

export function renderStories() {
  stories = mostDiscussed(shown(feed));
  const st = $("stories");
  st.innerHTML = "";
  stories.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "story" + (seen.has(p.id) ? " seen" : "");
    b.setAttribute("aria-label", `${p.author}, ${tn("replies", p.replies.length)}`);
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

export function tuneRadio(id: string, play: boolean) {
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

export function openQueue(list: Item[], start = 0, back: View = view) {
  if (!list.length) return;
  if (mode.kind === "radio") radioPos.set(channelId, qi);
  mode = { kind: "list", back };
  items = list;
  if (view !== "home") showView("home");
  setQueue(start, true);
}

export function openThreadAt(root: Post, from: Post, back: View = view) {
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
  $("back").setAttribute("aria-label", t(mode.kind === "list" && mode.back === "mine" ? "backMine" : "backHome"));
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
  const p = cur().post;
  // следующие голоса разбираем заранее: громкость готова до того, как они зазвучат
  for (let k = 1; k <= 2; k++) if (items.length > k) void ensureEnv(items[(qi + k) % items.length].post);
  void ensureEnv(p).then(() => cur()?.post === p && p.loud && player.setLoudness(p.loud));
  try {
    await player.play(p.src, rate, p.loud);
    started = true;
  } catch {
    // автозапуск заблокирован — ждём касания
  }
}

// направление смены записи: 1 — следующий голос снизу, -1 — предыдущий сверху
let swapDir = 0;

export function show() {
  const { post: p, parent } = cur();
  // аура говорящего: цвет за диском, дорожка времени; переход между аурами плавный (CSS @property)
  const a = aura(p.author);
  paintAura($("home"), a); // аура на весь экран: её видят и свечение, и волосок под диском
  visual.setAura(a);
  field.setAura(a);
  if (swapDir) {
    const st = $("stage");
    st.classList.remove("swap-next", "swap-prev");
    void st.offsetWidth;
    st.classList.add(swapDir > 0 ? "swap-next" : "swap-prev");
    swapDir = 0;
  }
  visual.setEnv(p.env);
  void ensureEnv(p).then(() => cur()?.post === p && visual.setEnv(p.env));
  $("hook").textContent = p.hook;
  $("hook").classList.remove("open");
  $("transcript").textContent = p.text ?? t("transcriptPending");
  $("transcript").hidden = true;
  $("live").textContent = `${p.author}: ${p.hook}`;
  setNowPlaying(p.hook, p.author, artFor(p.author));
  const n = shown(rootOf(cur()).replies).length;
  $("threadCount").textContent = n ? String(n) : "";
  $("laterBtn").classList.toggle("on", isLater(p.id));
  $("heartBtn").classList.remove("liked");
  $("heartBtn").querySelector(".ico")!.outerHTML = icon("heart");
  renderReactionCounts();
  visual.setMarks(marksFor(p, !parent));
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
  if (!replies.length) return toast(t("noReplies"));
  openThreadAt(root, it.parent ? it.post : replies[0], view);
}

player.el.addEventListener("ended", () => setTimeout(() => !$("home").hidden && next(), 400));

// =================== экран блокировки и гарнитура ===================

// обложка для экрана блокировки — персонаж автора; рисуется один раз на автора
const art = new Map<string, string>();
function artFor(author: string) {
  let url = art.get(author);
  if (!url) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 512;
    drawRing(cv, undefined, aura(author));
    url = cv.toDataURL("image/png");
    art.set(author, url);
  }
  return url;
}

initMediaSession({
  play: () => player.el.paused && toggle(),
  pause: () => player.el.pause(),
  next: () => void next(),
  prev: () => void prev(),
  seek: (sec) => (player.el.currentTime = sec),
});
player.el.addEventListener("play", () => setPlaybackState("playing"));
player.el.addEventListener("pause", () => setPlaybackState("paused"));
player.el.addEventListener("timeupdate", () => setPosition(player.el.duration, player.el.currentTime, player.el.playbackRate));
audioSession("playback");

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
  // экран прибора: большое время, длительность, номер голоса в очереди
  $("timeNow").textContent = mmss(el.ended ? 0 : el.currentTime);
  $("timeDur").textContent = d ? `/ ${mmss(d)}` : "";
  $("voiceNo").textContent = `${qi + 1} / ${items.length}`;
  const playing = !el.paused && !el.ended;
  if (playing !== keyPlaying) {
    keyPlaying = playing;
    $("playWord").textContent = t(playing ? "pauseCaps" : "playCaps");
    $("playKey").querySelector(".ico")!.outerHTML = icon(playing ? "pause" : "play");
    $("playKey").setAttribute("aria-label", t(playing ? "pause" : "startAria"));
  }
})();

// цвет за диском: размер — по кольцу, пульс — по громкости, вращение быстрее, когда говорят,
// в тишине — медленное дыхание. При «уменьшении движения» цвет не вращается.
export const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const spin = new WeakMap<HTMLElement, number>();

export function glow(stage: HTMLElement, v: Visual) {
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

export const progressNow = () => {
  const d = player.el.duration;
  return d && isFinite(d) ? Math.min(1, player.el.currentTime / d) : 0;
};

// ответы — тёмный «↳» на своём моменте; реакции — «😂 8», группами по 6% записи
export function marksFor(p: Post, isRoot: boolean): Mark[] {
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
$("playKey").onclick = () => (started ? toggle() : void playAt(qi));
$("nextKey").onclick = () => void next();
$("startBtn").onclick = (e) => {
  e.stopPropagation();
  void playAt(qi);
};
$("startBtn").addEventListener("pointerdown", (e) => e.stopPropagation());
$("startBtn").addEventListener("pointerup", (e) => e.stopPropagation());
$("laterBtn").onclick = () => {
  const on = toggleLater(cur().post.id);
  $("laterBtn").classList.toggle("on", on);
  toast(t(on ? "savedLater" : "removedLater"));
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
  if (e.code === "Space") {
    e.preventDefault();
    toggle();
  }
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

const REASONS: ReportReason[] = ["abuse", "danger", "sexual", "personal", "spam", "crisis", "other"];

function openReport(p: Post) {
  openSheet(
    t("reportTitle"),
    "",
    REASONS.map((r) => ({
      icon: r === "crisis" ? "heart" : "flag",
      label: t(`reason.${r}`),
      onClick: () => {
        report(p.id, r);
        if (r === "crisis") {
          openSheet(
            t("thanks"),
            t("crisisNote"),
            [{ icon: "check", label: t("gotIt"), onClick: () => (closeSheet(false), dropHidden()) }],
          );
          return;
        }
        closeSheet(false);
        toast(t("reported"));
        dropHidden();
      },
    })),
    t("reportNote"),
  );
}

function confirmBlock(p: Post) {
  openSheet(t("blockTitle", { name: p.author }), t("blockSub"), [
    {
      icon: "ban",
      label: t("block"),
      danger: true,
      onClick: () => {
        blockAuthor(p.author);
        closeSheet(false);
        toast(t("blocked", { name: p.author }));
        dropHidden();
      },
    },
  ]);
}

function confirmDelete(p: Post) {
  openSheet(t("deleteTitle"), t("deleteSub"), [
    {
      icon: "trash",
      label: t("deleteForever"),
      danger: true,
      onClick: async () => {
        await deleteRecording(p.id);
        closeSheet(false);
        toast(t("deleted"));
        dropHidden();
      },
    },
  ]);
}

export function openLanguages() {
  openSheet(
    t("language"),
    "",
    LANGS.map((l) => ({ icon: l.id === lang ? "check" : "globe", label: l.name, on: l.id === lang, onClick: () => setLang(l.id) })),
  );
}

$("moreBtn").onclick = () => {
  const { post: p } = cur();
  pauseForSheet(player.el);
  const speedRow: SheetRow = {
    icon: "speed",
    label: t("speed", { x: rate.toLocaleString(lang) }),
    onClick: () => {
      cycleRate();
      closeSheet();
      toast(t("speed", { x: rate.toLocaleString(lang) }));
    },
  };
  const soundRow: SheetRow = { icon: "scissors", label: t("makeSound"), onClick: () => void openMakeSound(p) };
  const langRow: SheetRow = { icon: "globe", label: `${t("language")} · ${LANGS.find((l) => l.id === lang)!.name}`, onClick: openLanguages };
  if (p.mine) {
    openSheet(p.author, "", [speedRow, soundRow, langRow, { icon: "trash", label: t("deletePost"), danger: true, onClick: () => confirmDelete(p) }]);
    return;
  }
  openSheet(p.author, "", [
    speedRow,
    soundRow,
    langRow,
    { icon: "flag", label: t("report"), onClick: () => openReport(p) },
    {
      icon: "hide",
      label: t("hide"),
      onClick: () => {
        hidePost(p.id);
        closeSheet(false);
        toast(t("hidden"));
        dropHidden();
      },
    },
    { icon: "ban", label: t("blockNamed", { name: p.author }), danger: true, onClick: () => confirmBlock(p) },
  ]);
};
