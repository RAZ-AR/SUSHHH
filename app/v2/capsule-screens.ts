// Разделы и листы прототипа. Разделы (эфир и «Моё») переключает dock; эфир — главный экран, «Моё» — страница
// поверх него. Каналы и ветка выезжают снизу листом. Звук и запись остаются в capsule.ts и приходят через api.

import { ASIDE, CHANNELS, ME, MY_POSTS, POSTS, esc, type Clip, type Post } from "./capsule-data";
import { tr, trn } from "./i18n";
import { t } from "../src/i18n"; // тексты жалоб и блокировки — общие со старой версией, уже на 5 языках
import { REASONS, blockedNames, type ReportReason } from "./safety";

export type Tab = "air" | "mine";
export type Target = { kind: "reply"; post: Post } | { kind: "post" };
type Api = {
  play(clip: Clip, onEnd: () => void, onFail: () => void): void; // onFail — не загрузилось
  stop(): void;
  record(target: Target): void;
  resume(): void; // эфир снова на экране — играет дальше
  setChannel(name: string): void; // новый канал: эфир с начала
  refresh(): void; // перерисовать эфир и dock
  theme(): "dark" | "light";
  toggleTheme(): void;
  remove(id: string): Promise<void>; // удалить свою запись
  // безопасность: голос пропадает из эфира у этого человека сразу
  hide(id: string): void;
  block(name: string): void;
  report(id: string, reason: ReportReason): void;
  unblock(name: string): void;
};
type Sheet = "channels" | "thread" | "mod";
// лист «⋯»: меню → причины жалобы → (если «нужна помощь») экран помощи; или подтверждение блокировки
type ModStep = "menu" | "reasons" | "crisis" | "block";
let mod: { id: string; name: string; step: ModStep } | undefined;
type Scope = "page" | "sheet";

const I = {
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/></svg>',
  hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 8.5 4 9.5 6a13 13 0 0 1-2.6 3.4M6.4 7.6C4.4 8.9 3 10.7 2.5 12c1 2 4.5 6 9.5 6a9 9 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};

let api: Api;
let tab: Tab = "air";
let sheetView: Sheet | null = null;
let post: Post; // чья ветка открыта
let now = ""; // id записи, которая играет на странице или в листе
let channel = "foryou";
let unheard = MY_POSTS[0].replies.length; // новых ответов мне

const el = (id: string) => document.getElementById(id)!;

export const getTab = () => tab;
export const airFront = () => tab === "air" && !sheetView; // эфир на экране и ничем не закрыт
export const inboxCount = () => unheard;

export function initScreens(a: Api) {
  api = a;
  el("scrim").onclick = () => closeSheet();
  for (const scope of ["page", "sheet"] as const) {
    el(scope).onclick = (e) => {
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (hit) act(hit.dataset.act!, hit.dataset.id ?? "", scope);
    };
  }
  setTab(tab);
}

// сменить раздел, не трогая звук эфира
function setTab(t: Tab) {
  tab = t;
  now = "";
  el("page").classList.toggle("open", t !== "air");
  el("page").scrollTop = 0;
  drawPage();
  api.refresh();
}

export function showTab(t: Tab) {
  if (t === tab && !sheetView) return;
  if (sheetView) closeSheet(false);
  api.stop();
  setTab(t);
  if (t === "air") api.resume();
}

export function openSheet(v: Sheet, p?: Post) {
  api.stop();
  sheetView = v;
  now = "";
  if (p) post = p;
  drawPage();
  drawSheet();
  const s = el("sheet");
  s.scrollTop = 0;
  s.classList.toggle("full", v === "thread");
  s.setAttribute("aria-label", v === "mod" && mod ? mod.name : tr("sheet"));
  s.classList.add("open");
  el("scrim").classList.add("open");
}

export function closeSheet(resume = true) {
  if (!sheetView) return;
  api.stop();
  sheetView = null;
  now = "";
  el("sheet").classList.remove("open");
  el("scrim").classList.remove("open");
  drawPage(); // счётчики ответов могли измениться
  if (resume && tab === "air") api.resume();
}

const redraw = (scope: Scope) => (scope === "sheet" ? drawSheet() : drawPage());

// «⋯» у чужого голоса или ответа: скрыть, пожаловаться, заблокировать автора
export function openModerate(id: string, name: string) {
  mod = { id, name, step: "menu" };
  openSheet("mod");
}
const findClip = (id: string): Clip | undefined => {
  for (const p of [...POSTS, ...ASIDE, ...MY_POSTS]) {
    if (p.id === id) return p;
    const r = p.replies.find((x) => x.id === id);
    if (r) return r;
  }
};
const moreBtn = (c: Clip) =>
  c.mine ? "" : `<button class="del" data-act="mod" data-id="${c.id}" aria-label="${t("more")}: ${esc(c.name)}">${I.more}</button>`;

// звук оборвался не по касанию (звонок, Siri) — строка больше не показывает «играет»
export function clearPlaying() {
  if (!now) return;
  now = "";
  if (sheetView) drawSheet();
  if (tab !== "air") drawPage();
}

// играть записи подряд, начиная с i-й; играющая подсвечена
function playFrom(list: Clip[], i: number, scope: Scope) {
  const clip = list[i];
  const alive = scope === "sheet" ? !!sheetView : tab !== "air";
  if (!clip || !alive) {
    now = "";
    if (alive) redraw(scope);
    return;
  }
  now = clip.id;
  redraw(scope);
  api.play(
    clip,
    () => playFrom(list, i + 1, scope),
    () => {
      now = "";
      redraw(scope);
    },
  );
}

// что играть подряд: в ветке — исходный голос и ответы; в «Моём» — тот ряд, в котором нажали
// мои ответы другим людям — из всех веток
const myReplies = () =>
  [...POSTS, ...ASIDE].filter((p) => !p.mine).flatMap((p) => p.replies.filter((r) => r.mine).map((r) => ({ r, p })));

function listFor(scope: Scope, id = ""): Clip[] {
  if (scope === "sheet") return sheetView === "thread" ? [post, ...post.replies] : [];
  if (MY_POSTS.some((p) => p.id === id)) return MY_POSTS;
  const mineOut = myReplies().map(({ r }) => r);
  if (mineOut.some((r) => r.id === id)) return mineOut;
  return MY_POSTS.flatMap((p) => p.replies);
}

function act(a: string, id: string, scope: Scope) {
  if (a === "close") closeSheet();
  else if (a === "mod") {
    const c = findClip(id);
    if (c) openModerate(c.id, c.name);
  } else if (a.startsWith("mod-") && mod) moderate(a, id);
  else if (a === "unblock") {
    api.unblock(id);
    drawPage();
  }
  else if (a === "theme") {
    api.toggleTheme();
    drawPage();
  } else if (a === "channel") {
    closeSheet(false);
    api.stop();
    setTab("air");
    pickChannel(id);
  } else if (a === "play") {
    if (now === id) {
      api.stop();
      now = "";
      redraw(scope);
    } else {
      const list = listFor(scope, id);
      if (scope === "page" && list.some((c) => MY_POSTS.some((p) => p.replies.includes(c))) && unheard) {
        unheard = 0;
        api.refresh();
      }
      playFrom(list, list.findIndex((c) => c.id === id), scope);
    }
  } else if (a === "all") playFrom(listFor(scope), 0, scope);
  else if (a === "new") {
    unheard = 0;
    api.refresh();
    playFrom(listFor("page"), 0, "page");
  } else if (a === "post") api.record({ kind: "post" });
  else if (a === "del") {
    // удаление не отменить — спрашиваем
    if (!confirm(tr("confirmDelete"))) return;
    if (now === id) {
      api.stop();
      now = "";
    }
    void api.remove(id).then(() => {
      drawPage();
      if (sheetView) drawSheet();
    });
  }
  else if (a === "reply") {
    const p = post;
    closeSheet(false);
    api.record({ kind: "reply", post: p });
  }
}

function pickChannel(id: string) {
  channel = id;
  api.setChannel(tr(`ch_${id}`));
}
// смахивание вбок в эфире: соседний канал по кругу
export function stepChannel(dir: 1 | -1) {
  const i = CHANNELS.findIndex((c) => c.id === channel);
  pickChannel(CHANNELS[(i + dir + CHANNELS.length) % CHANNELS.length].id);
}

// =================== разметка ===================

const replies = (n: number) => trn("replies", n);

// записанное на этом телефоне можно удалить — у таких id первая буква «m»
const deletable = (id: string) => id.startsWith("m");
const delBtn = (id: string) => `<button class="del" data-act="del" data-id="${id}" aria-label="${tr("deleteRec")}">${I.trash}</button>`;

// sub — уже готовая разметка (экранированная)
const row = (c: Clip, sub = esc(c.text)) => {
  const who = c.mine ? tr("you") : esc(c.name);
  const btn = `<button class="row${c.mine ? " mine" : ""}${now === c.id ? " playing" : ""}" data-act="play" data-id="${c.id}"
     aria-label="${tr(now === c.id ? "stopName" : "listenTo", { name: who })}">
     <span class="dot"></span>
     <span class="txt"><b>${who}</b><span>${sub}</span></span>
     <span class="ico">${now === c.id ? I.stop : I.play}</span>
   </button>`;
  if (deletable(c.id)) return `<div class="item r">${btn}${delBtn(c.id)}</div>`;
  return c.mine ? btn : `<div class="item r">${btn}${moreBtn(c)}</div>`;
};

const channelTiles = () =>
  `<div class="tiles">` +
  CHANNELS.map(
    (c, i) =>
      `<button class="tile ${i % 3 === 0 ? "green" : "pink"}" data-act="channel" data-id="${c.id}" aria-pressed="${c.id === channel}">
         ${c.id === channel ? `<span class="tick">${I.check}</span>` : ""}
         <b>${tr(`ch_${c.id}`)}</b><span>${tr(`ch_${c.id}_note`)}</span>
       </button>`,
  ).join("") +
  `</div>`;

const newReplies = () =>
  unheard ? `<button class="pill hot" data-act="new">${I.play} ${trn("newReplies", unheard)}</button>` : "";

function drawPage() {
  const page = el("page");
  if (tab === "mine") {
    const mine = MY_POSTS.flatMap((p) => p.replies.map((r) => ({ r, p })));
    // новые сверху: у записанных здесь id — «m» и время записи
    const stamp = (id: string) => (id.startsWith("m") ? Number(id.slice(1)) : 0);
    const sent = myReplies().sort((a, b) => stamp(b.r.id) - stamp(a.r.id));
    const light = api.theme() === "light";
    page.innerHTML =
      `<div class="me"><span class="dot big"></span><div><b>${esc(ME)}</b><span>${tr("myColor")}</span></div>
         <button class="small" data-act="theme" aria-label="${tr(light ? "darkTheme" : "lightTheme")}">${light ? I.moon : I.sun}</button></div>` +
      // мои записи — вертикальные овалы, листаются вбок; первый начинает новую запись
      `<h2 class="sec">${tr("myRecordings")}</h2>
       <div class="vrow">
         <button class="tile tall add green" data-act="post" aria-label="${tr("recordNew")}">${I.plus}<b>${tr("newRecording")}</b></button>` +
      [...MY_POSTS].reverse().map((p) => {
        const tile = `<button class="tile tall green${now === p.id ? " playing" : ""}" data-act="play" data-id="${p.id}" aria-label="${tr(now === p.id ? "stopName" : "listenTo", { name: esc(p.hook) })}">
             <span class="tick">${now === p.id ? I.stop : I.play}</span><span class="clamp">${esc(p.hook)}</span>
             <span class="count">${p.replies.length ? replies(p.replies.length) : ""}</span>
           </button>`;
        return deletable(p.id) ? `<div class="item t">${tile}${delBtn(p.id)}</div>` : tile;
      }).join("") +
      `</div>
       <h2 class="sec">${tr("repliesToMe")}</h2>` +
      // ответы — горизонтальные овалы
      newReplies() +
      (mine.length ? mine.map(({ r, p }) => row(r, tr("onHook", { hook: esc(p.hook) }))).join("") : `<p class="empty">${tr("noRepliesToMe")}</p>`) +
      // мои ответы другим: новые сверху
      `<h2 class="sec">${tr("myReplies")}</h2>` +
      (sent.length
        ? sent.map(({ r, p }) => row(r, tr("forHook", { name: esc(p.name), hook: esc(p.hook) }))).join("")
        : `<p class="empty">${tr("noMyReplies")}</p>`) +
      // заблокированные: вернуть одним касанием
      (blockedNames().length
        ? `<h2 class="sec">${t("blockedN", { n: blockedNames().length })}</h2><p class="hintline">${t("unblockHint")}</p><div class="chips">` +
          blockedNames()
            .map((n) => `<button class="pill" data-act="unblock" data-id="${esc(n)}" aria-label="${t("unblock")}: ${esc(n)}">${I.ban} ${esc(n)}</button>`)
            .join("") +
          `</div>`
        : "");
  }
}

// действия листа «⋯»
function moderate(a: string, arg: string) {
  const m = mod!;
  if (a === "mod-hide") {
    closeSheet();
    api.hide(m.id);
  } else if (a === "mod-report") {
    m.step = "reasons";
    drawSheet();
  } else if (a === "mod-reason") {
    api.report(m.id, arg as ReportReason);
    // «автору нужна помощь» — не просто «спасибо»: что делать, если опасность прямо сейчас
    if (arg === "crisis") {
      m.step = "crisis";
      drawSheet();
    } else closeSheet();
  } else if (a === "mod-block") {
    m.step = "block";
    drawSheet();
  } else if (a === "mod-block-yes") {
    closeSheet();
    api.block(m.name);
  } else if (a === "mod-done") closeSheet();
}

const modTile = (act: string, icon: string, label: string, extra = "", arg = "") =>
  `<button class="tile mod${extra}" data-act="${act}"${arg ? ` data-id="${arg}"` : ""}><span class="mi">${icon}</span><b>${label}</b></button>`;

function drawMod(s: HTMLElement) {
  const m = mod!;
  const name = esc(m.name);
  const head = (title: string, sub = "") =>
    `<div class="grab"></div><div class="sh-title lone">${title}</div>${sub ? `<p class="sh-note">${sub}</p>` : ""}`;
  if (m.step === "menu")
    s.innerHTML =
      head(name) +
      `<div class="tiles">` +
      modTile("mod-report", I.flag, t("report")) +
      modTile("mod-hide", I.hide, t("hide")) +
      modTile("mod-block", I.ban, t("blockNamed", { name }), " danger") +
      `</div>`;
  else if (m.step === "reasons")
    s.innerHTML =
      head(t("reportTitle")) +
      `<div class="tiles">` +
      REASONS.map((r) => modTile("mod-reason", r === "crisis" ? I.heart : I.flag, t(`reason.${r}`), r === "crisis" ? " care" : "", r)).join("") +
      `</div><p class="sh-note">${t("reportNote")}</p>`;
  else if (m.step === "crisis")
    s.innerHTML = head(t("thanks"), t("crisisNote")) + `<div class="tiles">${modTile("mod-done", I.heart, t("gotIt"), " care")}</div>`;
  else
    s.innerHTML =
      head(t("blockTitle", { name }), t("blockSub")) + `<div class="tiles">${modTile("mod-block-yes", I.ban, t("block"), " danger")}</div>`;
}

function drawSheet() {
  const s = el("sheet");
  if (sheetView === "mod") drawMod(s);
  else if (sheetView === "channels") {
    s.innerHTML = `<div class="grab"></div><div class="sh-title lone">${tr("whatListening")}</div>` + channelTiles();
  } else if (sheetView === "thread") {
    const n = post.replies.length;
    s.innerHTML =
      `<div class="sh-head"><button class="small" data-act="close" aria-label="${tr("close")}">${I.close}</button>
         <div><div class="sh-title">${tr("threadTitle")}</div>${n ? `<div class="sh-sub">${replies(n)}</div>` : ""}</div><span></span></div>
       <div class="tiles"><div class="item r"><button class="tile pink wide${now === post.id ? " playing" : ""}" data-act="play" data-id="${post.id}">
         <span class="tick">${now === post.id ? I.stop : I.play}</span><b>${post.mine ? tr("you") : esc(post.name)}</b><span>${esc(post.hook)}</span>
       </button>${moreBtn(post)}</div></div>` +
      (n
        ? `<button class="pill" data-act="all">${I.play} ${tr("playAll")}</button>` + post.replies.map((r) => row(r)).join("")
        : `<p class="empty">${tr("noReplies")}</p>`) +
      `<div class="sh-foot"><button class="main" data-act="reply" aria-label="${tr("replyVoice")}">${I.mic}</button><div class="label">${tr("replyLabel")}</div></div>`;
  }
}
