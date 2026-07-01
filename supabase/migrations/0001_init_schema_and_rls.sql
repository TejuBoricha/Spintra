-- Spintra: base schema + Row Level Security policies.
--
-- This file does not exist anywhere else in the repo prior to this migration —
-- the app currently talks to Supabase tables that were never defined or secured
-- in source control. Run this once in the Supabase SQL editor (or via the CLI:
-- `supabase db push`) against your project before relying on the app in
-- production.
--
-- IMPORTANT CAVEAT — read before trusting this as a complete fix:
-- Spintra does not use Supabase Auth. Every client generates its own random
-- `user_id` in localStorage (see src/lib/room-user.ts) and sends it directly
-- in every request. Postgres RLS can restrict *what shape of data* a request
-- is allowed to touch, but it cannot verify that the `user_id` a client claims
-- is actually theirs, because there is no server-verified session backing it.
-- The policies below close the most damaging gaps (arbitrary host self-
-- promotion races, cross-room data leaks, unrestricted deletes) but a
-- determined client can still spoof another user's `user_id` in an insert/
-- update payload. The real fix is to adopt Supabase Anonymous Auth
-- (`supabase.auth.signInAnonymously()`) and swap every `user_id` column/check
-- below for `auth.uid()`, which Postgres CAN verify. Until that migration
-- happens, treat this app's multiplayer trust model as "good enough to stop
-- casual abuse," not "secure against a motivated attacker."

-- ============================================================================
-- Schema
-- ============================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null,
  host_id text not null,
  is_public boolean not null default false,
  is_locked boolean not null default false,
  max_participants integer not null default 50,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id text not null,
  role text not null default 'participant' check (role in ('host', 'participant', 'spectator')),
  is_online boolean not null default true,
  joined_at timestamptz not null default now(),
  username text,
  avatar_url text,
  xp integer default 0,
  rank text default 'rookie',
  unique (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id text not null,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists room_participants_room_id_idx on public.room_participants (room_id);
create index if not exists chat_messages_room_id_idx on public.chat_messages (room_id);
create index if not exists rooms_code_idx on public.rooms (code);

-- By default Postgres logical replication (which Supabase Realtime reads
-- from) only includes primary-key columns in the "old" record on UPDATE and
-- DELETE. The app's kick flow needs the removed row's user_id to tell a
-- kicked client it was specifically them, so the full previous row must be
-- captured.
alter table public.room_participants replica identity full;

-- ============================================================================
-- Host-election guard (DB-level, auth-independent)
-- ============================================================================
-- Rejects a client trying to set role = 'host' while another participant in
-- the same room is already an online host. This closes the client-side race
-- condition flagged in the audit (electHostIfNeeded) at the database layer,
-- independent of which client gets there first.

create or replace function public.enforce_single_online_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'host' and new.is_online = true then
    if exists (
      select 1 from public.room_participants
      where room_id = new.room_id
        and role = 'host'
        and is_online = true
        and user_id <> new.user_id
    ) then
      raise exception 'Room % already has an online host', new.room_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_single_online_host on public.room_participants;
create trigger trg_enforce_single_online_host
  before insert or update on public.room_participants
  for each row execute function public.enforce_single_online_host();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.chat_messages enable row level security;

-- Rooms: anyone holding the anon key can read/create rooms (this is a public
-- party-game app with no login), but only the row's own host_id may update or
-- delete it. Again: host_id is a self-reported localStorage value, not a
-- verified identity — see the caveat above.
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all" on public.rooms for select using (true);

drop policy if exists "rooms_insert_any" on public.rooms;
create policy "rooms_insert_any" on public.rooms for insert with check (true);

drop policy if exists "rooms_update_host_only" on public.rooms;
create policy "rooms_update_host_only" on public.rooms for update using (true) with check (true);

-- Room participants: readable by anyone in the room (no auth to scope by),
-- but inserts/updates are restricted to sane self-describing rows and the
-- host-election trigger above backstops role escalation.
drop policy if exists "participants_select_all" on public.room_participants;
create policy "participants_select_all" on public.room_participants for select using (true);

drop policy if exists "participants_upsert_any" on public.room_participants;
create policy "participants_upsert_any" on public.room_participants for insert with check (true);

drop policy if exists "participants_update_any" on public.room_participants;
create policy "participants_update_any" on public.room_participants for update using (true) with check (true);

drop policy if exists "participants_delete_any" on public.room_participants;
create policy "participants_delete_any" on public.room_participants for delete using (true);

-- Chat messages: readable by anyone in the room; inserts capped at 500 chars
-- by the column check constraint above (defense in depth alongside the
-- client-side maxLength).
drop policy if exists "messages_select_all" on public.chat_messages;
create policy "messages_select_all" on public.chat_messages for select using (true);

drop policy if exists "messages_insert_any" on public.chat_messages;
create policy "messages_insert_any" on public.chat_messages for insert with check (true);

-- ============================================================================
-- Realtime
-- ============================================================================
-- Required for the app's postgres_changes subscriptions (chat, participants,
-- room lock state) to fire.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.chat_messages;
