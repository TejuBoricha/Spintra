-- Spintra: Enable RLS on rooms and room_participants, and restrict inserts/updates/deletes to verified sessions.

-- Re-enable Row Level Security (RLS)
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.chat_messages enable row level security;

-- ============================================================================
-- Rooms Table Policies
-- ============================================================================

drop policy if exists "rooms_select_all" on public.rooms;
drop policy if exists "rooms_insert_any" on public.rooms;
drop policy if exists "rooms_update_host_only" on public.rooms;
drop policy if exists "rooms_delete_host_only" on public.rooms;
drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;
drop policy if exists "rooms_update" on public.rooms;
drop policy if exists "rooms_delete" on public.rooms;

-- Select: anyone can view rooms
create policy "rooms_select" on public.rooms
  for select using (true);

-- Insert: allowed only if the host_id matches the authenticated user's ID
create policy "rooms_insert" on public.rooms
  for insert with check (auth.uid() is not null and host_id = auth.uid()::text);

-- Update: allowed only if the host_id matches the authenticated user's ID
create policy "rooms_update" on public.rooms
  for update using (host_id = auth.uid()::text) with check (host_id = auth.uid()::text);

-- Delete: allowed only if the host_id matches the authenticated user's ID
create policy "rooms_delete" on public.rooms
  for delete using (host_id = auth.uid()::text);


-- ============================================================================
-- Room Participants Table Policies
-- ============================================================================

drop policy if exists "participants_select_all" on public.room_participants;
drop policy if exists "participants_upsert_any" on public.room_participants;
drop policy if exists "participants_update_any" on public.room_participants;
drop policy if exists "participants_delete_any" on public.room_participants;
drop policy if exists "participants_select" on public.room_participants;
drop policy if exists "participants_insert" on public.room_participants;
drop policy if exists "participants_update" on public.room_participants;
drop policy if exists "participants_delete" on public.room_participants;

-- Select: anyone can view participant listings
create policy "participants_select" on public.room_participants
  for select using (true);

-- Insert: allowed only if the user_id matches the authenticated user's ID
create policy "participants_insert" on public.room_participants
  for insert with check (auth.uid() is not null and user_id = auth.uid()::text);

-- Update: allowed only if the user_id matches the authenticated user's ID
create policy "participants_update" on public.room_participants
  for update using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- Delete: allowed if the user_id matches the authenticated user's ID (leaving the room)
-- OR if the requester is the host of the room (host kicking participant)
create policy "participants_delete" on public.room_participants
  for delete using (
    user_id = auth.uid()::text 
    or exists (
      select 1 from public.rooms 
      where code = room_id 
        and host_id = auth.uid()::text
    )
  );


-- ============================================================================
-- Chat Messages Table Policies
-- ============================================================================

drop policy if exists "messages_select_all" on public.chat_messages;
drop policy if exists "messages_insert_any" on public.chat_messages;
drop policy if exists "messages_select" on public.chat_messages;
drop policy if exists "messages_insert" on public.chat_messages;

-- Select: anyone can read messages
create policy "messages_select" on public.chat_messages
  for select using (true);

-- Insert: allowed only if the user_id matches the authenticated user's ID
create policy "messages_insert" on public.chat_messages
  for insert with check (auth.uid() is not null and user_id = auth.uid()::text);
