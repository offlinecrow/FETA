-- FETA (Family Expense Tracker App): one row per person holding their data.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.user_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  rev        bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- Row level security: a signed-in person can only read and write their own row.
alter table public.user_data enable row level security;

drop policy if exists "read own data" on public.user_data;
drop policy if exists "add own data" on public.user_data;
drop policy if exists "change own data" on public.user_data;

create policy "read own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "add own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "change own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Signed-in people may use the table through the app; visitors who are not signed in may not.
revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;
