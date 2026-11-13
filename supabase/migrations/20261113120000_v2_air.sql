-- v2 в общем эфире: честный счётчик прослушиваний, защита имени автора и пути к голосу,
-- лимиты от спама, индексы и быстрые правила доступа.
-- Безопасно применять поверх 20261108*: только добавляет и уточняет, данные не теряются.

-- ===== прослушивания: одно на человека и голос =====
create table public.plays (
  post_id text not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.plays enable row level security; -- напрямую не читается и не пишется: только через count_play
create index plays_user on public.plays (user_id);

alter table public.posts add column if not exists plays integer not null default 0;

-- засчитать прослушивание: повтор того же человека ничего не меняет
create or replace function public.count_play(p_id text) returns void
language sql security definer set search_path = public as $$
  with ins as (
    insert into public.plays (post_id, user_id) values (p_id, auth.uid())
    on conflict do nothing
    returning 1
  )
  update public.posts set plays = plays + 1 where id = p_id and exists (select 1 from ins);
$$;
revoke all on function public.count_play(text) from public, anon;
grant execute on function public.count_play(text) to authenticated;

-- ===== имя автора берётся из профиля, а не из запроса: чужим именем не подписаться =====
create or replace function public.posts_author_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce((select name from public.profiles where id = new.author_id), new.author_name);
  return new;
end $$;
create trigger posts_author_name before insert or update of author_id, author_name on public.posts
  for each row execute function public.posts_author_name();

-- переименовался — имя обновляется во всех его голосах (раньше это делал клиент)
create or replace function public.profiles_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.posts set author_name = new.name where author_id = new.id;
  end if;
  return new;
end $$;
create trigger profiles_rename after update of name on public.profiles
  for each row execute function public.profiles_rename();

-- ===== лимиты от спама: не больше 10 голосов за 10 минут и 60 реакций в минуту =====
create or replace function public.limit_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_table_name = 'posts' then
    select count(*) into n from public.posts where author_id = new.author_id and created_at > now() - interval '10 minutes';
    if n >= 10 then raise exception 'rate limit: posts' using errcode = 'P0429'; end if;
  else
    select count(*) into n from public.reactions where user_id = new.user_id and created_at > now() - interval '1 minute';
    if n >= 60 then raise exception 'rate limit: reactions' using errcode = 'P0429'; end if;
  end if;
  return new;
end $$;
create trigger posts_rate before insert on public.posts for each row execute function public.limit_rate();
create trigger reactions_rate before insert on public.reactions for each row execute function public.limit_rate();

-- ===== индексы: удаление аккаунта каскадом и лимиты не перебирают таблицы целиком =====
create index if not exists posts_author on public.posts (author_id, created_at desc);
create index if not exists reactions_user on public.reactions (user_id, created_at desc);
create index if not exists reports_user on public.reports (user_id);

-- ===== правила доступа: (select auth.uid()) считается один раз на запрос, а не на каждую строку;
-- свой голос нельзя «перенаправить» на файл в чужой папке =====
drop policy "profiles own insert" on public.profiles;
drop policy "profiles own update" on public.profiles;
drop policy "profiles own delete" on public.profiles;
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles own update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles own delete" on public.profiles for delete to authenticated using (id = (select auth.uid()));

drop policy "posts own insert" on public.posts;
drop policy "posts own update" on public.posts;
drop policy "posts own delete" on public.posts;
create policy "posts own insert" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and audio_path like (select auth.uid())::text || '/%');
create policy "posts own update" on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and audio_path like (select auth.uid())::text || '/%');
create policy "posts own delete" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

drop policy "reactions own insert" on public.reactions;
create policy "reactions own insert" on public.reactions for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "reports own insert" on public.reports;
create policy "reports own insert" on public.reports for insert to authenticated with check (user_id = (select auth.uid()));

-- прослушивания в реальном времени не нужны; новые голоса и реакции уже в публикации supabase_realtime
