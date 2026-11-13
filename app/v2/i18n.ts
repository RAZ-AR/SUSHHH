// Тексты интерфейса v2 на пяти языках: английский, русский, немецкий, испанский, французский.
// Язык общий со старой версией (src/i18n): из системы или выбранный, хранится на устройстве.
// Голоса, подписи и имена людей — их контент, не переводим. Обращаемся на «ты» (du, tú, tu).

import { lang, type Lang } from "../src/i18n";

export { lang };

type Row = [en: string, ru: string, de: string, es: string, fr: string];
const COL: Record<Lang, number> = { en: 0, ru: 1, de: 2, es: 3, fr: 4 };

const D: Record<string, Row> = {
  // шапка и разделы
  profile: ["Profile: {name}", "Профиль: {name}", "Profil: {name}", "Perfil: {name}", "Profil : {name}"],
  air: ["On air", "Эфир", "Live", "En directo", "En direct"],
  mine: ["Mine", "Моё", "Meins", "Lo mío", "À moi"],
  sections: ["Sections", "Разделы", "Bereiche", "Secciones", "Rubriques"],
  replyVoice: ["Reply with your voice", "Ответить голосом", "Mit deiner Stimme antworten", "Responder con tu voz", "Répondre avec ta voix"],
  recordNew: ["Record a new voice", "Записать новый голос", "Neue Stimme aufnehmen", "Grabar una voz nueva", "Enregistrer une nouvelle voix"],
  // эфир
  airVoices: ["Voices on air", "Голоса эфира", "Stimmen im Live", "Voces en directo", "Voix en direct"],
  pickChannel: ["Choose a channel", "Выбрать канал", "Kanal wählen", "Elegir canal", "Choisir une chaîne"],
  you: ["you", "ты", "du", "tú", "toi"],
  listenTo: ["Listen: {name}", "Слушать: {name}", "Anhören: {name}", "Escuchar: {name}", "Écouter : {name}"],
  stopName: ["Stop: {name}", "Остановить: {name}", "Stoppen: {name}", "Parar: {name}", "Arrêter : {name}"],
  yourRecording: ["your recording", "твою запись", "deine Aufnahme", "tu grabación", "ton enregistrement"],
  reactionsOf: ["reactions: {list}", "реакции: {list}", "Reaktionen: {list}", "reacciones: {list}", "réactions : {list}"],
  tapePlace: ["Position in the recording", "Место в записи", "Stelle in der Aufnahme", "Punto de la grabación", "Position dans l'enregistrement"],
  hintTap: ["tap — and the air starts playing", "коснись — и эфир заиграет", "tippe — und das Live spielt", "toca y empieza el directo", "touche — et le direct démarre"],
  hintPaused: ["paused — tap to continue", "пауза — коснись, чтобы продолжить", "Pause — tippe zum Fortsetzen", "en pausa — toca para seguir", "en pause — touche pour reprendre"],
  reaction: ["React", "Реакция", "Reagieren", "Reaccionar", "Réagir"],
  audioReactions: ["Audio reactions", "Аудио-реакции", "Audio-Reaktionen", "Reacciones de audio", "Réactions audio"],
  reactionX: ["Reaction {r}", "Реакция {r}", "Reaktion {r}", "Reacción {r}", "Réaction {r}"],
  repliesBtn: ["Replies", "Ответы", "Antworten", "Respuestas", "Réponses"],
  thread: ["Reply thread", "Ветка ответов", "Antwort-Thread", "Hilo de respuestas", "Fil de réponses"],
  replyLabel: ["reply", "ответить", "antworten", "responder", "répondre"],
  // запись
  back: ["Back to the air", "Назад в эфир", "Zurück zum Live", "Volver al directo", "Retour au direct"],
  newRecording: ["new recording", "новая запись", "neue Aufnahme", "grabación nueva", "nouvel enregistrement"],
  replyTo: ["reply to {name}", "ответ для {name}", "Antwort an {name}", "respuesta a {name}", "réponse à {name}"],
  stopRec: ["Stop recording", "Остановить запись", "Aufnahme stoppen", "Detener la grabación", "Arrêter l'enregistrement"],
  stop: ["stop", "стоп", "Stopp", "parar", "stop"],
  publishBtn: ["Publish", "Опубликовать", "Veröffentlichen", "Publicar", "Publier"],
  publish: ["publish", "опубликовать", "veröffentlichen", "publicar", "publier"],
  redoBtn: ["Record again", "Переписать", "Neu aufnehmen", "Grabar de nuevo", "Réenregistrer"],
  redo: ["again", "переписать", "neu", "de nuevo", "refaire"],
  stopPlayBtn: ["Stop", "Остановить", "Stoppen", "Parar", "Arrêter"],
  listenBtn: ["Listen", "Послушать", "Anhören", "Escuchar", "Écouter"],
  listen: ["listen", "послушать", "anhören", "escuchar", "écouter"],
  onlyYou: ["{dur} · only you can hear it so far", "{dur} · пока слышно только тебе", "{dur} · bisher hörst nur du das", "{dur} · por ahora solo lo oyes tú", "{dur} · pour l'instant, toi seul l'entends"],
  flying: ["sending…", "летит…", "fliegt…", "enviando…", "envoi…"],
  onAir: ["on air", "в эфире", "im Live", "en directo", "en direct"],
  savedPost: ["Saved: first on air and in Mine", "Сохранено: первой в эфире и в «Моё»", "Gespeichert: zuerst im Live und in Meins", "Guardado: primero en directo y en Lo mío", "Enregistré : en tête du direct et dans À moi"],
  savedReply: ["Reply to {name} saved: in the thread and in Mine", "Ответ для {name} сохранён: в ветке и в «Моё»", "Antwort an {name} gespeichert: im Thread und in Meins", "Respuesta a {name} guardada: en el hilo y en Lo mío", "Réponse à {name} enregistrée : dans le fil et dans À moi"],
  notSent: [" · not sent to other people yet", " · другим людям пока не отправляется", " · wird noch nicht an andere gesendet", " · aún no se envía a otras personas", " · pas encore envoyé aux autres"],
  noSpace: [" · the phone is out of space: the recording will be lost after a reload", " · на телефоне кончилось место: после перезагрузки запись пропадёт", " · kein Speicher mehr: nach dem Neuladen ist die Aufnahme weg", " · no queda espacio: la grabación se perderá al recargar", " · plus de place sur le téléphone : l'enregistrement sera perdu au rechargement"],
  saveFailed: [" · couldn't save on the device: the recording will be lost after a reload", " · на устройстве сохранить не удалось: после перезагрузки запись пропадёт", " · konnte nicht gespeichert werden: nach dem Neuladen ist die Aufnahme weg", " · no se pudo guardar: la grabación se perderá al recargar", " · impossible d'enregistrer sur l'appareil : perdu au rechargement"],
  titleNew: ["New recording · {dur}", "Новая запись · {dur}", "Neue Aufnahme · {dur}", "Grabación nueva · {dur}", "Nouvel enregistrement · {dur}"],
  titleReply: ["Reply to {name} · {dur}", "Ответ для {name} · {dur}", "Antwort an {name} · {dur}", "Respuesta a {name} · {dur}", "Réponse à {name} · {dur}"],
  effects: ["Effects", "Эффекты", "Effekte", "Efectos", "Effets"],
  fx_none: ["No effect", "Без эффекта", "Ohne Effekt", "Sin efecto", "Sans effet"],
  fx_echo: ["Echo", "Эхо", "Echo", "Eco", "Écho"],
  fx_hall: ["Hall", "Зал", "Halle", "Sala", "Salle"],
  fx_low: ["Lower", "Ниже", "Tiefer", "Más grave", "Plus grave"],
  fx_high: ["Higher", "Выше", "Höher", "Más agudo", "Plus aigu"],
  fx_radio: ["Radio", "Радио", "Radio", "Radio", "Radio"],
  // сбои
  recInterrupted: ["Recording was interrupted — what you said is saved", "Запись прервалась — то, что успел сказать, сохранилось", "Aufnahme unterbrochen — Gesagtes ist gespeichert", "La grabación se cortó: lo que dijiste se guardó", "Enregistrement interrompu — ce que tu as dit est gardé"],
  soundInterrupted: ["Sound was interrupted — tap to continue", "Звук прервался — коснись, чтобы продолжить", "Ton unterbrochen — tippe zum Fortsetzen", "El sonido se cortó: toca para seguir", "Son interrompu — touche pour reprendre"],
  clipFailed: ["The recording didn't load — check the internet and tap again", "Запись не загрузилась — проверь интернет и коснись ещё раз", "Aufnahme nicht geladen — prüfe das Internet und tippe erneut", "La grabación no cargó: revisa internet y toca otra vez", "L'enregistrement n'a pas chargé — vérifie internet et touche à nouveau"],
  voiceFailed: ["The voice didn't load — check the internet and tap to try again", "Голос не загрузился — проверь интернет и коснись, чтобы попробовать ещё", "Stimme nicht geladen — prüfe das Internet und tippe für einen neuen Versuch", "La voz no cargó: revisa internet y toca para reintentar", "La voix n'a pas chargé — vérifie internet et touche pour réessayer"],
  micDenied: ["No microphone access — allow it for this site in the browser settings", "Нет доступа к микрофону — разреши его для этого сайта в настройках браузера", "Kein Mikrofonzugriff — erlaube ihn für diese Seite in den Browsereinstellungen", "Sin acceso al micrófono: permítelo para este sitio en los ajustes del navegador", "Pas d'accès au micro — autorise-le pour ce site dans les réglages du navigateur"],
  micUnavailable: ["The microphone isn't available on this device", "Микрофон недоступен на этом устройстве", "Auf diesem Gerät ist kein Mikrofon verfügbar", "El micrófono no está disponible en este dispositivo", "Le micro n'est pas disponible sur cet appareil"],
  micLost: ["The microphone disconnected — what you said is saved", "Микрофон отключился — то, что успел сказать, сохранилось", "Mikrofon getrennt — Gesagtes ist gespeichert", "El micrófono se desconectó: lo que dijiste se guardó", "Le micro s'est déconnecté — ce que tu as dit est gardé"],
  tooShort: ["Too short — keep recording a little longer", "Слишком коротко — удерживай запись подольше", "Zu kurz — nimm etwas länger auf", "Demasiado corto: graba un poco más", "Trop court — enregistre un peu plus longtemps"],
  micSilent: ["The microphone is silent — check that no other app is using it", "Микрофон молчит — проверь, не занят ли он другим приложением", "Das Mikrofon ist stumm — prüfe, ob eine andere App es nutzt", "El micrófono no capta nada: revisa si otra app lo está usando", "Le micro est muet — vérifie qu'aucune autre app ne l'utilise"],
  // «Моё», листы
  confirmDelete: ["Delete the recording? It can't be undone.", "Удалить запись? Вернуть её не получится.", "Aufnahme löschen? Das lässt sich nicht rückgängig machen.", "¿Borrar la grabación? No se puede deshacer.", "Supprimer l'enregistrement ? Impossible de revenir en arrière."],
  deleteRec: ["Delete the recording", "Удалить запись", "Aufnahme löschen", "Borrar la grabación", "Supprimer l'enregistrement"],
  myColor: ["your colour is green", "твой цвет — зелёный", "deine Farbe ist Grün", "tu color es verde", "ta couleur est le vert"],
  darkTheme: ["Dark theme", "Тёмная тема", "Dunkles Design", "Tema oscuro", "Thème sombre"],
  lightTheme: ["Light theme", "Светлая тема", "Helles Design", "Tema claro", "Thème clair"],
  myRecordings: ["My recordings", "Мои записи", "Meine Aufnahmen", "Mis grabaciones", "Mes enregistrements"],
  repliesToMe: ["Replies to me", "Ответы мне", "Antworten an mich", "Respuestas para mí", "Réponses pour moi"],
  noRepliesToMe: ["No one has replied yet.<br />Record a voice — and it will be heard.", "Тебе пока не ответили.<br />Запиши голос — и его услышат.", "Noch hat niemand geantwortet.<br />Nimm eine Stimme auf — sie wird gehört.", "Aún no te han respondido.<br />Graba una voz y la escucharán.", "Personne n'a encore répondu.<br />Enregistre une voix — elle sera entendue."],
  myReplies: ["My replies", "Мои ответы", "Meine Antworten", "Mis respuestas", "Mes réponses"],
  noMyReplies: ["You haven't replied yet.<br />The mic on air replies to the voice that's playing.", "Твоих ответов пока нет.<br />Микрофон в эфире — ответ голосу, который звучит.", "Du hast noch nicht geantwortet.<br />Das Mikro im Live antwortet der Stimme, die gerade spielt.", "Aún no has respondido.<br />El micrófono en directo responde a la voz que suena.", "Tu n'as pas encore répondu.<br />Le micro en direct répond à la voix qui joue."],
  onHook: ["on “{hook}”", "на «{hook}»", "auf „{hook}“", "a «{hook}»", "sur « {hook} »"],
  forHook: ["to {name} · “{hook}”", "для {name} · «{hook}»", "an {name} · „{hook}“", "para {name} · «{hook}»", "pour {name} · « {hook} »"],
  whatListening: ["What we listen to", "Что слушаем", "Was wir hören", "Qué escuchamos", "Ce qu'on écoute"],
  close: ["Close", "Закрыть", "Schließen", "Cerrar", "Fermer"],
  threadTitle: ["Thread", "Ветка", "Thread", "Hilo", "Fil"],
  playAll: ["play everything in a row", "слушать всё подряд", "alles nacheinander hören", "escuchar todo seguido", "tout écouter à la suite"],
  noReplies: ["No replies yet.<br />Start the conversation — reply with your voice.", "Ответов пока нет.<br />Начни разговор — ответь голосом.", "Noch keine Antworten.<br />Fang das Gespräch an — antworte mit deiner Stimme.", "Aún no hay respuestas.<br />Empieza la conversación: responde con tu voz.", "Pas encore de réponses.<br />Lance la conversation — réponds avec ta voix."],
  sheet: ["Sheet", "Лист", "Blatt", "Hoja", "Feuille"],
  // каналы
  ch_foryou: ["For you", "Для тебя", "Für dich", "Para ti", "Pour toi"],
  ch_foryou_note: ["picked from what you listen to", "подобрано по тому, что ты слушаешь", "passend zu dem, was du hörst", "elegido según lo que escuchas", "choisi d'après ce que tu écoutes"],
  ch_new: ["New", "Новое", "Neu", "Nuevo", "Nouveau"],
  ch_new_note: ["just recorded", "только что записано", "gerade aufgenommen", "recién grabado", "tout juste enregistré"],
  ch_qod: ["Question of the day", "Вопрос дня", "Frage des Tages", "Pregunta del día", "Question du jour"],
  ch_qod_note: ["what surprised you today?", "что тебя сегодня удивило?", "was hat dich heute überrascht?", "¿qué te sorprendió hoy?", "qu'est-ce qui t'a surpris aujourd'hui ?"],
  ch_confess: ["Confessions & thoughts", "Признания и мысли", "Geständnisse & Gedanken", "Confesiones y pensamientos", "Aveux et pensées"],
  ch_confess_note: ["things that are hard to say out loud", "то, что трудно сказать вслух", "was schwer laut zu sagen ist", "lo que cuesta decir en voz alta", "ce qui est dur à dire à voix haute"],
  ch_stories: ["Stories", "Истории", "Geschichten", "Historias", "Histoires"],
  ch_stories_note: ["things that happened", "случаи из жизни", "Erlebtes", "cosas que pasaron", "des choses vécues"],
  ch_city: ["City", "Город", "Stadt", "Ciudad", "Ville"],
  ch_city_note: ["Yerevan, right now", "Ереван, сейчас", "Jerewan, gerade jetzt", "Ereván, ahora", "Erevan, en ce moment"],
};

// множественное число: формы по правилам языка (Intl.PluralRules)
const P: Record<string, Partial<Record<Intl.LDMLPluralRule, Row>>> = {
  plays: {
    one: ["{n} listen", "{n} прослушивание", "{n}-mal gehört", "{n} escucha", "{n} écoute"],
    few: ["{n} listens", "{n} прослушивания", "{n}-mal gehört", "{n} escuchas", "{n} écoutes"],
    many: ["{n} listens", "{n} прослушиваний", "{n}-mal gehört", "{n} escuchas", "{n} écoutes"],
    other: ["{n} listens", "{n} прослушивания", "{n}-mal gehört", "{n} escuchas", "{n} écoutes"],
  },
  replies: {
    one: ["{n} reply", "{n} ответ", "{n} Antwort", "{n} respuesta", "{n} réponse"],
    few: ["{n} replies", "{n} ответа", "{n} Antworten", "{n} respuestas", "{n} réponses"],
    many: ["{n} replies", "{n} ответов", "{n} Antworten", "{n} respuestas", "{n} réponses"],
    other: ["{n} replies", "{n} ответа", "{n} Antworten", "{n} respuestas", "{n} réponses"],
  },
  newReplies: {
    one: ["{n} new reply", "{n} новый ответ", "{n} neue Antwort", "{n} respuesta nueva", "{n} nouvelle réponse"],
    few: ["{n} new replies", "{n} новых ответа", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
    many: ["{n} new replies", "{n} новых ответов", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
    other: ["{n} new replies", "{n} новых ответа", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
  },
};

const fill = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export function tr(key: string, vars?: Record<string, string | number>) {
  const row = D[key];
  return fill(row ? row[COL[lang]] : key, vars);
}

const rules = new Intl.PluralRules(lang);
export function trn(key: string, n: number) {
  const forms = P[key];
  const row = forms?.[rules.select(n)] ?? forms?.other;
  return fill(row ? row[COL[lang]] : String(n), { n: num(n) });
}

// числа по-местному: 1 240 / 1,240 / 1.240; большие — коротко: 12 тыс. / 12K
const short = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
export const num = (n: number) => (n >= 10_000 ? short.format(n) : n.toLocaleString(lang));

// подписи в разметке страницы: data-i18n-aria
export function translateDom(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", tr(el.dataset.i18nAria!)));
}
