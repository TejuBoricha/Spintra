-- Move activity_state from the world-readable rooms table into a separate
-- table with participant-scoped RLS, so in-progress game data (trivia
-- answers, confessions, votes, etc.) is not visible to arbitrary users.
--
-- Before: rooms has for select using (true) — any authenticated user can
--         read activity_state for any room.
-- After:  room_activity_state has for select using (the user is a room
--         participant) — only participants see in-progress game state.

create table if not exists public.room_activity_state (
  room_code text primary key references public.rooms(code) on delete cascade,
  activity_state jsonb
);

alter table public.room_activity_state enable row level security;

-- Participants can read their own room's activity state.
create policy "room_activity_state_select_participant" on public.room_activity_state
  for select
  using (
    exists (
      select 1 from public.room_participants
      where room_id = room_code and user_id = auth.uid()::text
    )
  );

-- The host (or any participant via the existing trigger path) can update it.
create policy "room_activity_state_update_participant" on public.room_activity_state
  for update
  using (
    exists (
      select 1 from public.room_participants
      where room_id = room_code and user_id = auth.uid()::text
    )
  );

create policy "room_activity_state_insert_participant" on public.room_activity_state
  for insert
  with check (
    exists (
      select 1 from public.room_participants
      where room_id = room_code and user_id = auth.uid()::text
    )
  );

-- Migrate any existing data before dropping the old column.
insert into public.room_activity_state (room_code, activity_state)
  select code, activity_state from public.rooms
  where activity_state is not null
  on conflict (room_code) do update set activity_state = excluded.activity_state;

-- Remove the old column from the public rooms table so it can no longer
-- be read via the world-readable select policy.
alter table public.rooms drop column if exists activity_state;
