// Точка входа: шрифты, экраны, старт ленты, ярлыки иконки.

import "@fontsource/inter-tight/300.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/800.css";
import { $, toast } from "./ui";
import { addRemotePost, flushQueue, loadFeed, onSent, syncRemote } from "./feed";
import { onNewPost } from "./backend";
import { t } from "./i18n";
import { feed, field, setFeed } from "./state";
import { showView, updateBadge, view } from "./nav";
import { player, refreshAir, show, started, tuneRadio, visual } from "./air";
import { renderMine, setMineTab } from "./mine";
import { paintMe } from "./profile";
import { openRecorder, preview, recorder, recVisual } from "./recorder-ui";
import "./fan"; // веер реакций регистрирует свои обработчики при импорте
import { flipLook, look, onLook } from "./look";
import { plusGrid } from "./visual";
import { renderProfile } from "./profile";

// =================== корпус прибора ===================

// боковая кнопка на корпусе: светлый или тёмный экран
document.querySelectorAll<HTMLElement>("[data-flip]").forEach((b) => {
  b.setAttribute("aria-pressed", String(look === "light"));
  b.onclick = flipLook;
});
onLook(() => {
  document.querySelectorAll<HTMLElement>("[data-flip]").forEach((b) => b.setAttribute("aria-pressed", String(look === "light")));
  show();
  if (view === "mine") renderMine();
  if (view === "me") renderProfile();
  paintMe();
});

// печатная графика в шапках: ряд плюсов с одним крестиком
function paintPlus(cv: HTMLCanvasElement) {
  {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * d);
    const h = Math.round(cv.clientHeight * d);
    if (!w || !h) return;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d")!;
    plusGrid(ctx, 8 * d, h / 2, Math.floor((w - 8 * d) / (20 * d)) + 1, 1, 20 * d, 6 * d, "#2E2F2E", d, 0, 4);
  }
}
// рисуем, когда шапка становится видимой: у скрытого экрана нулевой размер
const plusRO = new ResizeObserver((es) => es.forEach((e) => paintPlus(e.target as HTMLCanvasElement)));
document.querySelectorAll<HTMLCanvasElement>("canvas[data-plus]").forEach((cv) => plusRO.observe(cv));

// часы в строке состояния экрана
function tickClock() {
  const now = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  document.querySelectorAll(".clock-now").forEach((el) => (el.textContent = now));
}
tickClock();
setInterval(tickClock, 15_000);

// =================== старт ===================

// моя аура — цвет кнопок, которыми говорю я: «ответить» и записать
paintMe();

// облако слушает то, что звучит: запись — мой голос улетает вдаль; эфир — голос автора летит на меня
field.source = () => {
  if (!$("recorder").hidden) return { level: recVisual.level, tone: recVisual.tone, out: true, idle: !recorder.active && preview.el.paused };
  if (view === "home" && started && !player.el.paused) return { level: visual.level, tone: visual.tone, out: false, idle: false };
  return { level: 0, out: false, idle: true };
};

// ярлыки из манифеста: долгое нажатие на иконку → «Записать» или «Ответы»
function openShortcut() {
  const go = new URLSearchParams(location.search).get("go");
  if (!go) return;
  history.replaceState(null, "", location.pathname);
  if (go === "record") openRecorder(null);
  else if (go === "replies") {
    setMineTab("toMe");
    showView("mine");
  }
}

// общий эфир подключается отдельно от первого экрана: не вышло — пробуем снова,
// пока не получится (5 с, 10 с … не реже раза в минуту), и сразу, как только вернулась сеть
let live = false;
let syncing = false;
let rendered = false;
let retryMs = 5000;
let retryTimer = 0;

async function sync() {
  if (live || syncing) return;
  syncing = true;
  clearTimeout(retryTimer);
  const ok = await syncRemote(feed).catch(() => false);
  syncing = false;
  if (!ok) {
    retryTimer = window.setTimeout(() => void sync(), retryMs);
    retryMs = Math.min(retryMs * 2, 60_000);
    return;
  }
  live = true;
  if (rendered) refresh();
  // живой эфир: чужие голоса появляются сразу; ответ на мою запись — всплывашка и бейдж
  onNewPost((r) => {
    const added = addRemotePost(feed, r);
    if (!added) return;
    if (added.root.mine && added.post !== added.root) toast(t("repliedToYou"));
    updateBadge();
    if (added.post === added.root) refreshAir(); // новый голос встаёт на шкалу, если она не занята
    else show(); // ответ: счётчик ветки и метка на волне
    if (view === "mine") renderMine();
  });
}

function refresh() {
  refreshAir();
  updateBadge();
  if (view === "mine") renderMine();
}

// связь вернулась или приложение снова на экране — подключаемся либо досылаем очередь
function wake() {
  if (live) return void flushQueue();
  retryMs = 5000;
  void sync();
}
addEventListener("online", wake);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && wake());

// запись ушла в эфир — пометка «не отправлено» на плитке гаснет
onSent(() => view === "mine" && renderMine());

loadFeed().then(async (f) => {
  setFeed(f);
  // эфир обычно успевает до первого экрана; медленную сеть не ждём дольше 5 с — он подтянется позже
  await Promise.race([sync(), new Promise((r) => setTimeout(r, 5000))]);
  tuneRadio("city", false);
  showView("home");
  rendered = true;
  openShortcut();
});
