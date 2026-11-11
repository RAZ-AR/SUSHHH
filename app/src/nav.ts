// Навигация между экранами и счётчик новых ответов.

import { $ } from "./ui";
import { requestsForMe } from "./sounds";
import { setBadge } from "./pwa";
import { freshToMe, myIds } from "./state";
import { player } from "./air";
import { renderMine } from "./mine";
import { renderProfile } from "./profile";
import { openRecorder } from "./recorder-ui";

// =================== навигация ===================

export type View = "home" | "mine" | "me";
export let view: View = "home";

export function showView(v: View) {
  view = v;
  $("home").hidden = v !== "home";
  $("mine").hidden = v !== "mine";
  $("me").hidden = v !== "me";
  if (v === "mine") {
    player.el.pause();
    renderMine();
  } else if (v === "me") {
    player.el.pause();
    renderProfile();
  }
  updateBadge();
}

document.querySelectorAll<HTMLElement>("[data-go]").forEach((b) => (b.onclick = () => showView(b.dataset.go as View)));
document.querySelectorAll<HTMLElement>("[data-rec]").forEach((b) => (b.onclick = () => openRecorder(null)));

export function updateBadge() {
  const n = freshToMe().length + requestsForMe(myIds()).length;
  document.querySelectorAll<HTMLElement>("[data-badge]").forEach((b) => {
    b.hidden = n === 0;
    b.textContent = String(n);
  });
  setBadge(n);
}
