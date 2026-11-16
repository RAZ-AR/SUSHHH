// Подсказки «о чём сказать» (plan-v3, этап 2). Мелкие и бытовые: на них легко ответить за 10 секунд,
// и страх «не знаю, что сказать» уходит. Видны во время отсчёта и записи; касание — следующая подсказка.
// Потом — таблица prompts на сервере, чтобы менять тексты без выкладки; эти останутся запасными.

import { lang, type Lang } from "../src/i18n";

type Row = [en: string, ru: string, de: string, es: string, fr: string];
const COL: Record<Lang, number> = { en: 0, ru: 1, de: 2, es: 3, fr: 4 };

// для нового голоса
const POST: Row[] = [
  ["Describe the sound outside your window right now", "Опиши звук за окном прямо сейчас", "Beschreib das Geräusch vor deinem Fenster gerade", "Describe el sonido que hay ahora tras tu ventana", "Décris le bruit derrière ta fenêtre en ce moment"],
  ["What did you eat today — and was it worth it?", "Что было сегодня на обед — и стоило ли оно того?", "Was hast du heute gegessen — und hat es sich gelohnt?", "¿Qué comiste hoy? ¿Valió la pena?", "Qu'as-tu mangé aujourd'hui — et ça valait le coup ?"],
  ["The silliest thing you bought this month", "Самая глупая покупка этого месяца", "Das Albernste, was du diesen Monat gekauft hast", "Lo más tonto que compraste este mes", "Le truc le plus absurde acheté ce mois-ci"],
  ["What made you smile today?", "Что сегодня вызвало улыбку?", "Was hat dich heute zum Lächeln gebracht?", "¿Qué te hizo sonreír hoy?", "Qu'est-ce qui t'a fait sourire aujourd'hui ?"],
  ["A song stuck in your head — hum it", "Песня, которая застряла в голове, — напой", "Ein Ohrwurm — summ ihn", "Una canción que no se te va de la cabeza: tararéala", "Une chanson qui te trotte dans la tête — fredonne-la"],
  ["What are you putting off right now?", "Что ты сейчас откладываешь?", "Was schiebst du gerade vor dir her?", "¿Qué estás posponiendo ahora mismo?", "Qu'est-ce que tu repousses en ce moment ?"],
  ["Tell us about a small win this week", "Расскажи о маленькой победе на этой неделе", "Erzähl von einem kleinen Erfolg diese Woche", "Cuenta una pequeña victoria de esta semana", "Raconte une petite victoire de la semaine"],
  ["Where are you now, and what does it smell like?", "Где ты сейчас и чем там пахнет?", "Wo bist du gerade, und wie riecht es dort?", "¿Dónde estás y a qué huele ahí?", "Où es-tu, et ça sent quoi ?"],
  ["A word you love the sound of", "Слово, которое тебе нравится по звучанию", "Ein Wort, dessen Klang du liebst", "Una palabra que te encanta cómo suena", "Un mot dont tu aimes le son"],
  ["What would you tell yourself a year ago?", "Совет себе год назад — какой он?", "Was würdest du dir vor einem Jahr sagen?", "¿Qué te dirías hace un año?", "Que te dirais-tu il y a un an ?"],
  ["Recommend one thing — a film, a place, a habit", "Посоветуй одну вещь — фильм, место, привычку", "Empfiehl eine Sache — Film, Ort, Gewohnheit", "Recomienda una cosa: una peli, un sitio, un hábito", "Recommande une chose — un film, un lieu, une habitude"],
  ["Just say how your day went, in three words", "Просто скажи, как прошёл день, в трёх словах", "Sag einfach in drei Worten, wie dein Tag war", "Di cómo fue tu día en tres palabras", "Dis juste comment s'est passée ta journée, en trois mots"],
];

// для ответа на чужой голос
const REPLY: Row[] = [
  ["Agree? Say why", "Согласен? Скажи почему", "Einverstanden? Sag warum", "¿De acuerdo? Di por qué", "D'accord ? Dis pourquoi"],
  ["Has something like this happened to you?", "У тебя было похожее?", "Ist dir so etwas auch passiert?", "¿Te pasó algo parecido?", "Il t'est arrivé quelque chose de pareil ?"],
  ["Just laugh if it was funny", "Просто засмейся, если смешно", "Lach einfach, wenn es lustig war", "Ríete si te hizo gracia", "Ris, si c'était drôle"],
  ["Ask them one question", "Задай один вопрос", "Stell eine Frage", "Hazle una pregunta", "Pose-lui une question"],
  ["Say something kind — they'll hear it", "Скажи что-то доброе — автор услышит", "Sag etwas Nettes — die Person hört es", "Di algo amable: lo va a escuchar", "Dis quelque chose de gentil — on l'entendra"],
  ["What would you do in their place?", "Твой вариант: что делать на этом месте?", "Was würdest du an der Stelle tun?", "¿Qué harías tú en su lugar?", "Que ferais-tu à sa place ?"],
];

// слова поддержки после записи, если в ней есть речь (не оценка, а знак, что всё в порядке)
const KIND: Row[] = [
  ["Sounds alive", "Звучит живо", "Klingt lebendig", "Suena vivo", "Ça sonne vivant"],
  ["Nice intonation", "Хорошая интонация", "Schöne Betonung", "Buena entonación", "Belle intonation"],
  ["That came out warm", "Тепло получилось", "Das klingt warm", "Te salió cálido", "C'est chaleureux"],
];

const pick = (rows: Row[], not = "") => {
  const all = rows.map((r) => r[COL[lang]]);
  const rest = all.filter((s) => s !== not);
  return rest[Math.floor(Math.random() * rest.length)] ?? all[0];
};

let last = "";
// следующая подсказка, не та же, что только что
export function nextPrompt(kind: "post" | "reply") {
  last = pick(kind === "post" ? POST : REPLY, last);
  return last;
}
export const kindWord = () => pick(KIND);

// есть ли в записи речь, а не тишина или ровный шум: доля «громких» кусков по 20 мс относительно
// пика записи. Грубо, но хватает, чтобы не хвалить пустую запись; потом — VAD (Silero)
export function hasSpeech(ch: Float32Array, rate: number) {
  const n = Math.round(rate * 0.02);
  const rms: number[] = [];
  for (let i = 0; i + n <= ch.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j += 4) s += ch[j] * ch[j];
    rms.push(Math.sqrt(s / (n / 4)));
  }
  if (rms.length < 25) return false; // короче полсекунды
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)]; // шум в паузах
  const peak = sorted[Math.floor(sorted.length * 0.95)];
  if (peak < 0.02 || peak < floor * 4) return false; // тихо или ровный шум без пауз и всплесков
  const loud = rms.filter((v) => v > Math.max(floor * 3, peak * 0.25)).length;
  return loud / rms.length > 0.15 && loud * 0.02 > 0.5; // больше 15% и хотя бы полсекунды голоса
}
