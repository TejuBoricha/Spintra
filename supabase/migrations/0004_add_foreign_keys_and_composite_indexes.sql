-- Spintra: Database constraints, index optimizations, and cascade delete simplifications.
--
-- 1. Clean up orphaned participant and message rows to allow adding foreign key constraints.
-- 2. Add foreign key constraints with ON DELETE CASCADE to automate cleanup when a room is deleted.
-- 3. Drop the redundant manual trigger and cleanup function.
-- 4. Drop the redundant code index (since code is defined as UNIQUE, Postgres already has a unique index for it).
-- 5. Add optimized composite indexes to support sorting and filtering for chats and participants.

-- Step 1: Clean up any orphaned rows that might exist in development environments
delete from public.room_participants
where room_id not in (select code from public.rooms);

delete from public.chat_messages
where room_id not in (select code from public.rooms);

-- Step 2: Establish database-level foreign key constraints with ON DELETE CASCADE
-- We reference rooms.code which is a unique column in public.rooms.
alter table public.room_participants
  drop constraint if exists fk_room_participants_room;

alter table public.room_participants
  add constraint fk_room_participants_room
  foreign key (room_id) references public.rooms (code)
  on delete cascade;

alter table public.chat_messages
  drop constraint if exists fk_chat_messages_room;

alter table public.chat_messages
  add constraint fk_chat_messages_room
  foreign key (room_id) references public.rooms (code)
  on delete cascade;

-- Step 3: Remove the obsolete cleanup trigger and function since the FK cascades handle this now
drop trigger if exists trg_cleanup_room_children on public.rooms;
drop function if exists public.cleanup_room_children();

-- Step 4: Drop the duplicate index on rooms.code
drop index if exists public.rooms_code_idx;

-- Step 5: Replace single-column index on room_id with composite indexes for better query and sort performance
drop index if exists public.chat_messages_room_id_idx;
create index if not exists chat_messages_room_id_created_at_idx
  on public.chat_messages (room_id, created_at);

drop index if exists public.room_participants_room_id_idx;
create index if not exists room_participants_room_id_joined_at_idx
  on public.room_participants (room_id, joined_at);
