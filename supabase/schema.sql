-- Cairn's tables, in margin's Supabase project (the same one recall uses).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again after updates.
-- Nothing here touches margin's `items` or recall's `notes`, `cards` and `user_settings`.

create table if not exists public.cairn_books (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  author      text not null default '',
  pages       int,
  color       text not null default 'moss',
  example     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  touched_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  server_ts   timestamptz not null default now()
);

-- One row per page you marked: the page number and one line in your own words.
create table if not exists public.cairn_marks (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id     uuid not null,
  page        int  not null,
  text        text not null default '',
  rev_n       int  not null default 0,
  rev_due     timestamptz,
  rev_last    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  server_ts   timestamptz not null default now()
);

-- "This is like that": two marks and the reason you wrote.
create table if not exists public.cairn_links (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  a           uuid not null,
  b           uuid not null,
  because     text not null default '',
  example     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  server_ts   timestamptz not null default now()
);

-- server_ts is stamped by the database so sync never depends on device clocks.
-- Cairn uses its own function name so it can't clash with recall's set_server_ts.
create or replace function public.cairn_set_server_ts() returns trigger
language plpgsql as $$
begin
  new.server_ts = now();
  return new;
end $$;

drop trigger if exists cairn_books_ts on public.cairn_books;
create trigger cairn_books_ts before insert or update on public.cairn_books
  for each row execute function public.cairn_set_server_ts();

drop trigger if exists cairn_marks_ts on public.cairn_marks;
create trigger cairn_marks_ts before insert or update on public.cairn_marks
  for each row execute function public.cairn_set_server_ts();

drop trigger if exists cairn_links_ts on public.cairn_links;
create trigger cairn_links_ts before insert or update on public.cairn_links
  for each row execute function public.cairn_set_server_ts();

create index if not exists cairn_books_user_ts on public.cairn_books (user_id, server_ts);
create index if not exists cairn_marks_user_ts on public.cairn_marks (user_id, server_ts);
create index if not exists cairn_links_user_ts on public.cairn_links (user_id, server_ts);

-- Row level security: you only ever see your own rows.
alter table public.cairn_books enable row level security;
alter table public.cairn_marks enable row level security;
alter table public.cairn_links enable row level security;

drop policy if exists "own cairn books" on public.cairn_books;
create policy "own cairn books" on public.cairn_books
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own cairn marks" on public.cairn_marks;
create policy "own cairn marks" on public.cairn_marks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own cairn links" on public.cairn_links;
create policy "own cairn links" on public.cairn_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
