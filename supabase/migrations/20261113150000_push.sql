-- Подписки на уведомления «Тебе ответили голосом». Своя подписка видна и меняется только тобой;
-- рассылает функция notify-reply (у неё ключ сервиса). Удаление аккаунта удаляет и подписки.

create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  lang text not null default 'en' check (char_length(lang) <= 5),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push own select" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "push own insert" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push own update" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push own delete" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
