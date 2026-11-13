// Уведомления «Тебе ответили голосом», когда приложение закрыто (Web Push).
// На iPhone они работают только у приложения, добавленного на экран «Домой» (iOS 16.4+), и разрешение
// можно спросить только по касанию. Поэтому включаются кнопкой в «Моё», а не сами при запуске.

import { dropPush, savePush } from "../src/backend";
import { VAPID_PUBLIC_KEY } from "../src/config";
import { lang } from "./i18n";

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function current() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState(): Promise<PushState> {
  if (isIos && !standalone()) return "install"; // в Safari-вкладке iPhone уведомлений нет — только с экрана «Домой»
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unsupported"; // service worker не установлен (например, при разработке)
  return (await current().catch(() => null)) ? "on" : "off";
}

// ключ VAPID — из base64url в байты, как его просит pushManager
function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

// включить: спросить разрешение (только по касанию), подписаться и сохранить подписку на сервере
export async function enablePush(): Promise<PushState> {
  if ((await Notification.requestPermission()) !== "granted") return pushState();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  if (!(await savePush(sub.toJSON(), lang))) {
    await sub.unsubscribe().catch(() => {}); // сервер не принял — не делаем вид, что включено
    throw new Error("push: not saved");
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const sub = await current().catch(() => null);
  if (sub) {
    await dropPush(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return pushState();
}
