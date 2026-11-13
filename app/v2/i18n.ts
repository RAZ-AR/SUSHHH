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
  sending: [" · sending to the air", " · отправляется в эфир", " · wird ins Live gesendet", " · enviando al directo", " · envoi vers le direct"],
  queued: [" · will go on air when you're back online", " · уйдёт в эфир, когда появится связь", " · geht ins Live, sobald du wieder online bist", " · saldrá al directo cuando vuelva la conexión", " · partira en direct dès que la connexion revient"],
  published: ["Your voice is on air", "Твой голос в эфире", "Deine Stimme ist im Live", "Tu voz está en directo", "Ta voix est en direct"],
  untitled: ["a voice without a caption", "голос без подписи", "Stimme ohne Titel", "voz sin título", "voix sans titre"],
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
  // согласие перед первой записью
  consentTitle: ["Before your first recording", "Перед первой записью", "Vor deiner ersten Aufnahme", "Antes de tu primera grabación", "Avant ton premier enregistrement"],
  consent1: ["Your voice is personal data. A published recording is heard by other people on air and kept on the server until you delete it.", "Твой голос — личные данные. Опубликованную запись услышат другие люди в эфире; она хранится на сервере, пока ты её не удалишь.", "Deine Stimme sind persönliche Daten. Eine veröffentlichte Aufnahme hören andere im Live; sie bleibt auf dem Server, bis du sie löschst.", "Tu voz es un dato personal. Una grabación publicada la escuchan otras personas en directo y se guarda en el servidor hasta que la borres.", "Ta voix est une donnée personnelle. Un enregistrement publié est entendu en direct et reste sur le serveur jusqu'à ce que tu le supprimes."],
  consent2: ["You can delete any recording, or all your data at once, in Mine.", "Любую запись или все данные сразу можно удалить в «Моё».", "Jede Aufnahme oder alle Daten auf einmal kannst du in „Meins“ löschen.", "Puedes borrar cualquier grabación, o todos tus datos a la vez, en «Lo mío».", "Tu peux supprimer n'importe quel enregistrement, ou toutes tes données d'un coup, dans « À moi »."],
  consent3: ["Don't say other people's names, addresses or phone numbers, and don't record anyone without their consent.", "Не называй чужих имён, адресов и телефонов и не записывай людей без их согласия.", "Nenne keine fremden Namen, Adressen oder Telefonnummern und nimm niemanden ohne Zustimmung auf.", "No digas nombres, direcciones ni teléfonos de otras personas, ni grabes a nadie sin su permiso.", "Ne donne pas les noms, adresses ou numéros d'autres personnes, et n'enregistre personne sans son accord."],
  consent4: ["Insults, threats and sexual content are removed, and their authors are blocked.", "Оскорбления, угрозы и сексуальный контент удаляются, а их авторы блокируются.", "Beleidigungen, Drohungen und sexuelle Inhalte werden entfernt, ihre Urheber gesperrt.", "Los insultos, amenazas y contenido sexual se eliminan y se bloquea a quien los publica.", "Les insultes, menaces et contenus sexuels sont supprimés, et leurs auteurs bloqués."],
  ageConfirm: ["I'm {age} or older", "Мне {age} или больше", "Ich bin {age} oder älter", "Tengo {age} años o más", "J'ai {age} ans ou plus"],
  consentAgree: ["Agree and record", "Принимаю и записываю", "Zustimmen und aufnehmen", "Acepto y grabo", "J'accepte et j'enregistre"],
  notNow: ["Not now", "Не сейчас", "Nicht jetzt", "Ahora no", "Pas maintenant"],
  ageNeeded: ["Confirm your age to record", "Подтверди возраст, чтобы записывать", "Bestätige dein Alter, um aufzunehmen", "Confirma tu edad para grabar", "Confirme ton âge pour enregistrer"],
  // конфиденциальность и правила
  privacy: ["Privacy and rules", "Конфиденциальность и правила", "Datenschutz und Regeln", "Privacidad y normas", "Confidentialité et règles"],
  myData: ["My data", "Мои данные", "Meine Daten", "Mis datos", "Mes données"],
  pStoredH: ["What is kept", "Что хранится", "Was gespeichert wird", "Qué se guarda", "Ce qui est gardé"],
  pStored: ["Published recordings, your pseudonym and reactions — on the server. Who you hid or blocked, your theme and consent — only on this phone. Reports go to moderators.", "Опубликованные записи, псевдоним и реакции — на сервере. Кого ты скрыл или заблокировал, тема и согласие — только на этом телефоне. Жалобы уходят модераторам.", "Veröffentlichte Aufnahmen, Pseudonym und Reaktionen — auf dem Server. Wen du ausgeblendet oder blockiert hast, Design und Zustimmung — nur auf diesem Telefon. Meldungen gehen an die Moderation.", "Grabaciones publicadas, seudónimo y reacciones: en el servidor. A quién ocultaste o bloqueaste, el tema y el consentimiento: solo en este teléfono. Las denuncias van a moderación.", "Enregistrements publiés, pseudonyme et réactions — sur le serveur. Qui tu as masqué ou bloqué, le thème et ton accord — seulement sur ce téléphone. Les signalements vont à la modération."],
  pHearH: ["Who hears", "Кто слышит", "Wer zuhört", "Quién escucha", "Qui écoute"],
  pHear: ["Published recordings are heard by people on air. Authors never learn who reported or blocked them.", "Опубликованные записи слышат люди в эфире. Автор не узнаёт, кто на него пожаловался или заблокировал.", "Veröffentlichte Aufnahmen hören Menschen im Live. Niemand erfährt, wer gemeldet oder blockiert hat.", "Las grabaciones publicadas las escucha la gente en directo. Nadie sabe quién le denunció o bloqueó.", "Les enregistrements publiés sont entendus en direct. Personne ne sait qui l'a signalé ou bloqué."],
  pDeleteH: ["Deleting", "Удаление", "Löschen", "Borrar", "Suppression"],
  pDelete: ["One recording — with the bin button. Everything at once — at the bottom of Mine. It can't be undone.", "Одну запись — кнопкой с корзиной. Всё сразу — внизу «Моё». Вернуть нельзя.", "Eine Aufnahme — mit dem Papierkorb. Alles auf einmal — unten in „Meins“. Lässt sich nicht rückgängig machen.", "Una grabación, con la papelera. Todo a la vez, al final de «Lo mío». No se puede deshacer.", "Un enregistrement — avec la corbeille. Tout d'un coup — en bas de « À moi ». Impossible d'annuler."],
  pRulesH: ["Rules on air", "Правила эфира", "Regeln im Live", "Normas del directo", "Règles du direct"],
  pRules: ["No insults, threats, sexual content or other people's personal data. Such recordings are removed. If someone may be in danger — report it with “The author may need help”.", "Без оскорблений, угроз, сексуального контента и чужих личных данных — такие записи удаляются. Если кому-то может грозить опасность — пожалуйся с причиной «Автору может быть нужна помощь».", "Keine Beleidigungen, Drohungen, sexuellen Inhalte oder fremden persönlichen Daten — solche Aufnahmen werden entfernt. Ist jemand in Gefahr, melde es mit „Die Person braucht vielleicht Hilfe“.", "Sin insultos, amenazas, contenido sexual ni datos personales ajenos: esas grabaciones se eliminan. Si alguien puede estar en peligro, denúncialo con «Quien habla puede necesitar ayuda».", "Pas d'insultes, de menaces, de contenus sexuels ni de données personnelles d'autrui — ces enregistrements sont supprimés. Si quelqu'un est peut-être en danger, signale-le avec « La personne a peut-être besoin d'aide »."],
  pAgeH: ["Age", "Возраст", "Alter", "Edad", "Âge"],
  pAge: ["SUSHHH is for people aged {age} and over.", "SUSHHH — для тех, кому {age} и больше.", "SUSHHH ist für Menschen ab {age} Jahren.", "SUSHHH es para personas de {age} años o más.", "SUSHHH est pour les personnes de {age} ans et plus."],
  // удаление
  deleteMine: ["Delete all my recordings", "Удалить все мои записи", "Alle meine Aufnahmen löschen", "Borrar todas mis grabaciones", "Supprimer tous mes enregistrements"],
  deleteMineTitle: ["Delete all your recordings?", "Удалить все твои записи?", "Alle deine Aufnahmen löschen?", "¿Borrar todas tus grabaciones?", "Supprimer tous tes enregistrements ?"],
  deleteMineSub: ["Posts and replies you recorded disappear from this phone. This can't be undone.", "Посты и ответы, которые ты записал, исчезнут с этого телефона. Вернуть нельзя.", "Deine Beiträge und Antworten verschwinden von diesem Telefon. Das lässt sich nicht rückgängig machen.", "Tus publicaciones y respuestas desaparecerán de este teléfono. No se puede deshacer.", "Tes posts et réponses disparaîtront de ce téléphone. Impossible d'annuler."],
  deleteMineYes: ["Delete recordings", "Удалить записи", "Aufnahmen löschen", "Borrar grabaciones", "Supprimer les enregistrements"],
  deletedMine: ["Your recordings are deleted", "Твои записи удалены", "Deine Aufnahmen sind gelöscht", "Tus grabaciones se han borrado", "Tes enregistrements sont supprimés"],
  eraseAll: ["Delete all my data", "Удалить все мои данные", "Alle meine Daten löschen", "Borrar todos mis datos", "Supprimer toutes mes données"],
  eraseTitle: ["Delete all your data?", "Удалить все твои данные?", "Alle deine Daten löschen?", "¿Borrar todos tus datos?", "Supprimer toutes tes données ?"],
  eraseSub: ["Your published voices, pseudonym and reactions on the server; recordings, consent, theme, hidden and blocked people, reports on this phone. The language stays. This can't be undone.", "Твои голоса, псевдоним и реакции на сервере; записи, согласие, тема, скрытое и заблокированное, жалобы на этом телефоне. Язык останется. Вернуть нельзя.", "Deine Stimmen, dein Pseudonym und deine Reaktionen auf dem Server; Aufnahmen, Zustimmung, Design, Ausgeblendetes und Blockierte, Meldungen auf diesem Telefon. Die Sprache bleibt. Lässt sich nicht rückgängig machen.", "Tus voces, seudónimo y reacciones en el servidor; grabaciones, consentimiento, tema, lo oculto y bloqueado y denuncias en este teléfono. El idioma se queda. No se puede deshacer.", "Tes voix, ton pseudonyme et tes réactions sur le serveur ; enregistrements, accord, thème, masqués et bloqués, signalements sur ce téléphone. La langue reste. Impossible d'annuler."],
  eraseYes: ["Delete everything", "Удалить всё", "Alles löschen", "Borrarlo todo", "Tout supprimer"],
  // подсказка жестов и кнопки для экранного диктора
  coachTitle: ["How to listen", "Как слушать", "So hörst du zu", "Cómo escuchar", "Comment écouter"],
  tipSwipe: ["Swipe up or down — next or previous voice", "Смахни вверх или вниз — следующий или предыдущий голос", "Nach oben oder unten wischen — nächste oder vorherige Stimme", "Desliza arriba o abajo: voz siguiente o anterior", "Glisse vers le haut ou le bas — voix suivante ou précédente"],
  tipSide: ["Swipe sideways — another channel", "Смахни вбок — другой канал", "Zur Seite wischen — anderer Kanal", "Desliza de lado: otro canal", "Glisse sur le côté — autre chaîne"],
  tipTap: ["Tap the oval — pause or play", "Коснись овала — пауза или «играть»", "Tippe aufs Oval — Pause oder Wiedergabe", "Toca el óvalo: pausa o reproducir", "Touche l'ovale — pause ou lecture"],
  tipTape: ["Drag the wave beside the oval — rewind", "Тяни волну по краям от овала — перемотка", "Zieh die Welle neben dem Oval — spulen", "Arrastra la onda junto al óvalo: rebobinar", "Fais glisser l'onde à côté de l'ovale — avancer ou reculer"],
  prevVoice: ["Previous voice", "Предыдущий голос", "Vorherige Stimme", "Voz anterior", "Voix précédente"],
  nextVoice: ["Next voice", "Следующий голос", "Nächste Stimme", "Voz siguiente", "Voix suivante"],
  playVoice: ["Play", "Слушать", "Abspielen", "Reproducir", "Écouter"],
  pauseVoice: ["Pause", "Пауза", "Pause", "Pausa", "Pause"],
  solidMode: ["Clear mode: no transparency, higher contrast", "Чёткий режим: без прозрачности, выше контраст", "Klarer Modus: ohne Transparenz, mehr Kontrast", "Modo nítido: sin transparencias, más contraste", "Mode net : sans transparence, contraste renforcé"],
  voiceLangs: ["Voice languages", "Языки голосов", "Sprachen der Stimmen", "Idiomas de las voces", "Langues des voix"],
  voiceLangsNote: ["Voices in other languages stay off your air. Voices without a language mark are always heard.", "Голоса на других языках не попадут в эфир. Голоса без отметки языка слышны всегда.", "Stimmen in anderen Sprachen kommen nicht in dein Live. Stimmen ohne Sprachangabe hörst du immer.", "Las voces en otros idiomas no saldrán en tu directo. Las voces sin idioma marcado se oyen siempre.", "Les voix dans d'autres langues restent hors de ton direct. Les voix sans langue indiquée sont toujours entendues."],
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
