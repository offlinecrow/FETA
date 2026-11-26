-- FETA: profiles, guests, profile pictures and comments.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is safe to run again. It does not change or remove the existing user_data table: each person's data is
-- copied from there into "profiles" by the app the first time they open it after this has been run.

-- 1. Profiles: one set of income, expenses, bills and so on. Each person has one main profile and may add more.
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 40),
  is_main    boolean not null default false,
  data       jsonb not null,
  rev        bigint not null default 1,
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_one_main on public.profiles (owner_id) where is_main;
create index if not exists profiles_owner on public.profiles (owner_id);

-- 2. Guests: who was invited to a profile, by email, and what they may do there.
--    role "view": see the reports and transactions. role "add": also add expenses.
create table if not exists public.profile_guests (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_email  text not null default '' check (char_length(owner_email) <= 254),
  profile_name text not null default '' check (char_length(profile_name) <= 40),
  email        text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role         text not null default 'view' check (role in ('view', 'add')),
  status       text not null default 'invited' check (status in ('invited', 'accepted')),
  guest_id     uuid references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (profile_id, email)
);
create index if not exists profile_guests_guest on public.profile_guests (guest_id);
create index if not exists profile_guests_email on public.profile_guests (email);

-- 3. People: the name and small picture a person shows to those they share a profile with.
create table if not exists public.people (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 40),
  avatar     text not null default '' check (char_length(avatar) <= 60000),
  updated_at timestamptz not null default now()
);

-- 4. Comments and replies on a transaction.
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  tx_id       text not null check (tx_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  parent_id   uuid references public.comments (id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 40),
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists comments_profile on public.comments (profile_id, created_at);

-- Helpers used by the rules below. They run with the database owner's rights so that the rules can look
-- at the guest list without the guest list's own rules getting in the way.
create or replace function public.feta_email() returns text
  language sql stable set search_path = public as
$$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.feta_owns(p uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = p and owner_id = auth.uid()) $$;

create or replace function public.feta_is_guest(p uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profile_guests g where g.profile_id = p and g.guest_id = auth.uid() and g.status = 'accepted') $$;

create or replace function public.feta_can_see(p uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.feta_owns(p) or public.feta_is_guest(p) $$;

-- Someone I share a profile with: my guest, the owner of a profile I am a guest of or was invited to,
-- or another guest of the same profile.
create or replace function public.feta_knows(u uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.profile_guests g
    where (g.owner_id = auth.uid() and g.guest_id = u)
       or (g.owner_id = u and (g.guest_id = auth.uid() or g.email = public.feta_email()))
  ) or exists (
    select 1 from public.profile_guests a join public.profile_guests b on a.profile_id = b.profile_id
    where a.guest_id = auth.uid() and a.status = 'accepted' and b.guest_id = u
  )
$$;

-- Rules: who may read and change what.
alter table public.profiles enable row level security;
alter table public.profile_guests enable row level security;
alter table public.people enable row level security;
alter table public.comments enable row level security;

drop policy if exists "read own and shared profiles" on public.profiles;
drop policy if exists "add own profile" on public.profiles;
drop policy if exists "change own profile" on public.profiles;
drop policy if exists "delete own extra profile" on public.profiles;
create policy "read own and shared profiles" on public.profiles
  for select to authenticated using (owner_id = (select auth.uid()) or public.feta_is_guest(id));
create policy "add own profile" on public.profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "change own profile" on public.profiles
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own extra profile" on public.profiles
  for delete to authenticated using (owner_id = (select auth.uid()) and not is_main);

drop policy if exists "see my guests and my invitations" on public.profile_guests;
drop policy if exists "invite to my profile" on public.profile_guests;
drop policy if exists "change my guest" on public.profile_guests;
drop policy if exists "remove guest or leave" on public.profile_guests;
create policy "see my guests and my invitations" on public.profile_guests
  for select to authenticated using (owner_id = (select auth.uid()) or email = public.feta_email());
create policy "invite to my profile" on public.profile_guests
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and public.feta_owns(profile_id)
    and status = 'invited' and guest_id is null and email <> public.feta_email());
create policy "change my guest" on public.profile_guests
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "remove guest or leave" on public.profile_guests
  for delete to authenticated using (owner_id = (select auth.uid()) or email = public.feta_email());

drop policy if exists "see myself and people I share with" on public.people;
drop policy if exists "add myself" on public.people;
drop policy if exists "change myself" on public.people;
create policy "see myself and people I share with" on public.people
  for select to authenticated using (user_id = (select auth.uid()) or public.feta_knows(user_id));
create policy "add myself" on public.people
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change myself" on public.people
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "read comments" on public.comments;
drop policy if exists "write comments" on public.comments;
drop policy if exists "delete own comments" on public.comments;
create policy "read comments" on public.comments
  for select to authenticated using (public.feta_can_see(profile_id));
create policy "write comments" on public.comments
  for insert to authenticated with check (author_id = (select auth.uid()) and public.feta_can_see(profile_id));
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()) or public.feta_owns(profile_id));

-- A guest accepts an invitation sent to their own, confirmed email address.
create or replace function public.accept_invite(p_id uuid) returns void
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Confirm your email first.' using errcode = '42501';
  end if;
  update public.profile_guests set status = 'accepted', guest_id = auth.uid()
    where id = p_id and email = public.feta_email();
  if not found then
    raise exception 'That invitation is no longer there.' using errcode = '42501';
  end if;
end
$$;

-- A guest who may add expenses saves one. Guests never write the profile's data themselves: this checks that
-- they are allowed, builds the expense from the few fields a guest may set, and marks it with who added it.
-- A guest can change an expense only if they added it. Returns the profile's new revision number.
create or replace function public.guest_save_expense(p_profile uuid, p_tx jsonb) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare
  me    uuid := auth.uid();
  who   text;
  d     jsonb;
  r     bigint;
  txs   jsonb;
  pos   int;
  old   jsonb;
  fresh jsonb;
begin
  if me is null or not exists (select 1 from public.profile_guests g
      where g.profile_id = p_profile and g.guest_id = me and g.status = 'accepted' and g.role = 'add') then
    raise exception 'You are not allowed to add expenses to this profile.' using errcode = '42501';
  end if;
  if coalesce(p_tx ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,40}$'
     or coalesce(p_tx ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or coalesce(p_tx ->> 'categoryId', '') !~ '^[A-Za-z0-9_-]{0,40}$'
     or jsonb_typeof(p_tx -> 'amount') is distinct from 'number'
     or (p_tx ->> 'amount')::numeric <= 0 or (p_tx ->> 'amount')::numeric > 1000000000000 then
    raise exception 'That expense is not valid.' using errcode = '22023';
  end if;

  select data, rev into d, r from public.profiles where id = p_profile for update;
  if not found then
    raise exception 'That profile is no longer there.' using errcode = '42501';
  end if;
  txs := case when jsonb_typeof(d -> 'transactions') = 'array' then d -> 'transactions' else '[]'::jsonb end;
  who := coalesce((select nullif(p.name, '') from public.people p where p.user_id = me),
                  nullif(split_part(public.feta_email(), '@', 1), ''), 'Guest');
  fresh := jsonb_build_object(
    'id', p_tx ->> 'id', 'type', 'expense', 'amount', round((p_tx ->> 'amount')::numeric, 3),
    'categoryId', coalesce(p_tx ->> 'categoryId', ''), 'date', p_tx ->> 'date',
    'note', left(coalesce(p_tx ->> 'note', ''), 120), 'created', (extract(epoch from now()) * 1000)::bigint,
    'recurringId', '', 'emiId', '', 'planId', '', 'period', '', 'by', me::text, 'byName', left(who, 40));

  select (t.ord - 1)::int, t.elem into pos, old
    from jsonb_array_elements(txs) with ordinality as t (elem, ord) where t.elem ->> 'id' = p_tx ->> 'id' limit 1;
  if found then
    if old ->> 'by' is distinct from me::text then
      raise exception 'You can only change expenses you added.' using errcode = '42501';
    end if;
    fresh := jsonb_set(fresh, '{created}', coalesce(old -> 'created', fresh -> 'created'));
    txs := jsonb_set(txs, array[pos::text], fresh);
  else
    txs := txs || jsonb_build_array(fresh);
  end if;

  update public.profiles set data = jsonb_set(d, '{transactions}', txs), rev = r + 1, updated_at = now() where id = p_profile;
  return r + 1;
end
$$;

-- A guest removes an expense they added themselves.
create or replace function public.guest_delete_expense(p_profile uuid, p_tx_id text) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare
  me  uuid := auth.uid();
  d   jsonb;
  r   bigint;
  txs jsonb;
begin
  if me is null or not exists (select 1 from public.profile_guests g
      where g.profile_id = p_profile and g.guest_id = me and g.status = 'accepted' and g.role = 'add') then
    raise exception 'You are not allowed to change this profile.' using errcode = '42501';
  end if;
  select data, rev into d, r from public.profiles where id = p_profile for update;
  if not found then
    raise exception 'That profile is no longer there.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(t.elem order by t.ord), '[]'::jsonb) into txs
    from jsonb_array_elements(case when jsonb_typeof(d -> 'transactions') = 'array' then d -> 'transactions' else '[]'::jsonb end)
         with ordinality as t (elem, ord)
    where t.elem ->> 'id' is distinct from p_tx_id or t.elem ->> 'by' is distinct from me::text;
  update public.profiles set data = jsonb_set(d, '{transactions}', txs), rev = r + 1, updated_at = now() where id = p_profile;
  return r + 1;
end
$$;

-- Only signed-in people may use any of this, and only through the rules above.
revoke all on public.profiles, public.profile_guests, public.people, public.comments from anon;
revoke all on public.profiles, public.profile_guests, public.people, public.comments from authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.profile_guests to authenticated;
-- An owner may change what a guest is allowed to do, and nothing else about the invitation.
grant update (role) on public.profile_guests to authenticated;
grant select, insert, update on public.people to authenticated;
grant select, insert, delete on public.comments to authenticated;

revoke all on function public.feta_email(), public.feta_owns(uuid), public.feta_is_guest(uuid), public.feta_can_see(uuid), public.feta_knows(uuid),
  public.accept_invite(uuid), public.guest_save_expense(uuid, jsonb), public.guest_delete_expense(uuid, text) from public, anon;
grant execute on function public.feta_email(), public.feta_owns(uuid), public.feta_is_guest(uuid), public.feta_can_see(uuid), public.feta_knows(uuid),
  public.accept_invite(uuid), public.guest_save_expense(uuid, jsonb), public.guest_delete_expense(uuid, text) to authenticated;
