// Общие мелочи интерфейса: поиск элемента, время, экранирование, всплывашка, нижний лист.

import { translateDom } from "./i18n";
import { icon, paintIcons } from "./icons";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// иконки и переводы в разметке — до того, как экраны начнут с ней работать
paintIcons();
translateDom();

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

export function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

let toastTimer = 0;
export function toast(text: string) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2000);
}

// =================== лист действий ===================

export type SheetRow = { icon: string; label: string; on?: boolean; danger?: boolean; onClick: () => void };
// лист на время показа ставит звук на паузу и возвращает его, когда закрывается
let sheetMedia: HTMLMediaElement | null = null;
export function pauseForSheet(el: HTMLMediaElement) {
  sheetMedia = el.paused ? null : el;
  el.pause();
}

export function openSheet(title: string, sub: string, rows: SheetRow[], note = "", custom?: HTMLElement) {
  $("sheetTitle").textContent = title;
  $("sheetSub").textContent = sub;
  const body = $("sheetBody");
  body.innerHTML = "";
  for (const r of rows) {
    const b = document.createElement("button");
    b.className = "sheet-row" + (r.on ? " on" : "") + (r.danger ? " danger" : "");
    b.innerHTML = `${icon(r.icon)}<span>${escapeHtml(r.label)}</span>`;
    b.onclick = r.onClick;
    body.append(b);
  }
  if (custom) body.append(custom);
  if (note) body.insertAdjacentHTML("beforeend", `<p class="sheet-note">${escapeHtml(note)}</p>`);
  $("sheet").hidden = false;
  ($("sheet").querySelector(".sheet") as HTMLElement).focus(); // фокус на лист, а не на первый пункт
}

export function closeSheet(resume = true) {
  $("sheet").hidden = true;
  if (resume && sheetMedia) void sheetMedia.play().catch(() => {});
  sheetMedia = null;
}

$("sheetCancel").onclick = () => closeSheet();
$("sheet").addEventListener("click", (e) => e.target === $("sheet") && closeSheet());
