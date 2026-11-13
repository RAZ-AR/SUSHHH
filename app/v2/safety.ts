// Безопасность эфира: скрыть голос, заблокировать автора, пожаловаться.
// Всё хранится на устройстве и переживает перезагрузку. Жалобы копятся в очереди и уйдут модераторам,
// когда у v2 появится сервер (этап 3 плана): тогда очередь отправит src/backend.ts → sendReport.

export type ReportReason = "abuse" | "danger" | "sexual" | "personal" | "spam" | "crisis" | "other";
// «нужна помощь» — отдельно и не последней: человек в беде важнее спама
export const REASONS: ReportReason[] = ["abuse", "danger", "sexual", "personal", "spam", "crisis", "other"];

const HIDDEN = "sushhh.v2.hidden";
const BLOCKED = "sushhh.v2.blocked";
const REPORTS = "sushhh.v2.reports";

function read<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // без хранилища — действует до перезагрузки
  }
}

const hidden = new Set<string>(read<string[]>(HIDDEN, []));
const blocked = new Set<string>(read<string[]>(BLOCKED, []));

export const isHidden = (id: string) => hidden.has(id);
export const isBlocked = (name: string) => blocked.has(name);
export const blockedNames = () => [...blocked];
// голос или ответ виден, если его не скрыли и автор не в блоке
export const visible = (c: { id: string; name: string; mine?: boolean }) => c.mine || (!hidden.has(c.id) && !blocked.has(c.name));

export function hide(id: string) {
  hidden.add(id);
  write(HIDDEN, [...hidden]);
}
export function block(name: string) {
  blocked.add(name);
  write(BLOCKED, [...blocked]);
}
export function unblock(name: string) {
  blocked.delete(name);
  write(BLOCKED, [...blocked]);
}

export type Report = { id: string; reason: ReportReason; at: number };
// жалоба: в очередь для модераторов; пожаловавшийся больше не слышит этот голос
export function report(id: string, reason: ReportReason) {
  const list = read<Report[]>(REPORTS, []);
  if (!list.some((r) => r.id === id)) list.push({ id, reason, at: Date.now() });
  write(REPORTS, list);
  hide(id);
}
export const pendingReports = () => read<Report[]>(REPORTS, []);
