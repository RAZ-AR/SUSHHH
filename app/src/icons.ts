// Набор иконок: тонкая линия 1.7, скруглённые концы. Слова в интерфейсе заменяют иконки.
// В разметке: <i data-i="heart"></i> → paintIcons() вставляет SVG.

const LINE: Record<string, string> = {
  headphones: "M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5zM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 10a7 7 0 0 0 14 0M12 17v4",
  inbox: "M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v6H4z",
  heart: "M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6z",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0",
  message: "M4 20l1.3-3.9A8 8 0 1 1 8 19z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  down: "M6 9l6 6 6-6",
  left: "M15 6l-6 6 6 6",
  x: "M18 6L6 18M6 6l12 12",
  rotate: "M19.9 13A8 8 0 1 1 18 6.3M20 4v5h-5",
  send: "M10 14L21 3M21 3l-6.5 18-3.5-7-7-3.5z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  hide: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9 9 0 0 1 12 5c4 0 7.3 2.5 9 7a13 13 0 0 1-2.2 3.4M6.6 6.6C4.9 7.8 3.7 9.6 3 12c1.7 4.5 5 7 9 7a9 9 0 0 0 4.4-1.1",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.7 5.7l12.6 12.6",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  speed: "M12 13l4-4M3.5 16a9 9 0 1 1 17 0",
  reply: "M6 6v6a3 3 0 0 0 3 3h10M15 11l4 4-4 4",
  check: "M5 12l5 5L20 7",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9 20 20M8.1 16.1 20 4",
  wave: "M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2",
};

const FILL: Record<string, string> = {
  play: "M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z",
  pause: "M7 5h3v14H7zM14 5h3v14h-3z",
  stop: "M7 7h10v10H7z",
  heartFill: "M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6z",
};

export function icon(name: string) {
  if (FILL[name]) return `<svg class="ico fill" viewBox="0 0 24 24" aria-hidden="true"><path d="${FILL[name]}"/></svg>`;
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${LINE[name] ?? ""}"/></svg>`;
}

export function paintIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => {
    el.outerHTML = icon(el.dataset.i!);
  });
}
