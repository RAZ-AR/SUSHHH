// Точка входа: шрифты, экраны, старт ленты, ярлыки иконки.

import "@fontsource/onest/300.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import { $, toast } from "./ui";
import { addRemotePost, loadFeed } from "./feed";
import { onNewPost } from "./backend";
import { t } from "./i18n";
import { feed, field, setFeed } from "./state";
import { showView, updateBadge, view } from "./nav";
import { player, renderChannels, renderStories, started, tuneRadio, visual } from "./air";
import { renderMine, setMineTab } from "./mine";
import { paintMe } from "./profile";
import { openRecorder, preview, recorder, recVisual } from "./recorder-ui";
import "./fan"; // веер реакций регистрирует свои обработчики при импорте

// =================== старт ===================

// моя аура — цвет кнопок, которыми говорю я: «ответить» и записать
paintMe();

// облако слушает то, что звучит: запись — мой голос улетает вдаль; эфир — голос автора летит на меня
field.source = () => {
  if (!$("recorder").hidden) return { level: recVisual.level, tone: recVisual.tone, out: true, idle: !recorder.active && preview.el.paused };
  if (view === "home" && started && !player.el.paused) return { level: visual.level, tone: visual.tone, out: false, idle: false };
  return { level: 0, out: false, idle: true };
};

// ярлыки из манифеста: долгое нажатие на иконку → «Записать» или «Ответы»
function openShortcut() {
  const go = new URLSearchParams(location.search).get("go");
  if (!go) return;
  history.replaceState(null, "", location.pathname);
  if (go === "record") openRecorder(null);
  else if (go === "replies") {
    setMineTab("toMe");
    showView("mine");
  }
}

loadFeed().then((f) => {
  setFeed(f);
  renderChannels();
  renderStories();
  tuneRadio("foryou", false);
  showView("home");
  openShortcut();
  // живой эфир: чужие голоса появляются сразу; ответ на мою запись — всплывашка и бейдж
  onNewPost((r) => {
    const added = addRemotePost(feed, r);
    if (!added) return;
    if (added.root.mine && added.post !== added.root) toast(t("repliedToYou"));
    updateBadge();
    renderStories();
    if (view === "mine") renderMine();
  });
});
