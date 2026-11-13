// «Тебе ответили голосом»: уведомление автору голоса, даже когда приложение закрыто.
// Вызывает приложение того, кто ответил, сразу после публикации ответа. Функция сама проверяет,
// что ответ существует, принадлежит вызвавшему, свежий и что отвечали не самому себе, — поэтому
// разослать уведомление от чужого имени или про чужой голос нельзя.
// Секреты: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (supabase secrets set --env-file supabase/functions/.env).

import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";

const TEXT: Record<string, string> = {
  en: "Someone replied to your voice",
  ru: "Тебе ответили голосом",
  de: "Jemand hat auf deine Stimme geantwortet",
  es: "Alguien respondió a tu voz",
  fr: "Quelqu'un a répondu à ta voix",
};
const FRESH_MS = 10 * 60 * 1000; // уведомлять только про свежий ответ — старый повторно не разослать

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return reply(401, { error: "sign in first" });

  const { post_id } = await req.json().catch(() => ({}));
  if (typeof post_id !== "string" || post_id.length > 64) return reply(400, { error: "post_id" });

  const { data: answer } = await admin.from("posts").select("id, author_id, reply_to, created_at").eq("id", post_id).maybeSingle();
  if (!answer || answer.author_id !== auth.user.id || !answer.reply_to) return reply(400, { error: "not your reply" });
  if (Date.now() - Date.parse(answer.created_at) > FRESH_MS) return reply(200, { sent: 0, reason: "old" });

  const { data: parent } = await admin.from("posts").select("id, author_id").eq("id", answer.reply_to).maybeSingle();
  if (!parent || parent.author_id === auth.user.id) return reply(200, { sent: 0 }); // демо-голос или ответ себе

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth, lang").eq("user_id", parent.author_id);
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

  let sent = 0;
  for (const s of subs ?? []) {
    const payload = JSON.stringify({
      title: "SUSHHH",
      body: TEXT[s.lang] ?? TEXT.en,
      tag: `reply-${parent.id}`, // несколько ответов на один голос — одно уведомление, а не стопка
      url: `v2/?thread=${encodeURIComponent(parent.id)}`,
    });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
      sent++;
    } catch (e) {
      // подписка больше не действует (удалили приложение, отозвали разрешение) — забываем её
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
  return reply(200, { sent });
});
