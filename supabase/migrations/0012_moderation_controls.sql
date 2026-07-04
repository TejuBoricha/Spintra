-- Migration 0012: Moderation Controls (Room Bans + Message Reports)
--
-- 1. room_bans: closes the gap where kicking a participant (existing feature)
--    only removed them once — nothing stopped them rejoining immediately.
--    Same before-insert trigger pattern as migration 0009/0011.
-- 2. message_reports: lets any participant flag a message. Insert-only from
--    the client's perspective (no select policy) — reviewed by the project
--    owner directly via the Supabase SQL editor, consistent with there being
--    no custom admin backend.

-- ============================================================================
-- 1. Room Bans
-- ============================================================================
create table if not exists public.room_bans (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id text not null,
  banned_by text not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.room_bans
  drop constraint if exists fk_room_bans_room;
alter table public.room_bans
  add constraint fk_room_bans_room
  foreign key (room_id) references public.rooms (code)
  on delete cascade;

alter table public.room_bans enable row level security;

-- Only the room's actual host (verified against auth.uid()) may record a ban.
drop policy if exists "room_bans_insert_host_only" on public.room_bans;
create policy "room_bans_insert_host_only" on public.room_bans
  for insert with check (
    banned_by = auth.uid()::text
    and exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
  );
-- No select policy: clients don't need to read ban rows; the trigger below
-- is security definer and checks it internally, bypassing RLS.

create index if not exists room_bans_room_id_user_id_idx on public.room_bans (room_id, user_id);

create or replace function public.check_room_ban_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.room_bans
    where room_id = new.room_id and user_id = new.user_id
  ) then
    raise exception 'You have been banned from this room by the host.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_room_ban on public.room_participants;
create trigger trg_check_room_ban
  before insert on public.room_participants
  for each row execute function public.check_room_ban_before_join();

-- ============================================================================
-- 2. Message Reports
-- ============================================================================
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  room_id text not null,
  reported_user_id text not null,
  reporter_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.message_reports
  drop constraint if exists fk_message_reports_room;
alter table public.message_reports
  add constraint fk_message_reports_room
  foreign key (room_id) references public.rooms (code)
  on delete cascade;

alter table public.message_reports enable row level security;

drop policy if exists "message_reports_insert" on public.message_reports;
create policy "message_reports_insert" on public.message_reports
  for insert with check (reporter_id = auth.uid()::text);
-- No select policy — write-only from the client's perspective.

create index if not exists message_reports_room_id_idx on public.message_reports (room_id);
