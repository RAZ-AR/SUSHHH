-- SUSHHH: общий эфир. Вход — анонимный (псевдоним без почты), голоса — в Storage.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.posts (
  id text primary key check (char_length(id) <= 64),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  reply_to text check (char_length(reply_to) <= 64), -- может указывать и на демо-запись
  at real check (at between 0 and 1),
  text text check (char_length(text) <= 2000),
  tags text[] not null default '{}',
  audio_path text not null,
  env real[],
  palette smallint not null default 0,
  created_at timestamptz not null default now()
);
create index posts_created on public.posts (created_at desc);
create index posts_reply_to on public.posts (reply_to);

create table public.reactions (
  id bigint generated always as identity primary key,
  post_id text not null check (char_length(post_id) <= 64),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null check (char_length(emoji) <= 32),
  at real not null default 0 check (at between 0 and 1),
  created_at timestamptz not null default now()
);
create index reactions_post on public.reactions (post_id);

create table public.reports (
  id bigint generated always as identity primary key,
  post_id text not null,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  reason text not null check (reason in ('abuse','spam','sexual','danger','personal','crisis','other')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;

-- слушать могут все вошедшие; писать и удалять — только своё
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles own delete" on public.profiles for delete to authenticated using (id = auth.uid());

create policy "posts read" on public.posts for select to authenticated using (true);
create policy "posts own insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and audio_path like auth.uid()::text || '/%');
create policy "posts own update" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts own delete" on public.posts for delete to authenticated using (author_id = auth.uid());

create policy "reactions read" on public.reactions for select to authenticated using (true);
create policy "reactions own insert" on public.reactions for insert to authenticated with check (user_id = auth.uid());

-- жалобы видят только модераторы (через панель Supabase)
create policy "reports own insert" on public.reports for insert to authenticated with check (user_id = auth.uid());

-- голоса: публичное чтение, запись и удаление — только в свою папку, до 2 МБ, только аудио
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', true, 2097152, array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac']);

create policy "voices own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "voices own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);

-- «тебе ответили» и реакции — в реальном времени
alter publication supabase_realtime add table public.posts, public.reactions;
