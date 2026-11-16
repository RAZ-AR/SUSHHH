-- «Тебя услышали» (plan-v3, этап 1) и метрики (этап 0).
-- Прослушивание теперь знает, докуда дослушали; автор видит про свои голоса, сколько дослушали и кто
-- (только тех, кто не выключил «Показывать, что я слушал»). Чужие прослушивания по-прежнему не читаются.
-- Безопасно применять поверх 20261113*: только добавляет, данные не теряются.

-- ===== докуда дослушали =====
alter table public.plays add column if not exists progress real not null default 0 check (progress between 0 and 1);
alter table public.plays add column if not exists completed boolean not null default false;
alter table public.plays add column if not exists updated_at timestamptz not null default now();
create index if not exists plays_post on public.plays (post_id, updated_at desc);

-- показывать ли автору моё имя среди слушателей (по умолчанию да, выключается в «Моё»)
alter table public.profiles add column if not exists show_listens boolean not null default true;

-- записать, докуда дослушал: прогресс только растёт, 90% и больше — «дослушал».
-- Первая запись о прослушивании засчитывается в posts.plays, как count_play
create or replace function public.play_progress(p_id text, p_progress real) returns void
language plpgsql security definer set search_path = public as $$
declare
  f real := least(1, greatest(0, coalesce(p_progress, 0)));
  fresh boolean;
begin
  if auth.uid() is null then return; end if;
  -- свои голоса не считаем
  if exists (select 1 from public.posts where id = p_id and author_id = auth.uid()) then return; end if;
  insert into public.plays as pl (post_id, user_id, progress, completed, updated_at)
  values (p_id, auth.uid(), f, f >= 0.9, now())
  on conflict (post_id, user_id) do update
    set progress = greatest(pl.progress, excluded.progress),
        completed = pl.completed or excluded.completed,
        updated_at = now()
  returning (xmax = 0) into fresh;
  if fresh then update public.posts set plays = plays + 1 where id = p_id; end if;
end $$;
revoke all on function public.play_progress(text, real) from public, anon;
grant execute on function public.play_progress(text, real) to authenticated;

-- мои голоса: сколько послушали, сколько дослушали, когда в последний раз, и до трёх имён тех, кто дослушал
create or replace function public.my_listens()
returns table (post_id text, created_at timestamptz, plays integer, completed integer, last_at timestamptz, names text[])
language sql stable security definer set search_path = public as $$
  select p.id,
         p.created_at,
         p.plays,
         (select count(*)::int from public.plays pl where pl.post_id = p.id and pl.completed),
         (select max(pl.updated_at) from public.plays pl where pl.post_id = p.id),
         array(
           select pr.name from public.plays pl join public.profiles pr on pr.id = pl.user_id
           where pl.post_id = p.id and pl.completed and pr.show_listens
           order by pl.updated_at desc limit 3
         )
  from public.posts p
  where p.author_id = (select auth.uid())
  order by p.created_at desc
  limit 200;
$$;
revoke all on function public.my_listens() from public, anon;
grant execute on function public.my_listens() to authenticated;

-- ===== метрики (plan-v3, этап 0.2) =====
-- Читаются только из панели Supabase или с ключом service_role: приложению они не нужны.

-- по дням публикации: сколько голосов, у скольких есть ответ за 24 ч, медиана минут до первого ответа,
-- доля голосов, которые кто-то дослушал
create or replace view public.metrics_daily with (security_invoker = true) as
with roots as (
  select p.id, p.author_id, p.created_at,
         (select min(r.created_at) from public.posts r where r.reply_to = p.id and r.author_id <> p.author_id) as first_reply,
         exists (select 1 from public.plays pl where pl.post_id = p.id and pl.completed) as heard_full
  from public.posts p
  where p.reply_to is null
)
select date_trunc('day', created_at)::date as day,
       count(*) as voices,
       count(*) filter (where first_reply < created_at + interval '24 hours') as replied_24h,
       round(100.0 * count(*) filter (where first_reply < created_at + interval '24 hours') / nullif(count(*), 0), 1) as replied_24h_pct,
       round((percentile_cont(0.5) within group (order by extract(epoch from first_reply - created_at) / 60)
              filter (where first_reply is not null))::numeric, 1) as median_min_to_reply,
       round(100.0 * count(*) filter (where heard_full) / nullif(count(*), 0), 1) as heard_full_pct
from roots
group by 1
order by 1 desc;

-- главная метрика продукта: доля авторов, которым ответили голосом в первые 24 ч после их первого голоса
create or replace view public.metrics_first_reply with (security_invoker = true) as
with firsts as (
  select distinct on (author_id) author_id, id, created_at
  from public.posts where reply_to is null
  order by author_id, created_at
)
select date_trunc('week', f.created_at)::date as week,
       count(*) as new_authors,
       count(*) filter (where exists (
         select 1 from public.posts r
         where r.reply_to = f.id and r.author_id <> f.author_id and r.created_at < f.created_at + interval '24 hours'
       )) as answered_24h
from firsts f
group by 1
order by 1 desc;

revoke all on public.metrics_daily, public.metrics_first_reply from public, anon, authenticated;
