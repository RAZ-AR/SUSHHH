// Личный кабинет: псевдоним, статистика, настройки, установка, удаление.

import { blockedAuthors, deleteRecording, eraseEverything, isHeard, me, myPosts, reactionCount, renameMe, repliesToMe, unblockAuthor } from "./feed";
import { aura, hsl, paintAura } from "./aura";
import { lang, LANGS, t, tn } from "./i18n";
import { icon } from "./icons";
import { look, LOOKS, setLook } from "./look";
import { allowsWithoutAsking, setAllowWithoutAsking } from "./sounds";
import { install, installKind, onInstallChange } from "./pwa";
import { $, closeSheet, escapeHtml, openSheet, toast } from "./ui";
import { feed, freshToMe, shown } from "./state";
import { drawRing } from "./thumbs";
import { showView, view } from "./nav";
import { cycleRate, openLanguages, rate, renderChannels, renderStories } from "./air";
import { renderMine } from "./mine";

// =================== личный кабинет ===================

$("meOpen").onclick = () => showView("me");
$("meBack").onclick = () => showView("mine");

// моя аура красит кнопки, которыми говорю я, и персонажа в кабинете
export function paintMe() {
  const mine = aura(me());
  document.documentElement.style.setProperty("--me1", hsl(mine[0], 1, 72));
  document.documentElement.style.setProperty("--me2", hsl(mine[1], 1, 76));
  paintAura($("meStage"), mine);
  queueMicrotask(() => drawRing($<HTMLCanvasElement>("meDisc"), undefined, mine));
}

// персонаж в кабинете: коснулся — улыбнулся
let meMoodTimer = 0;
function greet() {
  const disc = $("meStage");
  disc.classList.remove("ping");
  void disc.offsetWidth;
  disc.classList.add("ping");
  clearTimeout(meMoodTimer);
  meMoodTimer = window.setTimeout(() => disc.classList.remove("ping"), 900);
}
$("meStage").onclick = greet;
$("meStage").onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), greet());

$("meRename").onclick = () => {
  const name = renameMe();
  paintMe();
  renderProfile();
  greet();
  toast(t("nowName", { name }));
};

function stat(ic: string, n: number, aria: string) {
  const el = document.createElement("div");
  el.className = "me-stat";
  el.setAttribute("aria-label", aria);
  el.innerHTML = `${icon(ic)}<b>${n.toLocaleString(lang)}</b>`;
  return el;
}

function meRow(ic: string, label: string, onClick: () => void, danger = false) {
  const b = document.createElement("button");
  b.className = "sheet-row" + (danger ? " danger" : "");
  b.innerHTML = `${icon(ic)}<span>${escapeHtml(label)}</span>`;
  b.onclick = onClick;
  return b;
}

function meSwitch(label: string, on: boolean, onToggle: () => void) {
  const row = document.createElement("div");
  row.className = "switch-row";
  row.innerHTML = `<span>${escapeHtml(label)}</span>`;
  const sw = document.createElement("button");
  sw.className = "switch" + (on ? " on" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(on));
  sw.setAttribute("aria-label", label);
  sw.onclick = onToggle;
  row.append(sw);
  return row;
}

export function renderProfile() {
  $("meName").textContent = me();
  queueMicrotask(() => drawRing($<HTMLCanvasElement>("meDisc"), undefined, aura(me())));
  const posts = shown(myPosts(feed));
  const replies = freshToMe().length + repliesToMe(feed).filter((x) => isHeard(x.reply.id)).length;
  const reacts = posts.reduce((sum, p) => sum + reactionCount(p), 0);
  $("meStats").replaceChildren(
    stat("mic", posts.length, tn("posts", posts.length)),
    stat("message", replies, tn("replies", replies)),
    stat("heart", reacts, tn("reactions", reacts)),
  );

  const list = $("meList");
  list.replaceChildren(
    meRow("globe", `${t("language")} · ${LANGS.find((l) => l.id === lang)!.name}`, openLanguages),
    meRow("speed", t("speed", { x: rate.toLocaleString(lang) }), () => {
      cycleRate();
      renderProfile();
    }),
    meRow("rotate", `${t("look")} · ${t(`look.${look}`)}`, () => {
      setLook(LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length]);
      renderProfile();
      renderMine();
      renderStories();
    }),
    meSwitch(t("allowNoAsk"), allowsWithoutAsking(), () => {
      setAllowWithoutAsking(!allowsWithoutAsking());
      renderProfile();
    }),
    ...(installKind() ? [meRow("download", t("install"), openInstall)] : []),
    meRow("ban", t("blockedN", { n: blockedAuthors().length }), openBlocked),
    meRow("trash", t("deleteAll"), confirmDeleteAll, true),
    meRow("x", t("deleteAccount"), confirmDeleteAccount, true),
  );
}

// установка: Chrome/Android — системный диалог, iPhone — подсказка про «Поделиться»
async function openInstall() {
  if (installKind() === "ios") return openSheet(t("install"), t("installIos"), [], t("installSub"));
  await install();
  renderProfile();
}
onInstallChange(() => view === "me" && renderProfile());

function openBlocked() {
  const names = blockedAuthors();
  openSheet(
    t("tabBlocked"),
    names.length ? t("unblockHint") : "",
    names.map((name) => ({
      icon: "ban",
      label: name,
      onClick: () => {
        unblockAuthor(name);
        renderChannels();
        toast(t("unblocked", { name }));
        renderProfile();
        openBlocked();
      },
    })),
    names.length ? "" : t("emptyBlocked"),
  );
}

function confirmDeleteAll() {
  openSheet(t("deleteAllTitle"), t("deleteAllSub"), [
    {
      icon: "trash",
      label: t("deleteForever"),
      danger: true,
      onClick: async () => {
        for (const p of myPosts(feed)) await deleteRecording(p.id);
        closeSheet(false);
        toast(t("deletedAll"));
        renderProfile();
      },
    },
  ]);
}

function confirmDeleteAccount() {
  openSheet(t("deleteAccountTitle"), t("deleteAccountSub"), [
    {
      icon: "x",
      label: t("deleteForever"),
      danger: true,
      onClick: async () => {
        await eraseEverything();
        location.reload();
      },
    },
  ]);
}
