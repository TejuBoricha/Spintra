-- Migration 0009: Backend and Database Improvements
--
-- 1. Security Definer Helper: is_member_of_room
-- 2. Hardened RLS policies for room_participants and chat_messages to prevent cross-room leaks
-- 3. Room Participant Limit Trigger to enforce max_participants constraint at DB level
-- 4. Room Lifecycle Garbage Collection function

-- ============================================================================
-- 1. Security Definer Helper Function
-- ============================================================================
-- This function checks if a user is a member of a room. Being defined as SECURITY DEFINER
-- allows it to bypass RLS recursion on the room_participants table.
create or replace function public.is_member_of_room(room_code text, user_uuid text)
returns boolean
security definer
set search_path = public
language plpgsql as $$
begin
  return exists (
    select 1 from public.room_participants
    where room_id = room_code and user_id = user_uuid
  );
end;
$$;

-- ============================================================================
-- 2. Hardened RLS Policies
-- ============================================================================

-- A. room_participants Policies
drop policy if exists "participants_select" on public.room_participants;
create policy "participants_select" on public.room_participants
  for select using (
    user_id = auth.uid()::text
    or public.is_member_of_room(room_id, auth.uid()::text)
    or exists (
      select 1 from public.rooms
      where rooms.code = room_participants.room_id
        and rooms.is_public = true
    )
  );

-- B. chat_messages Policies
drop policy if exists "messages_select" on public.chat_messages;
create policy "messages_select" on public.chat_messages
  for select using (
    public.is_member_of_room(room_id, auth.uid()::text)
    or exists (
      select 1 from public.rooms
      where rooms.code = chat_messages.room_id
        and (rooms.is_public = true or rooms.host_id = auth.uid()::text)
    )
  );

-- ============================================================================
-- 3. Room Participant Limit Trigger
-- ============================================================================
create or replace function public.check_room_limit_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_limit integer;
begin
  -- Get the limit from the rooms table
  select max_participants into max_limit from public.rooms where code = new.room_id;
  
  -- If room doesn't exist, let it fail at foreign key constraint
  if max_limit is null then
    return new;
  end if;
  
  -- Count the current participants
  select count(*) into current_count from public.room_participants where room_id = new.room_id;
  
  if current_count >= max_limit then
    raise exception 'This room has reached its maximum participant limit of %', max_limit;
  end if;
  
  return new;
end;
$$;

drop trigger if exists trg_check_room_limit on public.room_participants;
create trigger trg_check_room_limit
  before insert on public.room_participants
  for each row execute function public.check_room_limit_before_join();

-- ============================================================================
-- 4. Room Lifecycle Garbage Collection
-- ============================================================================
create or replace function public.cleanup_inactive_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete rooms where there are no online participants and the room was created > 2 hours ago.
  -- Due to ON DELETE CASCADE on child tables, this automatically deletes participants and messages.
  delete from public.rooms
  where code not in (
    select distinct room_id
    from public.room_participants
    where is_online = true
  )
  and created_at < now() - interval '2 hours';
end;
$$;

-- Note to administrator:
-- To schedule this function to run every 30 minutes in Supabase, run the following SQL:
-- select cron.schedule('cleanup-inactive-rooms-cron', '*/30 * * * *', 'select public.cleanup_inactive_rooms()');
