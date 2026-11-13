// Supabase: адрес проекта и публичный (publishable) ключ.
// Ключ и так виден в браузере; что можно читать и писать, решают правила RLS в supabase/migrations.
// Секретные ключи и пароль базы сюда не кладём никогда.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "https://edmpcryegwmlsvrgbjns.supabase.co";
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_CgN39OalAiF8aGzJS1t10w_VZVl3M2A";
// Открытый ключ для уведомлений (VAPID). Закрытая пара хранится только в секретах функции notify-reply
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "BMvRbN7McPoYiIS_w7w9m5mbUCZnvGhOi041tMpk6N6jh8AFbhWjNM5GhY8pL-lUVfB5jDvlEUw2Eo2X2j68wC4";
