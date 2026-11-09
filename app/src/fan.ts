// Реакции: веер эмоций и мемов, звуки сообщества, настроение персонажа.

import { addReaction, findPost, type Post } from "./feed";
import { t } from "./i18n";
import { icon } from "./icons";
import { MEMES, playReaction, type Reaction, REACTIONS } from "./reactions";
import { authorAllows, type CommunitySound, countUse, createSound, durationOf, liveSounds, MAX_DUR, playClip, setStatus, SOUND_ICONS, soundKey, wordsAt } from "./sounds";
import { $, clock, closeSheet, escapeHtml, openSheet, toast } from "./ui";
import { feed, field } from "./state";
import { cur, marksFor, player, progressNow, visual } from "./air";

// =================== реакции ===================

export function renderReactionCounts() {
  const hearts = cur().post.reactions["❤️"] ?? 0;
  $("heartCount").textContent = hearts ? String(hearts) : "";
}

// реакция ставится в текущий момент записи; звук идёт через анализатор — кольцо вздрагивает
export function react(r: Reaction, big = false) {
  const p = cur().post;
  const at = progressNow();
  addReaction(p, r, at);
  field.burst(36);
  visual.setMarks(marksFor(p, !cur().parent));
  visual.flash(at);
  playReaction(r, player.fx(2600)); // мемы длиннее эмоций — держим анализатор открытым
  toastMeme(r);
  renderReactionCounts();
  float(r, big);
  emote(MOOD[r] ?? "happy");
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
  emote("laugh");
  toast(`«${snd.name}»`);
  player.el.volume = 0.3;
  const ms = await playClip(src, snd.start, snd.dur, player.fx(MAX_DUR * 1000 + 400));
  setTimeout(() => (player.el.volume = 1), ms + 100);
}

// персонаж отвечает на реакцию выражением глаз
const MOOD: Record<string, string> = {
  "❤️": "happy", "🤗": "happy", "👏": "happy", "🎉": "happy",
  "😂": "laugh", "🥁": "laugh",
  "😮": "wow", "🔥": "wow", "😱": "wow", "📯": "wow",
  "🎺": "sad", "🦗": "meh",
};
let moodTimer = 0;
function emote(mood: string) {
  const orb = document.getElementById("orb");
  if (!orb) return;
  orb.classList.remove("happy", "laugh", "wow", "sad", "meh");
  void orb.offsetWidth;
  orb.classList.add(mood);
  clearTimeout(moodTimer);
  moodTimer = window.setTimeout(() => orb.classList.remove(mood), 1400);
}

// персонажа на экране больше нет: голос виден в волне

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
      setTimeout(() => toast(t("holdHeart")), 900);
    }
  } catch {
    // без хранилища подсказка просто не покажется
  }
};
$("heartBtn").onkeydown = (e) => {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    $("fan").hidden = false;
  }
};
// веер: верхний ряд — эмоции, нижний — ситком-мемы
const fanRow = (list: readonly Reaction[]) =>
  `<div class="fan-row">${list.map((r) => `<button data-r="${r}" aria-label="${t(`r.${r}`)}" title="${t(`r.${r}`)}"><span>${r}</span></button>`).join("")}</div>`;
export function renderFan() {
  const community = liveSounds().slice(0, 6);
  $("fan").innerHTML =
    fanRow(REACTIONS) +
    fanRow(MEMES) +
    (community.length
      ? `<div class="fan-row community">${community
          .map((c) => `<button data-s="${escapeHtml(c.id)}" aria-label="${escapeHtml(t("soundAria", { name: c.name }))}" title="${escapeHtml(c.name)}"><span>${escapeHtml(c.icon)}</span></button>`)
          .join("")}</div>`
      : "");
}
renderFan();

// у мема есть имя — один раз подскажем, что это было
const memeSet = new Set<string>(MEMES);
function toastMeme(r: Reaction) {
  if (memeSet.has(r)) toast(t(`r.${r}`));
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

// =================== звуки сообщества: создание ===================

// какой момент вырезать: где сейчас пауза, а если запись не слушали — самая «горячая» секунда
function hotMoment(p: Post) {
  const bins = new Map<number, number>();
  for (const m of p.moments) bins.set(Math.round(m.at / 0.08), (bins.get(Math.round(m.at / 0.08)) ?? 0) + 1);
  const best = [...bins.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] * 0.08 : 0.3;
}

export async function openMakeSound(p: Post) {
  let d = 0;
  try {
    d = await durationOf(p.src);
  } catch {
    return toast(t("cantOpen"));
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
    <div class="icons">${SOUND_ICONS.map((ic, i) => `<button data-ic="${ic}" class="${i ? "" : "on"}" aria-label="${t("iconAria", { x: ic })}">${ic}</button>`).join("")}</div>
    <div class="row">
      <button class="pill" data-act="play">${icon("play")}${clock(dur)}</button>
      <button class="pill dark" data-act="make">${icon("check")}${t("makeDo")}</button>
    </div>
    <p class="hint">${t(allowed ? "makeAllowed" : "makeAsk")}</p>`;
  box.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const ic = target.closest<HTMLElement>("[data-ic]");
    if (ic) {
      chosen = ic.dataset.ic!;
      box.querySelectorAll("[data-ic]").forEach((x) => x.classList.toggle("on", x === ic));
      return;
    }
    const act = target.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "play") void playClip(p.src, start, dur, player.fx(dur * 1000 + 300));
    if (act === "make") {
      const snd = createSound({ postId: p.id, author: p.author, start, dur, icon: chosen, name, by: t("you") }, allowed);
      closeSheet();
      renderFan();
      if (allowed) return toast(t("inFan", { icon: chosen }));
      toast(t("asked"));
      // в прототипе «ответ автора» имитируется через несколько секунд
      setTimeout(() => {
        setStatus(snd.id, "live");
        renderFan();
        toast(t("approved", { icon: chosen, name }));
      }, 8000);
    }
  });
  openSheet(t("makeTitle"), t("makeSub"), [], "", box);
}
