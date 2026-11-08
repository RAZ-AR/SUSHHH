// PWA: обновления, установка, экран блокировки, бейдж, экран без сна, аудиосессия iOS.
// Всё — прогрессивно: где API нет, функция молча ничего не делает.

import { registerSW } from "virtual:pwa-register";

type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
type Nav = Navigator & {
  audioSession?: { type: AudioSessionType };
  standalone?: boolean;
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};
const nav = navigator as Nav;

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
export const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// --- service worker: новая версия ставится только с согласия, чтобы не оборвать запись ---

export function initServiceWorker(onNeedRefresh: (apply: () => void) => void, onOfflineReady: () => void) {
  if (!("serviceWorker" in navigator)) return;
  const update = registerSW({
    onNeedRefresh: () => onNeedRefresh(() => void update(true)),
    onOfflineReady,
    onRegisteredSW(_url, reg) {
      // проверять обновление раз в час, пока приложение открыто
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  // установленному приложению браузер не стирает черновики и кэш голосов
  if (isStandalone()) void navigator.storage?.persist?.();
}

// --- установка ---

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // своя кнопка в кабинете вместо баннера браузера
  deferred = e as InstallEvent;
  listeners.forEach((f) => f());
});
addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((f) => f());
});

export const onInstallChange = (f: () => void) => listeners.add(f);

// "prompt" — Chrome/Android покажут системный диалог; "ios" — нужна подсказка «Поделиться»
export function installKind(): "prompt" | "ios" | null {
  if (isStandalone()) return null;
  if (deferred) return "prompt";
  return isIos ? "ios" : null;
}

export async function install() {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  await d.prompt();
  return (await d.userChoice).outcome === "accepted";
}

// --- экран блокировки, гарнитура, часы, машина ---

export type MediaControls = { play(): void; pause(): void; next(): void; prev(): void; seek(sec: number): void };

export function initMediaSession(c: MediaControls) {
  const ms = navigator.mediaSession;
  if (!ms) return;
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      // действие не поддерживается этим браузером
    }
  };
  set("play", () => c.play());
  set("pause", () => c.pause());
  set("nexttrack", () => c.next());
  set("previoustrack", () => c.prev());
  set("seekto", (d) => d.seekTime != null && c.seek(d.seekTime));
}

// обложка — кольцо голоса автора, нарисованное в PNG
export function setNowPlaying(title: string, artist: string, artwork?: string) {
  const ms = navigator.mediaSession;
  if (!ms || typeof MediaMetadata === "undefined") return;
  ms.metadata = new MediaMetadata({
    title,
    artist,
    album: "SUSHHH",
    artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/png" }] : [{ src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }],
  });
}

export function setPlaybackState(state: MediaSessionPlaybackState) {
  if (navigator.mediaSession) navigator.mediaSession.playbackState = state;
}

export function setPosition(duration: number, position: number, rate: number) {
  const ms = navigator.mediaSession;
  if (!ms?.setPositionState || !isFinite(duration) || duration <= 0) return;
  try {
    ms.setPositionState({ duration, position: Math.min(position, duration), playbackRate: rate });
  } catch {
    // некорректная позиция на границе записи — пропускаем
  }
}

// --- аудиосессия iOS: звук слышен и при переключателе «Без звука» ---

export function audioSession(type: "playback" | "play-and-record") {
  if (nav.audioSession) nav.audioSession.type = type;
}

// --- число новых ответов на иконке ---

export function setBadge(n: number) {
  if (n > 0) void nav.setAppBadge?.(n).catch(() => {});
  else void nav.clearAppBadge?.().catch(() => {});
}

// --- экран не гаснет, пока идёт запись ---

let lock: WakeLockSentinel | null = null;
let wantLock = false;

export async function keepAwake(on: boolean) {
  wantLock = on;
  if (!on) {
    void lock?.release().catch(() => {});
    lock = null;
    return;
  }
  if (!("wakeLock" in navigator) || lock) return;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => (lock = null));
  } catch {
    // нет разрешения или экономия батареи — запись идёт и так
  }
}
// браузер снимает блокировку, когда вкладка уходит в фон: вернувшись — берём снова
document.addEventListener("visibilitychange", () => {
  if (wantLock && document.visibilityState === "visible") void keepAwake(true);
});
