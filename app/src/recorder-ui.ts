// Экран записи: микрофон, шумодав, автостоп, прослушать, отправить; обновление приложения ждёт конца записи.

import { envelope, Player, Recorder, warmDenoiser } from "./audio";
import { findPost, laterIds, me, type Post, removeLater, publishRecording, saveRecording, type Stored, storedToPost } from "./feed";
import { aura, paintAura } from "./aura";
import { t } from "./i18n";
import { icon } from "./icons";
import { LiveTranscript } from "./speech";
import { N, Visual } from "./visual";
import { audioSession, initServiceWorker, keepAwake } from "./pwa";
import { $, clock, escapeHtml, openSheet, toast } from "./ui";
import { feed, field, POST_MS, REPLY_MS } from "./state";
import { view } from "./nav";
import { cur, glow, items, mode, player, progressNow, renderChannels, renderStories, rootOf, show } from "./air";
import { renderMine } from "./mine";

// =================== запись ===================

const MIN_MS = 1_000;
const VOICE_LEVEL = 0.08; // уровень визуала, выше которого считаем, что человек говорит
const SILENCE_STOP_MS = 3_000;
const HOLD_MS = 350; // дольше — значит держат кнопку, отпускание завершает запись

export const recorder = new Recorder();
export const recVisual = new Visual($<HTMLCanvasElement>("cv2"));
export const preview = new Player();
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
export function openRecorder(to: Post | null, at?: number) {
  resumeAfter = !player.el.paused && view === "home";
  player.el.pause();
  replyTo = to;
  replyAt = to ? at : undefined;
  maxMs = to ? REPLY_MS : POST_MS;
  const mine = aura(me());
  paintAura($("recStage"), mine);
  recVisual.setAura(mine);
  field.setAura(mine);
  $("recWhat").innerHTML = to ? `${icon("reply")}${escapeHtml(to.author)}` : `${icon("mic")}${t("upTo", { n: POST_MS / 1000 })}`;
  reset();
  $("recorder").hidden = false;
  void warmDenoiser()?.catch(() => {}); // шумодав грузится, пока человек собирается с мыслями
}

function closeRecorder() {
  if (recorder.active) {
    transcript.stop();
    void recorder.stop();
  }
  micOff();
  preview.el.pause();
  $("recorder").hidden = true;
  if (resumeAfter) void player.el.play().catch(() => {});
  if (pendingUpdate) offerUpdate(pendingUpdate);
}

// во время записи: экран не гаснет, iOS держит микрофон и динамик вместе
function micOn() {
  audioSession("play-and-record");
  void keepAwake(true);
}
function micOff() {
  void keepAwake(false);
  audioSession("playback");
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
  btn.setAttribute("aria-label", t(s === "live" ? "stopRec" : "startRec"));
  setIcon(btn, s === "live" ? "stop" : "mic");
  $("recIdle").hidden = s === "done";
  $("recDone").hidden = s !== "done";
  $("recNote").textContent =
    note ?? (s === "idle" ? t("recHint") : s === "done" ? t(replyTo ? "recReplyHeard" : "recOnAir") : "");
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
  $("recTime").textContent = recState === "live" && total - sec <= 5 ? `${clock(sec)} · ${t("recLeft", { n: total - sec })}` : clock(sec);
  $("recHairFill").style.width = recState === "live" ? `${Math.min(1, ms / maxMs) * 100}%` : "0%";
}

async function startRec() {
  micOn();
  try {
    await recorder.start(maxMs, () => void stopRec());
  } catch {
    micOff();
    setRecState("idle", t("needMic"));
    return;
  }
  setRecState("live");
  transcript.start((t) => ($("recText").textContent = t));
  // замолчал после того, как начал говорить, — запись заканчивается сама
  let spoke = false;
  let lastVoice = performance.now();
  (function tick() {
    if (!recorder.active) return;
    const now = performance.now();
    if (recState === "live") setTimer(now - recorder.startedAt);
    if ((recorder.level()?.level ?? 0) > VOICE_LEVEL) {
      spoke = true;
      lastVoice = now;
    } else if (spoke && now - lastVoice > SILENCE_STOP_MS) return void stopRec();
    requestAnimationFrame(tick);
  })();
}

async function stopRec() {
  if (!recorder.active) return;
  const dur = performance.now() - recorder.startedAt;
  transcript.stop();
  const blob = await recorder.stop();
  micOff();
  recVisual.setProgress(0);
  if (dur < MIN_MS) {
    reset();
    setRecState("idle", t("tooShort"));
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
  if (!$("recorder").hidden) {
    glow($("recStage"), recVisual);
    // слушает, пока ты говоришь или пока звучит дубль; иначе дремлет
    $("recOrb").classList.toggle("sleep", !recorder.active && preview.el.paused);
  }
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
  void publishRecording(stored); // в общий эфир; без сети уйдёт при следующем запуске
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
  toast(t(wasReply ? "replySent" : "onAirNow"));
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

// =================== обновления и ярлыки иконки ===================

// новая версия не перезагружает приложение посреди записи: ждём, пока рекордер закроется
let pendingUpdate: (() => void) | null = null;
function offerUpdate(apply: () => void) {
  if (!$("recorder").hidden) {
    pendingUpdate = apply;
    return;
  }
  pendingUpdate = null;
  openSheet(t("updateReady"), "", [{ icon: "rotate", label: t("update"), onClick: apply }]);
}
initServiceWorker(offerUpdate, () => toast(t("offlineReady")));
