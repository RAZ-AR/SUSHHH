// Общий эфир на Supabase: анонимный вход под псевдонимом, голоса в Storage, записи и реакции в Postgres.
// Всё необязательно: без сети или без проекта приложение работает локально, как прототип.

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export type RemotePost = {
  id: string;
  author_id: string;
  author_name: string;
  reply_to: string | null;
  at: number | null;
  text: string | null;
  tags: string[];
  audio_path: string;
  env: number[] | null;
  palette: number;
  created_at: string;
};
export type RemoteReaction = { post_id: string; user_id: string; emoji: string; at: number };
export type Outgoing = { id: string; blob: Blob; replyTo?: string; at?: number; text?: string; env?: number[]; palette: number; tags: string[] };

let sb: SupabaseClient | null = null;
let uid: string | null = null;

export const myUid = () => uid;
export const online = () => !!uid;

// supabase-js грузится лениво: первый экран не ждёт сети и лишних 50 КБ
export async function connect(name: string): Promise<boolean> {
  if (uid) return true;
  if (!SUPABASE_URL || !SUPABASE_KEY || !navigator.onLine) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    sb ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data } = await sb.auth.getSession();
    if (!data.session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) throw r.error;
      data = { session: r.data.session };
    }
    uid = data.session?.user.id ?? null;
    if (!uid) return false;
    const { error } = await sb.from("profiles").upsert({ id: uid, name }, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch {
    uid = null;
    return false;
  }
}

export function audioUrl(path: string) {
  return sb!.storage.from("voices").getPublicUrl(path).data.publicUrl;
}

export async function fetchFeed(): Promise<{ posts: RemotePost[]; reactions: RemoteReaction[] }> {
  if (!sb || !uid) return { posts: [], reactions: [] };
  const { data: posts, error } = await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(500);
  if (error || !posts) return { posts: [], reactions: [] };
  const { data: reactions } = await sb.from("reactions").select("post_id,user_id,emoji,at").order("created_at", { ascending: false }).limit(5000);
  return { posts: posts as RemotePost[], reactions: (reactions ?? []) as RemoteReaction[] };
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3" };

// голос — в папку автора, строка — в эфир; повторная отправка безопасна (upsert)
export async function publish(o: Outgoing, name: string): Promise<boolean> {
  if (!sb || !uid) return false;
  const mime = (o.blob.type || "audio/webm").split(";")[0];
  const path = `${uid}/${o.id}.${EXT[mime] ?? "webm"}`;
  const up = await sb.storage.from("voices").upload(path, o.blob, { contentType: mime, upsert: true, cacheControl: "604800" });
  if (up.error) return false;
  const { error } = await sb.from("posts").upsert({
    id: o.id, author_id: uid, author_name: name, reply_to: o.replyTo ?? null, at: o.at ?? null, text: o.text ?? null,
    tags: o.tags, audio_path: path, env: o.env ?? null, palette: o.palette,
  });
  return !error;
}

export function sendReaction(postId: string, emoji: string, at: number) {
  if (sb && uid) void sb.from("reactions").insert({ post_id: postId, user_id: uid, emoji, at: Math.min(1, Math.max(0, at)) }).then(() => {});
}

export function sendReport(postId: string, reason: string) {
  if (sb && uid) void sb.from("reports").upsert({ post_id: postId, user_id: uid, reason }, { onConflict: "post_id,user_id" }).then(() => {});
}

export async function removePost(id: string) {
  if (!sb || !uid) return;
  const { data } = await sb.from("posts").delete().eq("id", id).eq("author_id", uid).select("audio_path");
  const paths = (data ?? []).map((r: { audio_path: string }) => r.audio_path);
  if (paths.length) await sb.storage.from("voices").remove(paths);
}

export async function rename(name: string) {
  if (!sb || !uid) return;
  await sb.from("profiles").update({ name }).eq("id", uid);
  await sb.from("posts").update({ author_name: name }).eq("author_id", uid);
}

// удалить аккаунт: все свои голоса, записи, реакции и сам псевдоним
export async function eraseAccount() {
  if (!sb || !uid) return;
  const { data } = await sb.from("posts").select("audio_path").eq("author_id", uid);
  const paths = (data ?? []).map((r: { audio_path: string }) => r.audio_path);
  if (paths.length) await sb.storage.from("voices").remove(paths);
  await sb.from("profiles").delete().eq("id", uid); // записи и реакции удаляются каскадом
  await sb.auth.signOut();
  uid = null;
}

// новые голоса в эфире — сразу, без перезагрузки
let channel: RealtimeChannel | null = null;
export function onNewPost(cb: (p: RemotePost) => void) {
  if (!sb || channel) return;
  channel = sb
    .channel("air")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (m) => {
      const p = m.new as RemotePost;
      if (p.author_id !== uid) cb(p);
    })
    .subscribe();
}
