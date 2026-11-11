// Эфир: плеер, очередь, диапазоны и шкала, экран, жесты, панель и лист «⋯».

import { Player } from "./audio";
import { type Band, bandPosts, blockAuthor, deleteRecording, hidePost, isLater, isRumor, markHeard, type Moment, type Post, reactionCount, report, type ReportReason, RUMOR_NO, RUMOR_YES, rumorHoursLeft, rumorVotes, savedAuthors, signalOf, toggleLater, visible } from "./feed";
import { aura, voiceColor, voiceCross } from "./aura";
import { click, initDial, searching, setIndex, setStations, travel } from "./dial";
import { lang, LANGS, setLang, t } from "./i18n";
import { icon } from "./icons";
import { isSoundKey, soundByKey } from "./sounds";
import { drawRing } from "./thumbs";
import { Grille, type Mark, Visual } from "./visual";
import { audioSession, initMediaSession, setNowPlaying, setPlaybackState, setPosition } from "./pwa";
import { $, closeSheet, openSheet, pauseForSheet, type SheetRow, toast } from "./ui";
import { ensureEnv, feed, field, RATES, shown } from "./state";
import { showView, updateBadge, view, type View } from "./nav";
import { openMakeSound, react } from "./fan";
import { hallOn, hallTick, renderPads, setHall } from "./pads";

// =================== эфир: очередь, диапазоны, шкала ===================

type Item = { post: Post; parent: Post | null };
// радио — бесконечный поток диапазона; списки (ветка, «Моё») — временная очередь с возвратом
type Mode = { kind: "radio" } | { kind: "list"; back: View };

export const player = new Player();
export const visual = new Visual($<HTMLCanvasElement>("cv"));
visual.setSource(player.level);
// решётка динамика под экраном вспыхивает от того же звука
new Grille($<HTMLCanvasElement>("grille"), () => visual.level);

export let band: Band = "city";
const radioPos = new Map<Band, number>(); // где остановились в каждом диапазоне
export let mode: Mode = { kind: "radio" };
export let items: Item[] = [];
let qi = 0;
export let rate = 1.25;
// скорость по кругу: 1 → 1,25 → 1,5
export function cycleRate() {
  rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
  player.el.playbackRate = rate;
}
let keyPlaying: boolean | null = null;
const mmss = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
export let started = false; // браузер не даст играть звук до первого касания

const parentOf = (p: Post) => feed.find((f) => f.replies.includes(p)) ?? null;
export const rootOf = (it: Item) => it.parent ?? it.post;
export const cur = (): Item | undefined => items[qi];

// переключатель диапазонов: в очереди ни один не выбран
function paintBands() {
  document.querySelectorAll<HTMLElement>("[data-band]").forEach((b) => {
    const on = mode.kind === "radio" && b.dataset.band === band;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  $("playSub").textContent = mode.kind === "radio" ? `${t(`band.${band}`)} · ${items.length}` : "";
}
document.querySelectorAll<HTMLElement>("[data-band]").forEach((b) => {
  b.onclick = () => {
    click(0.1);
    tuneRadio(b.dataset.band as Band, true);
  };
});

// at — с какого голоса начать; без него — где остановились в этом диапазоне
export function tuneRadio(id: Band, play: boolean, at?: number) {
  if (mode.kind === "radio") radioPos.set(band, qi);
  band = id;
  mode = { kind: "radio" };
  items = bandPosts(shown(feed), id, savedAuthors())
    .map((p) => ({ post: p, parent: parentOf(p) }))
    .filter((it) => !it.parent || visible(it.parent));
  setQueue(at ?? radioPos.get(id) ?? 0, play);
}

// лента изменилась под нами (эфир подключился позже): очередь пересобираем,
// только пока ничего не играет, — звучащий голос не обрываем
export function refreshAir() {
  if (!started && mode.kind === "radio") tuneRadio(band, false);
}

// клавиша памяти: диапазон «свои», стрелка — на свежей записи этого голоса
export function tuneToAuthor(name: string) {
  const at = bandPosts(shown(feed), "own", savedAuthors()).findIndex((p) => p.author === name);
  if (at < 0) return false;
  tuneRadio("own", true, at);
  return true;
}

export function openQueue(list: Item[], start = 0, back: View = view) {
  if (!list.length) return;
  if (mode.kind === "radio") radioPos.set(band, qi);
  mode = { kind: "list", back };
  items = list;
  if (view !== "home") showView("home");
  setQueue(start, true);
}

export function openThreadAt(root: Post, from: Post, back: View = view) {
  const list = [{ post: root, parent: null }, ...shown(root.replies).map((r) => ({ post: r, parent: root }))];
  openQueue(list, Math.max(0, list.findIndex((it) => it.post === from)), back);
}

// выйти из ветки обратно: в радио или в «Моё»
function leaveQueue() {
  const back = mode.kind === "list" ? mode.back : "home";
  if (back === "mine") {
    player.el.pause();
    tuneRadio(band, false);
    showView("mine");
  } else tuneRadio(band, started);
}
$("back").onclick = leaveQueue;

function setQueue(start: number, play: boolean) {
  const inQueue = mode.kind !== "radio";
  $("context").hidden = !inQueue;
  $("bands").hidden = inQueue;
  $("back").setAttribute("aria-label", t(mode.kind === "list" && mode.back === "mine" ? "backMine" : "backHome"));
  qi = Math.max(0, Math.min(start, items.length - 1));
  paintBands();
  setStations(items.map((it) => ({ name: it.post.author, src: it.post.src, reply: !!it.parent })), qi);
  visual.setSearching(false);
  if (play && started && items.length) void playAt(qi);
  else {
    player.el.pause();
    player.el.removeAttribute("src");
    show();
  }
}

// шкала: пока ведут — основной звук молчит, экран показывает голос под стрелкой
initDial({
  out: () => player.fx(400),
  onSearch: () => {
    player.el.pause();
    visual.setSearching(true);
  },
  onNear: (i) => {
    qi = i;
    show();
  },
  onTune: (i) => {
    visual.setSearching(false);
    void playAt(i);
  },
  onStep: (d) => void (d > 0 ? next() : prev()),
});

async function playAt(i: number) {
  if (!items.length) return; // диапазон пуст или лента ещё грузится
  qi = (i + items.length) % items.length;
  setIndex(qi);
  visual.setSearching(false);
  const p = items[qi].post;
  markHeard(p.id);
  updateBadge();
  show();
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

// направление смены записи: 1 — следующий голос, -1 — предыдущий
let swapDir = 0;
// докуда был слышен голос, когда его показали: вырос после моей реакции — сообщаем
let shownSignal: { post: Post; radius: number } | null = null;

export function show() {
  renderPads();
  const it = cur();
  if (!it) return showEmpty();
  const { post: p, parent } = it;
  // личный знак говорящего: цвет лампочки у имени и место крестика в сетке плюсов
  const hue = voiceColor(p.author);
  $("stage").style.setProperty("--hue", hue);
  visual.setSign(voiceCross(p.author), hue);
  field.setAura(aura(p.author));
  if (swapDir) {
    const st = $("stage");
    st.classList.remove("swap-next", "swap-prev");
    void st.offsetWidth;
    st.classList.add(swapDir > 0 ? "swap-next" : "swap-prev");
    swapDir = 0;
  }
  visual.setEnv(p.env);
  void ensureEnv(p).then(() => cur()?.post === p && visual.setEnv(p.env));
  $("who").textContent = parent ? `↳ ${p.author}` : p.author;
  $("hook").textContent = p.hook;
  $("hook").classList.remove("open");
  $("transcript").textContent = p.text ?? t("transcriptPending");
  $("transcript").hidden = true;
  $("live").textContent = `${p.author}: ${p.hook}`;
  setNowPlaying(p.hook, p.author, artFor(p.author));
  const n = shown(rootOf(it).replies).length;
  $("threadCount").textContent = n ? String(n) : "";
  shownSignal = null;
  paintSignal();
  visual.setMarks(marksFor(p, !parent));
  // ряд светодиодов очереди: пройденные, текущий, впереди
  $("segments").innerHTML =
    mode.kind === "radio" ? "" : items.map((_, i) => `<span class="seg${i < qi ? " done" : i === qi ? " now" : ""}"><i></i></span>`).join("");
  $("fan").hidden = true;
}

// диапазон пуст: экран говорит, как его наполнить
function showEmpty() {
  $("stage").style.removeProperty("--hue");
  visual.setSign(-1, "");
  visual.setEnv(null);
  visual.setMarks([]);
  visual.setProgress(0);
  $("who").textContent = t("dialEmptyCaps");
  $("hook").textContent = t(`empty.${band}`);
  $("transcript").hidden = true;
  $("live").textContent = t(`empty.${band}`);
  $("threadCount").textContent = "";
  $("radius").textContent = $("rumorTag").textContent = $("sigExtra").textContent = $("time").textContent = $("voiceNo").textContent = "";
  $("bars").querySelectorAll("i").forEach((b) => b.classList.remove("on"));
  $("hairFill").style.width = "0%";
  $("segments").innerHTML = "";
  $("fan").hidden = true;
}

// сигнал записи: деления, докуда слышно, ответы и реакции; у слуха — срок жизни и счёт «верю / не верю»
export function paintSignal() {
  const it = cur();
  if (!it) return;
  const root = rootOf(it);
  const s = signalOf(root);
  const bars = $("bars");
  bars.querySelectorAll("i").forEach((b, i) => b.classList.toggle("on", i < s.bars));
  // у слуха вместо «докуда слышно» — срок жизни: строка не резиновая
  $("radius").textContent = isRumor(root) ? "" : t(`radius.${s.radius}`);
  if (isRumor(root)) {
    const v = rumorVotes(root);
    $("rumorTag").textContent = t("rumorLeftCaps", { n: rumorHoursLeft(root) });
    $("sigExtra").textContent = `${RUMOR_YES}${v.yes} ${RUMOR_NO}${v.no}`;
  } else {
    $("rumorTag").textContent = "";
    $("sigExtra").textContent = `↳ ${shown(root.replies).length} · ♥ ${reactionCount(root)}`;
  }
  if (shownSignal?.post === root && s.radius > shownSignal.radius) {
    bars.classList.remove("up");
    void bars.offsetWidth;
    bars.classList.add("up");
    toast(t("signalUp", { where: t(`radius.${s.radius}`) }));
  }
  shownSignal = { post: root, radius: s.radius };
}

// доехать до голоса по шкале и сыграть; в фоне и до первого касания — без поездки
function go(i: number) {
  if (!started || document.hidden) return void playAt(i);
  travel(i);
}

function next() {
  if (!items.length) return;
  swapDir = 1;
  if (mode.kind === "radio" || qi < items.length - 1) return go(qi + 1); // радио не кончается: по кругу
  leaveQueue();
}

function prev() {
  if (!items.length) return;
  swapDir = -1;
  if (player.el.currentTime > 2) {
    swapDir = 0;
    player.el.currentTime = 0;
    return;
  }
  if (qi > 0 || mode.kind === "radio") return go(qi - 1);
  player.el.currentTime = 0;
}

function toggle() {
  if (!cur()) return;
  if (player.el.paused) {
    if (player.el.getAttribute("src")) void player.el.play().then(() => (started = true)).catch(() => playAt(qi));
    else void playAt(qi);
  } else player.el.pause();
}

function playThread() {
  const it = cur();
  if (!it) return;
  const root = rootOf(it);
  const replies = shown(root.replies);
  if (!replies.length) return toast(t("noReplies"));
  openThreadAt(root, it.parent ? it.post : replies[0], view);
}

player.el.addEventListener("ended", () => setTimeout(() => !$("home").hidden && !searching() && next(), 200));

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

  $("hairFill").style.width = `${(el.ended ? 0 : prog) * 100}%`;
  $("hair").setAttribute("aria-valuenow", String(Math.round(prog * 100)));
  $("startBtn").hidden = started;
  // строка состояния: поиск по шкале или эфир, зал, номер голоса; время — мелко, у сигнала
  $("airState").textContent = t(searching() ? "searchCaps" : "onAirCaps");
  $("hallTag").textContent = hallOn() ? t("hallOnCaps") : "";
  $("time").textContent = searching() || !d ? "" : `${mmss(el.ended ? 0 : el.currentTime)} / ${mmss(d)}`;
  $("voiceNo").textContent = `${qi + 1} / ${items.length}`;
  const playing = !el.paused && !el.ended;
  // зал: чужие реакции тихо звучат там, где их поставили
  if (playing) hallTick(cur()!.post, prog);
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
$("startBtn").onclick = (e) => {
  e.stopPropagation();
  void playAt(qi);
};
$("startBtn").addEventListener("pointerdown", (e) => e.stopPropagation());
$("startBtn").addEventListener("pointerup", (e) => e.stopPropagation());
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
  updateBadge();
  if (!items.length) {
    if (mode.kind === "radio") tuneRadio(band, started);
    else leaveQueue();
    return;
  }
  setQueue(nextIndex % items.length, true);
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
  // зал: слышать ли, как реагируют другие
  const hallRow: SheetRow = {
    icon: "wave",
    label: t(hallOn() ? "hallRowOn" : "hallRowOff"),
    on: hallOn(),
    onClick: () => {
      setHall(!hallOn());
      closeSheet();
      toast(t(hallOn() ? "hallRowOn" : "hallRowOff"));
    },
  };
  const langRow: SheetRow = { icon: "globe", label: `${t("language")} · ${LANGS.find((l) => l.id === lang)!.name}`, onClick: openLanguages };
  const it = cur();
  if (!it) return openSheet(t("air"), "", [speedRow, hallRow, langRow]);
  const p = it.post;
  const laterRow: SheetRow = {
    icon: "clock",
    label: t(isLater(p.id) ? "laterRowOff" : "laterAria"),
    on: isLater(p.id),
    onClick: () => {
      const on = toggleLater(p.id);
      closeSheet();
      toast(t(on ? "savedLater" : "removedLater"));
    },
  };
  // мемы и звуки сообщества — веер над клавишами
  const fanRow: SheetRow = {
    icon: "smile",
    label: t("moreSounds"),
    onClick: () => {
      closeSheet();
      $("fan").hidden = false;
    },
  };
  const soundRow: SheetRow = { icon: "scissors", label: t("makeSound"), onClick: () => void openMakeSound(p) };
  if (p.mine) {
    openSheet(p.author, "", [laterRow, fanRow, soundRow, speedRow, hallRow, langRow, { icon: "trash", label: t("deletePost"), danger: true, onClick: () => confirmDelete(p) }]);
    return;
  }
  openSheet(p.author, "", [
    laterRow,
    fanRow,
    soundRow,
    speedRow,
    hallRow,
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
