// Разделы и листы прототипа. Разделы (эфир и «Моё») переключает dock; эфир — главный экран, «Моё» — страница
// поверх него. Каналы и ветка выезжают снизу листом. Звук и запись остаются в capsule.ts и приходят через api.

import { ASIDE, CHANNELS, ME, MY_POSTS, POSTS, esc, type Clip, type Post } from "./capsule-data";
import { tr, trn } from "./i18n";
import { t } from "../src/i18n"; // тексты жалоб и блокировки — общие со старой версией, уже на 5 языках
import { REASONS, blockedNames, type ReportReason } from "./safety";
import { MIN_AGE, eraseAll, giveConsent } from "./privacy";
import { ALL_LANGS, chosen } from "./langs";
import { disablePush, enablePush, pushState, type PushState } from "./push";
import { GUEST_MONTHLY, becameMember, guestLeft, isMember } from "./account";
import { confirmCode, sendCode } from "../src/backend";
import type { Lang } from "../src/i18n";

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
  solid(): boolean; // чёткий режим: без прозрачности, выше контраст
  toggleSolid(): void;
  langs(l: Lang): void; // включить или выключить язык голосов
  remove(id: string): Promise<void>; // удалить свою запись
  // безопасность: голос пропадает из эфира у этого человека сразу
  hide(id: string): void;
  block(name: string): void;
  report(id: string, reason: ReportReason): void;
  unblock(name: string): void;
  removeAllMine(): Promise<void>; // удалить все свои записи с устройства
  joined(): void; // регистрация прошла — открыть то, ради чего её просили
};
type Sheet = "channels" | "thread" | "mod" | "consent" | "privacy" | "delMine" | "erase" | "join";
// регистрация: зачем открыли (запись, реакция, лимит гостя, из профиля), шаг и введённая почта
export type JoinWhy = "record" | "react" | "limit" | "profile";
let join: { why: JoinWhy; step: "email" | "code"; email: string; mode: "link" | "signin"; error: string; busy: boolean } | undefined;
let consentFor: Target | undefined; // что человек хотел записать, когда его спросили о согласии
let privacyFromConsent = false;
// лист «⋯»: меню → причины жалобы → (если «нужна помощь») экран помощи; или подтверждение блокировки
type ModStep = "menu" | "reasons" | "crisis" | "block";
let mod: { id: string; name: string; step: ModStep } | undefined;
type Scope = "page" | "sheet";

const I = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>',
  contrast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/></svg>',
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
  // Enter в поле почты или кода — то же, что кнопка
  el("sheet").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target as HTMLElement).closest("#joinEmail, #joinCode")) {
      e.preventDefault();
      void joinStep();
    }
  });
  // согласие: кнопка «принимаю» оживает, только когда возраст подтверждён
  el("sheet").addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    if (box.id === "age") (el("consentYes") as HTMLButtonElement).disabled = !box.checked;
  });
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

// регистрация по коду на почту — по касанию «записать», реакции, на лимите гостя или из «Моё»
export function openJoin(why: JoinWhy) {
  join = { why, step: "email", email: "", mode: "link", error: "", busy: false };
  openSheet("join");
  setTimeout(() => (el("joinEmail") as HTMLInputElement | null)?.focus(), 350);
}
const JOIN_ERR: Record<string, string> = {
  offline: "joinErrOffline",
  over_email_send_rate_limit: "joinErrRate",
  email_address_invalid: "joinErrEmail",
  validation_failed: "joinErrEmail",
  otp_expired: "joinErrCode",
  invalid_credentials: "joinErrCode",
};
async function joinStep() {
  const j = join!;
  if (j.busy) return;
  if (j.step === "email") {
    const email = (el("joinEmail") as HTMLInputElement).value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return void ((j.error = tr("joinErrEmail")), drawSheet());
    j.busy = true;
    j.email = email;
    drawSheet();
    const r = await sendCode(email);
    j.busy = false;
    if ("error" in r) j.error = tr(JOIN_ERR[r.error] ?? "joinErrSend");
    else Object.assign(j, { step: "code", mode: r.mode, error: "" });
    drawSheet();
    if ((j.step as string) === "code") setTimeout(() => (el("joinCode") as HTMLInputElement | null)?.focus(), 50);
  } else {
    const code = (el("joinCode") as HTMLInputElement).value.replace(/\D/g, "");
    if (code.length < 6) return void ((j.error = tr("joinErrCode")), drawSheet());
    j.busy = true;
    drawSheet();
    const r = await confirmCode(j.email, code, j.mode);
    j.busy = false;
    if (r !== true) return void ((j.error = tr(JOIN_ERR[r] ?? "joinErrCode")), drawSheet());
    // вошли в уже существующий аккаунт — перезапуск подтянет его эфир и записи
    if (j.mode === "signin") return location.reload();
    becameMember();
    join = undefined;
    closeSheet(false);
    api.joined();
  }
}

// перед первой записью: что будет с голосом, правила, возраст. Согласился — запись начинается сразу
export function openConsent(t: Target) {
  consentFor = t;
  openSheet("consent");
}

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
  } else if (a === "consent-yes") {
    if (!(el("age") as HTMLInputElement | null)?.checked) return;
    giveConsent();
    const t = consentFor;
    consentFor = undefined;
    closeSheet(false);
    if (t) api.record(t);
  } else if (a === "consent-no") {
    consentFor = undefined;
    closeSheet();
  } else if (a === "privacy") {
    privacyFromConsent = sheetView === "consent";
    openSheet("privacy");
  } else if (a === "privacy-close") {
    if (privacyFromConsent && consentFor) openSheet("consent");
    else closeSheet();
  } else if (a === "del-mine") openSheet("delMine");
  else if (a === "del-mine-yes") {
    closeSheet(false);
    void api.removeAllMine().then(drawPage);
  } else if (a === "erase") openSheet("erase");
  else if (a === "erase-yes") void eraseAll();
  else if (a === "push") void togglePush();
  else if (a === "join") openJoin("profile");
  else if (a === "join-next") void joinStep();
  else if (a === "join-back" && join) {
    Object.assign(join, { step: "email", error: "" });
    drawSheet();
  }
  else if (a === "lang") {
    api.langs(id as Lang);
    drawSheet();
  } else if (a === "solid") {
    api.toggleSolid();
    drawPage();
  } else if (a === "theme") {
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

// языки голосов — под каналами: что слышать в эфире
const langChips = () => {
  const on = chosen();
  return (
    `<h2 class="sec">${tr("voiceLangs")}</h2><div class="chips">` +
    ALL_LANGS.map((l) => `<button class="pill" data-act="lang" data-id="${l.id}" aria-pressed="${on.includes(l.id)}">${on.includes(l.id) ? I.check : ""} ${l.name}</button>`).join("") +
    `</div><p class="hintline">${tr("voiceLangsNote")}</p>`
  );
};

// ---------- уведомления ----------
let pushNow: PushState | "busy" = "off";
const pushChip = (s: PushState | "busy") =>
  s === "on" || s === "off" || s === "busy"
    ? `<button class="pill" data-act="push" aria-pressed="${s === "on"}"${s === "busy" ? " disabled" : ""}>${I.bell} ${tr(s === "on" ? "pushOn" : "pushOff")}</button>`
    : "";
const pushNote = (s: PushState | "busy") => (s === "install" ? tr("pushInstall") : s === "denied" ? tr("pushDenied") : s === "unsupported" ? tr("pushUnsupported") : tr("pushNote"));
function paintPush() {
  const row = document.getElementById("pushRow");
  const note = document.getElementById("pushNote");
  if (row) row.innerHTML = pushChip(pushNow);
  if (note) note.textContent = pushNote(pushNow);
}
export async function refreshPush() {
  pushNow = await pushState().catch((): PushState => "unsupported");
  paintPush();
}
async function togglePush() {
  const was = pushNow;
  pushNow = "busy";
  paintPush();
  try {
    pushNow = was === "on" ? await disablePush() : await enablePush();
  } catch {
    pushNow = await pushState().catch((): PushState => "unsupported");
  }
  paintPush();
}

const newReplies = () =>
  unheard ? `<button class="pill hot" data-act="new">${I.play} ${trn("newReplies", unheard)}</button>` : "";

function drawPage() {
  const page = el("page");
  if (tab === "mine") {
    void refreshPush();
    const mine = MY_POSTS.flatMap((p) => p.replies.map((r) => ({ r, p })));
    // новые сверху: у записанных здесь id — «m» и время записи
    const stamp = (id: string) => (id.startsWith("m") ? Number(id.slice(1)) : 0);
    const sent = myReplies().sort((a, b) => stamp(b.r.id) - stamp(a.r.id));
    const light = api.theme() === "light";
    page.innerHTML =
      `<div class="me"><span class="dot big"></span><div><b>${esc(ME)}</b><span>${isMember() ? tr("memberYes") : tr("guestLeft", { n: guestLeft(), max: GUEST_MONTHLY })}</span></div>
         <button class="small" data-act="solid" aria-pressed="${api.solid()}" aria-label="${tr("solidMode")}" title="${tr("solidMode")}">${I.contrast}</button>
         <button class="small" data-act="theme" aria-label="${tr(light ? "darkTheme" : "lightTheme")}">${light ? I.moon : I.sun}</button></div>` +
      (isMember() ? "" : `<button class="pill hot join" data-act="join">${I.mic} ${tr("joinCta")}</button>`) +
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
        : "") +
      // мои данные: правила, удалить свои записи, удалить всё
      // уведомления об ответах: состояние узнаётся асинхронно — кнопку дорисует refreshPush()
      `<h2 class="sec">${tr("notifications")}</h2><div class="chips" id="pushRow">${pushChip(pushNow)}</div><p class="hintline" id="pushNote">${pushNote(pushNow)}</p>` +
      `<h2 class="sec">${tr("myData")}</h2><div class="chips">
         <button class="pill" data-act="privacy">${I.shield} ${tr("privacy")}</button>
         ${MY_POSTS.some((p) => deletable(p.id)) || myReplies().some(({ r }) => deletable(r.id)) ? `<button class="pill" data-act="del-mine">${I.trash} ${tr("deleteMine")}</button>` : ""}
         <button class="pill danger" data-act="erase">${I.trash} ${tr("eraseAll")}</button>
       </div>`;
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

const confirmSheet = (title: string, sub: string, act: string, label: string) =>
  `<div class="grab"></div><div class="sh-title lone">${title}</div><p class="sh-note">${sub}</p>
   <div class="tiles">${modTile(act, I.trash, label, " danger")}</div>`;

function drawSheet() {
  const s = el("sheet");
  if (sheetView === "mod") drawMod(s);
  else if (sheetView === "join" && join) {
    const j = join;
    s.innerHTML =
      `<div class="grab"></div><div class="sh-title lone">${tr("joinTitle")}</div>
       <p class="sh-note">${tr(`joinWhy_${j.why}`, { max: GUEST_MONTHLY })} ${tr("joinPrivate", { name: esc(ME) })}</p>` +
      (j.step === "email"
        ? `<label class="field"><span>${tr("joinEmailLabel")}</span><input id="joinEmail" type="email" inputmode="email" autocomplete="email" value="${esc(j.email)}" placeholder="name@example.com" /></label>`
        : `<p class="sh-note">${tr("joinSent", { email: esc(j.email) })}</p>
           <label class="field"><span>${tr("joinCodeLabel")}</span><input id="joinCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="000000" /></label>`) +
      (j.error ? `<p class="field-err" role="alert">${j.error}</p>` : "") +
      `<div class="tiles"><button class="tile mod care" data-act="join-next"${j.busy ? " disabled" : ""}><span class="mi">${j.step === "email" ? I.mic : I.check}</span><b>${tr(j.busy ? "joinBusy" : j.step === "email" ? "joinSend" : "joinConfirm")}</b></button></div>` +
      (j.step === "code" ? `<div class="chips center"><button class="pill" data-act="join-back">${tr("joinOther")}</button></div>` : "");
  }
  else if (sheetView === "consent")
    s.innerHTML =
      `<div class="grab"></div><div class="sh-title lone">${tr("consentTitle")}</div>
       <ul class="points">${["consent1", "consent2", "consent3", "consent4"].map((k) => `<li>${tr(k)}</li>`).join("")}</ul>
       <label class="check"><input type="checkbox" id="age" /><span>${tr("ageConfirm", { age: MIN_AGE })}</span></label>
       <div class="tiles">
         <button class="tile mod care" id="consentYes" data-act="consent-yes" disabled aria-describedby="ageHint"><span class="mi">${I.mic}</span><b>${tr("consentAgree")}</b></button>
       </div>
       <p class="sh-note" id="ageHint">${tr("ageNeeded")}</p>
       <div class="chips center">
         <button class="pill" data-act="privacy">${I.shield} ${tr("privacy")}</button>
         <button class="pill" data-act="consent-no">${tr("notNow")}</button>
       </div>`;
  else if (sheetView === "privacy")
    s.innerHTML =
      `<div class="sh-head"><button class="small" data-act="privacy-close" aria-label="${tr("close")}">${I.close}</button>
         <div class="sh-title">${tr("privacy")}</div><span></span></div>
       <dl class="points">` +
      (["Stored", "Hear", "Delete", "Rules", "Age"] as const)
        .map((k) => `<dt>${tr(`p${k}H`)}</dt><dd>${tr(`p${k}`, { age: MIN_AGE })}</dd>`)
        .join("") +
      `</dl>`;
  else if (sheetView === "delMine") s.innerHTML = confirmSheet(tr("deleteMineTitle"), tr("deleteMineSub"), "del-mine-yes", tr("deleteMineYes"));
  else if (sheetView === "erase") s.innerHTML = confirmSheet(tr("eraseTitle"), tr("eraseSub"), "erase-yes", tr("eraseYes"));
  else if (sheetView === "channels") {
    s.innerHTML = `<div class="grab"></div><div class="sh-title lone">${tr("whatListening")}</div>` + channelTiles() + langChips();
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
