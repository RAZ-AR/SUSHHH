// Гость и зарегистрированный. Гость слушает до 30 голосов в месяц и ничего не пишет (ни голосов, ни
// ответов, ни реакций). Зарегистрированный — всё, под тем же псевдонимом. Правила пока только в
// интерфейсе v2: сервер их не проверяет (решение 13.11.2026 — не трогать v1).

import { memberState } from "../src/backend";

export const GUEST_MONTHLY = 30;
const MEMBER = "sushhh.v2.member"; // последнее известное состояние — чтобы без сети не стать «гостем»
const HEARD = "sushhh.v2.guestHeard"; // { month: "2026-11", ids: [...] }

let member = read(MEMBER) === "1";
function read(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // не запомнится
  }
}

export const isMember = () => member;

// спросить сервер; без сети остаётся последнее известное
export async function refreshMember() {
  const s = await memberState().catch(() => "unknown" as const);
  if (s !== "unknown") {
    member = s === "member";
    write(MEMBER, member ? "1" : "0");
  }
  return member;
}
export function becameMember() {
  member = true;
  write(MEMBER, "1");
}

const month = () => new Date().toISOString().slice(0, 7);
function heardIds(): string[] {
  try {
    const v = JSON.parse(read(HEARD) ?? "null");
    return v?.month === month() && Array.isArray(v.ids) ? v.ids : [];
  } catch {
    return [];
  }
}
// сколько голосов гость ещё может послушать в этом месяце
export const guestLeft = () => Math.max(0, GUEST_MONTHLY - heardIds().length);
// можно ли гостю этот голос: уже слушал в этом месяце — можно всегда, новый — пока не исчерпан лимит
export function mayListen(id: string) {
  if (member) return true;
  const ids = heardIds();
  return ids.includes(id) || ids.length < GUEST_MONTHLY;
}
export function countListen(id: string) {
  if (member) return;
  const ids = heardIds();
  if (!ids.includes(id)) write(HEARD, JSON.stringify({ month: month(), ids: [...ids, id] }));
}
