// Локализация интерфейса: английский, русский, немецкий, испанский, французский.
// Записи и расшифровки — контент людей, их не переводим. Язык — из системы,
// выбор сохраняется. Множественное число и «назад» — через Intl, без своих правил.
// Тексты нейтральны по роду: обращаемся на «ты», о других — «автор», «человек».

export type Lang = "en" | "ru" | "de" | "es" | "fr";

export const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "ru", name: "Русский" },
  { id: "de", name: "Deutsch" },
  { id: "es", name: "Español" },
  { id: "fr", name: "Français" },
];

const KEY = "sushhh.lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.id === saved)) return saved;
  } catch {
    // без хранилища — по системе
  }
  for (const pref of navigator.languages ?? [navigator.language]) {
    const code = pref.slice(0, 2).toLowerCase() as Lang;
    if (LANGS.some((l) => l.id === code)) return code;
  }
  return "en";
}

export const lang: Lang = detect();
document.documentElement.lang = lang;

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // не сохранится — но язык сменится до перезагрузки
  }
  location.reload();
}

// язык распознавания речи при записи
export const speechLang = { en: "en-US", ru: "ru-RU", de: "de-DE", es: "es-ES", fr: "fr-FR" }[lang];

type Row = [en: string, ru: string, de: string, es: string, fr: string];
const COL: Record<Lang, number> = { en: 0, ru: 1, de: 2, es: 3, fr: 4 };

const D: Record<string, Row> = {
  // каналы
  "chan.foryou": ["For you", "Для тебя", "Für dich", "Para ti", "Pour toi"],
  "chan.new": ["New", "Новое", "Neu", "Nuevo", "Nouveau"],
  "chan.qod": ["Question of the day", "Вопрос дня", "Frage des Tages", "Pregunta del día", "Question du jour"],
  "chan.confess": ["Confessions & thoughts", "Признания и мысли", "Geständnisse & Gedanken", "Confesiones y pensamientos", "Confidences et pensées"],
  "chan.stories": ["Stories", "Истории", "Geschichten", "Historias", "Histoires"],
  "chan.city": ["City", "Город", "Stadt", "Ciudad", "Ville"],
  "air": ["On air", "Эфир", "Live", "Emisión", "Direct"],
  "listenWhat": ["What to listen to", "Что слушаем", "Was hörst du?", "¿Qué escuchamos?", "On écoute quoi ?"],
  // разделы и подписи для экранных читалок
  "more": ["More", "Ещё", "Mehr", "Más", "Plus"],
  "storiesAria": ["Discussed now", "Обсуждают сейчас", "Gerade im Gespräch", "Se comenta ahora", "En discussion"],
  "stageAria": [
    "Voice: tap to pause, swipe up for next, double tap for a heart",
    "Голос: тап — пауза, свайп вверх — дальше, двойной тап — сердце",
    "Stimme: Tippen pausiert, nach oben wischen für weiter, Doppeltippen für ein Herz",
    "Voz: toca para pausar, desliza hacia arriba para la siguiente, doble toque para un corazón",
    "Voix : touche pour mettre en pause, glisse vers le haut pour la suivante, double touche pour un cœur",
  ],
  "startAria": ["Listen", "Слушать эфир", "Anhören", "Escuchar", "Écouter"],
  "hairAria": ["Position in the post", "Позиция в записи", "Position im Beitrag", "Posición en la publicación", "Position dans le post"],
  "hookAria": ["Show transcript", "Показать расшифровку", "Transkript anzeigen", "Mostrar transcripción", "Afficher la transcription"],
  "heartAria": [
    "Heart. Hold for more reactions",
    "Сердце. Удерживай — другие реакции",
    "Herz. Halten für weitere Reaktionen",
    "Corazón. Mantén para más reacciones",
    "Cœur. Maintiens pour d'autres réactions",
  ],
  "threadAria": ["Whole thread", "Ветка целиком", "Ganzer Thread", "Hilo completo", "Fil entier"],
  "laterAria": ["Reply later", "Ответить позже", "Später antworten", "Responder más tarde", "Répondre plus tard"],
  "replyAria": ["Reply with your voice", "Ответить голосом", "Mit deiner Stimme antworten", "Responder con tu voz", "Répondre avec ta voix"],
  "sectionsAria": ["Sections", "Разделы", "Bereiche", "Secciones", "Sections"],
  "tabRec": ["Record", "Записать", "Aufnehmen", "Grabar", "Enregistrer"],
  "tabMine": ["Mine", "Моё", "Meins", "Lo mío", "À moi"],
  "tabToMe": ["Replies to me", "Ответы мне", "Antworten an mich", "Respuestas para mí", "Réponses pour moi"],
  "tabPosts": ["My posts & threads", "Мои записи и ветки", "Meine Beiträge & Threads", "Mis publicaciones e hilos", "Mes posts et fils"],
  "tabSounds": ["Sounds from my posts", "Звуки из моих записей", "Sounds aus meinen Beiträgen", "Sonidos de mis publicaciones", "Sons de mes posts"],
  "tabBlocked": ["Blocked", "Заблокированные", "Blockiert", "Bloqueados", "Bloqués"],
  "close": ["Close", "Закрыть", "Schließen", "Cerrar", "Fermer"],
  "again": ["Record again", "Записать заново", "Neu aufnehmen", "Grabar de nuevo", "Réenregistrer"],
  "listenBack": ["Listen back", "Прослушать", "Anhören", "Escuchar", "Réécouter"],
  "publish": ["Publish", "Опубликовать", "Veröffentlichen", "Publicar", "Publier"],
  "cancel": ["Cancel", "Отмена", "Abbrechen", "Cancelar", "Annuler"],
  "backHome": ["Back to on air", "Назад в эфир", "Zurück zum Live", "Volver a la emisión", "Retour au direct"],
  "backMine": ["Back to Mine", "Назад в «Моё»", "Zurück zu „Meins“", "Volver a «Lo mío»", "Retour à « À moi »"],
  "language": ["Language", "Язык", "Sprache", "Idioma", "Langue"],
  // эфир
  "transcriptPending": [
    "The transcript will appear after processing.",
    "Расшифровка появится после обработки.",
    "Das Transkript erscheint nach der Verarbeitung.",
    "La transcripción aparecerá tras el procesamiento.",
    "La transcription apparaîtra après le traitement.",
  ],
  "noReplies": [
    "No replies yet — start the conversation",
    "Ответов пока нет — начни разговор",
    "Noch keine Antworten – starte das Gespräch",
    "Aún no hay respuestas — empieza la conversación",
    "Pas encore de réponses — lance la conversation",
  ],
  "holdHeart": [
    "Hold ♡ for more reactions",
    "Удерживай ♡ — другие реакции",
    "Halte ♡ für weitere Reaktionen",
    "Mantén ♡ para más reacciones",
    "Maintiens ♡ pour d'autres réactions",
  ],
  "soundAria": ["Sound “{name}”", "Звук «{name}»", "Sound „{name}“", "Sonido «{name}»", "Son « {name} »"],
  "savedLater": ["Saved to Mine", "Сохранено в «Моё»", "In „Meins“ gespeichert", "Guardado en «Lo mío»", "Enregistré dans « À moi »"],
  "removedLater": ["Removed from Later", "Убрано из «позже»", "Aus „Später“ entfernt", "Quitado de «Más tarde»", "Retiré de « Plus tard »"],
  // «⋯»
  "speed": ["Speed {x}×", "Скорость {x}×", "Tempo {x}×", "Velocidad {x}×", "Vitesse {x}×"],
  "makeSound": [
    "Make a sound from this moment",
    "Сделать звук из этого момента",
    "Sound aus diesem Moment machen",
    "Crear un sonido de este momento",
    "Créer un son à partir de ce moment",
  ],
  "deletePost": ["Delete post", "Удалить запись", "Beitrag löschen", "Eliminar publicación", "Supprimer le post"],
  "report": ["Report", "Пожаловаться", "Melden", "Denunciar", "Signaler"],
  "hide": ["Hide this post", "Скрыть эту запись", "Diesen Beitrag ausblenden", "Ocultar esta publicación", "Masquer ce post"],
  "hidden": ["Post hidden", "Запись скрыта", "Beitrag ausgeblendet", "Publicación oculta", "Post masqué"],
  "blockNamed": ["Block {name}", "Заблокировать {name}", "{name} blockieren", "Bloquear a {name}", "Bloquer {name}"],
  // жалоба
  "reason.abuse": ["Insults or bullying", "Оскорбления или травля", "Beleidigung oder Mobbing", "Insultos o acoso", "Insultes ou harcèlement"],
  "reason.danger": ["Threats or dangerous acts", "Угрозы или опасные действия", "Drohungen oder gefährliche Handlungen", "Amenazas o actos peligrosos", "Menaces ou actes dangereux"],
  "reason.sexual": ["Sexual content", "Сексуальный контент", "Sexuelle Inhalte", "Contenido sexual", "Contenu sexuel"],
  "reason.personal": ["Personal data exposed", "Раскрыты личные данные", "Persönliche Daten offengelegt", "Datos personales expuestos", "Données personnelles divulguées"],
  "reason.spam": ["Spam or ads", "Спам или реклама", "Spam oder Werbung", "Spam o publicidad", "Spam ou publicité"],
  "reason.crisis": [
    "The author may need help",
    "Автору может быть нужна помощь",
    "Die Person braucht vielleicht Hilfe",
    "Quien habla puede necesitar ayuda",
    "La personne a peut-être besoin d'aide",
  ],
  "reason.other": ["Other", "Другое", "Anderes", "Otro", "Autre"],
  "reportTitle": ["What's wrong?", "Что не так?", "Was stimmt nicht?", "¿Qué pasa?", "Quel est le problème ?"],
  "thanks": ["Thanks for letting us know", "Спасибо за сигнал", "Danke für den Hinweis", "Gracias por avisar", "Merci du signalement"],
  "crisisNote": [
    "Moderators will look at this post first. If someone is in danger right now, call 112 or your local emergency number.",
    "Модераторы посмотрят эту запись в первую очередь. Если кому-то угрожает опасность прямо сейчас — звони 112 или в местную экстренную службу.",
    "Die Moderation sieht sich diesen Beitrag zuerst an. Wenn gerade jemand in Gefahr ist, ruf 112 oder den örtlichen Notruf.",
    "Moderación revisará esta publicación primero. Si alguien está en peligro ahora mismo, llama al 112 o a tu número de emergencias local.",
    "La modération examinera ce post en priorité. Si quelqu'un est en danger maintenant, appelle le 112 ou les secours locaux.",
  ],
  "gotIt": ["Got it", "Понятно", "Verstanden", "Entendido", "Compris"],
  "reported": ["Report sent", "Жалоба отправлена", "Meldung gesendet", "Denuncia enviada", "Signalement envoyé"],
  "reportNote": [
    "The author won't know who reported. The post will disappear from your feed.",
    "Автор не узнает, кто пожаловался. Запись пропадёт из твоего эфира.",
    "Die Person erfährt nicht, wer gemeldet hat. Der Beitrag verschwindet aus deinem Feed.",
    "Nadie sabrá quién denunció. La publicación desaparecerá de tu emisión.",
    "L'auteur ne saura pas qui a signalé. Le post disparaîtra de ton fil.",
  ],
  "blockTitle": ["Block {name}?", "Заблокировать {name}?", "{name} blockieren?", "¿Bloquear a {name}?", "Bloquer {name} ?"],
  "blockSub": [
    "Their posts and replies will disappear from your feed. You can undo this in Mine.",
    "Записи и ответы этого человека пропадут из твоего эфира. Вернуть можно в «Моё».",
    "Beiträge und Antworten dieser Person verschwinden aus deinem Feed. Rückgängig machen kannst du das in „Meins“.",
    "Sus publicaciones y respuestas desaparecerán de tu emisión. Puedes deshacerlo en «Lo mío».",
    "Ses posts et réponses disparaîtront de ton fil. Tu peux annuler dans « À moi ».",
  ],
  "block": ["Block", "Заблокировать", "Blockieren", "Bloquear", "Bloquer"],
  "blocked": ["{name} is blocked", "{name} — в блоке", "{name} ist blockiert", "Has bloqueado a {name}", "Tu as bloqué {name}"],
  "deleteTitle": ["Delete post?", "Удалить запись?", "Beitrag löschen?", "¿Eliminar la publicación?", "Supprimer le post ?"],
  "deleteSub": [
    "Other people's replies stay, marked “original post deleted”.",
    "Ответы других людей останутся с пометкой «исходная запись удалена».",
    "Antworten anderer bleiben mit dem Hinweis „Originalbeitrag gelöscht“.",
    "Las respuestas de otras personas se quedan con la marca «publicación original eliminada».",
    "Les réponses des autres restent, marquées « post d'origine supprimé ».",
  ],
  "deleteForever": ["Delete forever", "Удалить навсегда", "Endgültig löschen", "Eliminar para siempre", "Supprimer définitivement"],
  "deleted": ["Post deleted", "Запись удалена", "Beitrag gelöscht", "Publicación eliminada", "Post supprimé"],
  // звуки сообщества
  "cantOpen": ["Couldn't open the post", "Не получилось открыть запись", "Beitrag konnte nicht geöffnet werden", "No se pudo abrir la publicación", "Impossible d'ouvrir le post"],
  "iconAria": ["Icon {x}", "Значок {x}", "Symbol {x}", "Icono {x}", "Icône {x}"],
  "makeDo": ["Make sound", "Сделать звук", "Sound erstellen", "Crear sonido", "Créer le son"],
  "makeAllowed": [
    "The author allows sounds — it appears in the fan right away.",
    "Автор разрешает звуки — появится в веере сразу.",
    "Die Person erlaubt Sounds – er erscheint sofort im Fächer.",
    "Quien publicó permite sonidos: aparecerá enseguida.",
    "L'auteur autorise les sons — il apparaîtra tout de suite.",
  ],
  "makeAsk": [
    "We'll ask the author — the sound appears once they allow it.",
    "Спросим автора — звук появится, когда автор разрешит.",
    "Wir fragen die Person – der Sound erscheint, sobald sie zustimmt.",
    "Preguntaremos a quien publicó: el sonido aparecerá cuando lo permita.",
    "On demande à l'auteur — le son apparaîtra après son accord.",
  ],
  "inFan": ["{icon} is now in the fan", "{icon} теперь в веере", "{icon} ist jetzt im Fächer", "{icon} ya está en el abanico", "{icon} est maintenant dans l'éventail"],
  "asked": ["Author asked", "Спросили автора", "Person gefragt", "Pregunta enviada", "Demande envoyée"],
  "approved": ["{icon} “{name}” — approved", "{icon} «{name}» — звук одобрен", "{icon} „{name}“ – freigegeben", "{icon} «{name}» — aprobado", "{icon} « {name} » — approuvé"],
  "makeTitle": ["New sound", "Новый звук", "Neuer Sound", "Nuevo sonido", "Nouveau son"],
  "makeSub": [
    "A piece of this post becomes a reaction for everyone.",
    "Кусок этой записи станет реакцией для всех.",
    "Ein Stück dieses Beitrags wird zur Reaktion für alle.",
    "Un trozo de esta publicación será una reacción para todos.",
    "Un extrait de ce post devient une réaction pour tous.",
  ],
  "sndRequests": ["Asking for a sound", "Просят сделать звук", "Sound-Anfragen", "Piden un sonido", "Demandes de son"],
  "sndWants": ["{name} wants a sound", "{name} хочет звук", "{name} möchte einen Sound", "{name} quiere un sonido", "{name} veut un son"],
  "listen": ["Listen", "Послушать", "Anhören", "Escuchar", "Écouter"],
  "decline": ["Decline", "Отказать", "Ablehnen", "Rechazar", "Refuser"],
  "declined": ["Declined", "Отказано", "Abgelehnt", "Rechazado", "Refusé"],
  "allow": ["Allow", "Разрешить", "Erlauben", "Permitir", "Autoriser"],
  "nowCommunity": ["{icon} is now a community sound", "{icon} теперь звук сообщества", "{icon} ist jetzt ein Community-Sound", "{icon} ya es un sonido de la comunidad", "{icon} est maintenant un son de la communauté"],
  "yourSounds": ["Your sounds", "Твои звуки", "Deine Sounds", "Tus sonidos", "Tes sons"],
  "notPlayed": ["not played yet", "ещё не звучал", "noch nie gespielt", "aún no ha sonado", "pas encore joué"],
  "revoke": ["Revoke", "Отозвать", "Zurückziehen", "Retirar", "Retirer"],
  "revoked": ["Sound revoked", "Звук отозван", "Sound zurückgezogen", "Sonido retirado", "Son retiré"],
  "allowNoAsk": ["Allow sounds without asking", "Разрешать звуки без вопроса", "Sounds ohne Nachfrage erlauben", "Permitir sonidos sin preguntar", "Autoriser les sons sans demander"],
  "allowNoAskAria": [
    "Allow sounds from my posts without asking",
    "Разрешать звуки из моих записей без вопроса",
    "Sounds aus meinen Beiträgen ohne Nachfrage erlauben",
    "Permitir sonidos de mis publicaciones sin preguntar",
    "Autoriser les sons de mes posts sans demander",
  ],
  // моё
  "newAria": [", new", ", новое", ", neu", ", nuevo", ", nouveau"],
  "noNew": ["No new replies", "Новых ответов нет", "Keine neuen Antworten", "No hay respuestas nuevas", "Pas de nouvelles réponses"],
  "emptyToMe": [
    "Reply to someone or record something — replies will show up here",
    "Ответь кому-нибудь или запиши своё — ответы появятся здесь",
    "Antworte jemandem oder nimm etwas auf – Antworten erscheinen hier",
    "Responde a alguien o graba algo: las respuestas aparecerán aquí",
    "Réponds à quelqu'un ou enregistre — les réponses apparaîtront ici",
  ],
  "emptyLater": [
    "Tap the clock while listening — the post will wait for you here",
    "Нажми часы во время прослушивания — запись подождёт тебя здесь",
    "Tippe beim Hören auf die Uhr – der Beitrag wartet hier auf dich",
    "Toca el reloj mientras escuchas: la publicación te esperará aquí",
    "Touche l'horloge pendant l'écoute — le post t'attendra ici",
  ],
  "emptyPosts": [
    "No posts yet. Mic below — up to 30 seconds",
    "Своих записей пока нет. Микрофон внизу — до 30 секунд",
    "Noch keine Beiträge. Mikro unten – bis zu 30 Sekunden",
    "Aún no hay publicaciones. Micro abajo: hasta 30 segundos",
    "Pas encore de posts. Micro en bas — jusqu'à 30 secondes",
  ],
  "emptyBlocked": [
    "Nobody. You can block via “⋯” on air",
    "Никого. Заблокировать можно через «⋯» в эфире",
    "Niemand. Blockieren geht über „⋯“ im Live",
    "Nadie. Puedes bloquear con «⋯» en la emisión",
    "Personne. Tu peux bloquer via « ⋯ » au direct",
  ],
  "emptySounds": [
    "When someone wants a sound from your post, you'll decide here",
    "Когда кто-то захочет сделать звук из твоей записи, ты решишь здесь",
    "Wenn jemand einen Sound aus deinem Beitrag möchte, entscheidest du hier",
    "Cuando alguien quiera un sonido de tu publicación, lo decidirás aquí",
    "Quand quelqu'un voudra un son de ton post, tu décideras ici",
  ],
  "you": ["you", "ты", "du", "tú", "toi"],
  "unblock": ["Unblock", "Вернуть", "Entsperren", "Desbloquear", "Débloquer"],
  "unblocked": ["{name} is back", "{name} — снова в эфире", "{name} ist zurück", "{name} vuelve a tu emisión", "{name} est de retour"],
  // запись
  "upTo": ["up to {n} s", "до {n} с", "bis {n} s", "hasta {n} s", "jusqu'à {n} s"],
  "stopRec": ["Stop recording", "Остановить запись", "Aufnahme stoppen", "Detener grabación", "Arrêter l'enregistrement"],
  "startRec": ["Start recording", "Начать запись", "Aufnahme starten", "Empezar a grabar", "Commencer l'enregistrement"],
  "recHint": ["Tap or hold", "Нажми или удерживай", "Tippen oder halten", "Toca o mantén", "Touche ou maintiens"],
  "recReplyHeard": ["The author will hear your reply", "Ответ услышит автор", "Die Person hört deine Antwort", "Quien publicó oirá tu respuesta", "L'auteur entendra ta réponse"],
  "recOnAir": ["24 hours on air", "24 часа в эфире", "24 Stunden live", "24 horas en emisión", "24 heures à l'antenne"],
  "recLeft": ["{n} s left", "ещё {n} с", "noch {n} s", "quedan {n} s", "encore {n} s"],
  "needMic": ["Microphone access needed", "Нужен доступ к микрофону", "Mikrofonzugriff nötig", "Se necesita acceso al micrófono", "Accès au micro nécessaire"],
  "tooShort": ["Too short — say a few words", "Слишком коротко — скажи пару слов", "Zu kurz – sag ein paar Worte", "Demasiado corto: di unas palabras", "Trop court — dis quelques mots"],
  "replySent": ["Reply sent", "Ответ отправлен", "Antwort gesendet", "Respuesta enviada", "Réponse envoyée"],
  "onAirNow": ["On air", "В эфире", "Live", "En emisión", "À l'antenne"],
  // подписи по умолчанию
  "replyFallback": ["Reply", "Ответ", "Antwort", "Respuesta", "Réponse"],
  "yourReply": ["Your reply", "Твой ответ", "Deine Antwort", "Tu respuesta", "Ta réponse"],
  "yourPost": ["Your post", "Твоя запись", "Dein Beitrag", "Tu publicación", "Ton post"],
  // реакции и мемы
  // личный кабинет
  "profile": ["Profile", "Профиль", "Profil", "Perfil", "Profil"],
  "openProfile": ["Open your profile", "Открыть профиль", "Profil öffnen", "Abrir tu perfil", "Ouvrir ton profil"],
  "meOrbAria": ["Your voice character. Tap to say hi", "Твой персонаж голоса. Коснись — поздоровается", "Deine Stimmfigur. Tippen zum Begrüßen", "Tu personaje de voz. Tócalo para saludar", "Ton personnage de voix. Touche pour dire bonjour"],
  "newName": ["New pseudonym", "Новый псевдоним", "Neues Pseudonym", "Nuevo seudónimo", "Nouveau pseudonyme"],
  "nowName": ["Now you are {name}", "Теперь ты — {name}", "Jetzt bist du {name}", "Ahora eres {name}", "Tu es maintenant {name}"],
  "nameNote": ["Nobody sees your real name. Your color follows your pseudonym.", "Настоящее имя никто не видит. Цвет голоса идёт за псевдонимом.", "Niemand sieht deinen echten Namen. Deine Farbe folgt dem Pseudonym.", "Nadie ve tu nombre real. Tu color sigue a tu seudónimo.", "Personne ne voit ton vrai nom. Ta couleur suit ton pseudonyme."],
  "statsAria": ["Your activity", "Твоя активность", "Deine Aktivität", "Tu actividad", "Ton activité"],
  "blockedN": ["Blocked · {n}", "Заблокированные · {n}", "Blockiert · {n}", "Bloqueados · {n}", "Bloqués · {n}"],
  "unblockHint": ["Tap a name to unblock", "Коснись имени, чтобы разблокировать", "Tippe auf einen Namen zum Entsperren", "Toca un nombre para desbloquear", "Touche un nom pour débloquer"],
  "deleteAll": ["Delete all my posts", "Удалить все мои записи", "Alle meine Aufnahmen löschen", "Borrar todas mis grabaciones", "Supprimer tous mes enregistrements"],
  "deleteAllTitle": ["Delete all your posts?", "Удалить все твои записи?", "Alle deine Aufnahmen löschen?", "¿Borrar todas tus grabaciones?", "Supprimer tous tes enregistrements ?"],
  "deleteAllSub": ["Replies and reactions under them go too. This can't be undone.", "Ответы и реакции под ними тоже исчезнут. Вернуть нельзя.", "Antworten und Reaktionen darunter verschwinden auch. Das lässt sich nicht rückgängig machen.", "Las respuestas y reacciones también desaparecen. No se puede deshacer.", "Les réponses et réactions disparaissent aussi. Impossible d'annuler."],
  "deletedAll": ["Your posts are deleted", "Твои записи удалены", "Deine Aufnahmen sind gelöscht", "Tus grabaciones se borraron", "Tes enregistrements sont supprimés"],
  "deleteAccount": ["Delete account", "Удалить аккаунт", "Konto löschen", "Eliminar cuenta", "Supprimer le compte"],
  "deleteAccountTitle": ["Delete your account?", "Удалить аккаунт?", "Konto löschen?", "¿Eliminar tu cuenta?", "Supprimer ton compte ?"],
  "deleteAccountSub": ["Your pseudonym, posts, reactions and settings are erased. This can't be undone.", "Псевдоним, записи, реакции и настройки сотрутся. Вернуть нельзя.", "Pseudonym, Aufnahmen, Reaktionen und Einstellungen werden gelöscht. Das lässt sich nicht rückgängig machen.", "Se borran tu seudónimo, grabaciones, reacciones y ajustes. No se puede deshacer.", "Ton pseudonyme, tes enregistrements, réactions et réglages seront effacés. Impossible d'annuler."],
  "r.❤️": ["heart", "сердце", "Herz", "corazón", "cœur"],
  "r.😂": ["laugh", "смех", "Lachen", "risa", "rire"],
  "r.🤗": ["hug", "обнять", "Umarmung", "abrazo", "câlin"],
  "r.🔥": ["fire", "огонь", "Feuer", "fuego", "feu"],
  "r.😮": ["wow", "вау", "Wow", "guau", "waouh"],
  "r.👏": ["applause", "аплодисменты", "Applaus", "aplausos", "applaudissements"],
  "r.🥁": ["ba-dum-tss", "ба-дум-тсс", "Ba-dum-tss", "ba-dum-tss", "ba-dum-tss"],
  "r.🎺": ["sad trombone", "грустный тромбон", "traurige Posaune", "trombón triste", "trombone triste"],
  "r.🦗": ["crickets", "сверчки", "Grillen", "grillos", "criquets"],
  "r.😱": ["dun-dun-dunn", "дун-дун-дуун", "Dun-dun-dunn", "dun-dun-dun", "dun-dun-dunn"],
  "r.📯": ["air horn", "клаксон", "Fanfare", "bocina", "klaxon"],
  "r.🎉": ["ta-da", "та-да", "Ta-da", "ta-chán", "tadam"],
};

// множественное число: формы по категориям Intl.PluralRules (one / few / many / other)
const P: Record<string, Partial<Record<Intl.LDMLPluralRule, Row>>> = {
  replies: {
    one: ["{n} reply", "{n} ответ", "{n} Antwort", "{n} respuesta", "{n} réponse"],
    few: ["{n} replies", "{n} ответа", "{n} Antworten", "{n} respuestas", "{n} réponses"],
    many: ["{n} replies", "{n} ответов", "{n} Antworten", "{n} respuestas", "{n} réponses"],
    other: ["{n} replies", "{n} ответа", "{n} Antworten", "{n} respuestas", "{n} réponses"],
  },
  posts: {
    one: ["{n} post", "{n} запись", "{n} Aufnahme", "{n} grabación", "{n} enregistrement"],
    few: ["{n} posts", "{n} записи", "{n} Aufnahmen", "{n} grabaciones", "{n} enregistrements"],
    many: ["{n} posts", "{n} записей", "{n} Aufnahmen", "{n} grabaciones", "{n} enregistrements"],
    other: ["{n} posts", "{n} записи", "{n} Aufnahmen", "{n} grabaciones", "{n} enregistrements"],
  },
  reactions: {
    one: ["{n} reaction", "{n} реакция", "{n} Reaktion", "{n} reacción", "{n} réaction"],
    few: ["{n} reactions", "{n} реакции", "{n} Reaktionen", "{n} reacciones", "{n} réactions"],
    many: ["{n} reactions", "{n} реакций", "{n} Reaktionen", "{n} reacciones", "{n} réactions"],
    other: ["{n} reactions", "{n} реакции", "{n} Reaktionen", "{n} reacciones", "{n} réactions"],
  },
  newReplies: {
    one: ["{n} new reply", "{n} новый ответ", "{n} neue Antwort", "{n} respuesta nueva", "{n} nouvelle réponse"],
    few: ["{n} new replies", "{n} новых ответа", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
    many: ["{n} new replies", "{n} новых ответов", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
    other: ["{n} new replies", "{n} новых ответа", "{n} neue Antworten", "{n} respuestas nuevas", "{n} nouvelles réponses"],
  },
  played: {
    one: ["played {n} time", "звучал {n} раз", "{n}× gespielt", "sonó {n} vez", "joué {n} fois"],
    few: ["played {n} times", "звучал {n} раза", "{n}× gespielt", "sonó {n} veces", "joué {n} fois"],
    many: ["played {n} times", "звучал {n} раз", "{n}× gespielt", "sonó {n} veces", "joué {n} fois"],
    other: ["played {n} times", "звучал {n} раза", "{n}× gespielt", "sonó {n} veces", "joué {n} fois"],
  },
};

const fill = (s: string, vars: Record<string, string | number> = {}) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

export function t(key: string, vars?: Record<string, string | number>) {
  const row = D[key];
  return fill(row ? row[COL[lang]] : key, vars);
}

const rules = new Intl.PluralRules(lang);
export function tn(key: string, n: number) {
  const forms = P[key];
  const row = forms?.[rules.select(n)] ?? forms?.other;
  return fill(row ? row[COL[lang]] : String(n), { n });
}

const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
export function ago(ts: number) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 60) return rtf.format(-Math.max(0, min), "minute");
  return rtf.format(-Math.round(min / 60), "hour");
}

// разметка: data-i18n — текст, data-i18n-aria — aria-label
export function translateDom(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria!)));
}
