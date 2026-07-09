-- Migration 0046: Atomic Host Election RPC
--
-- Creates a secure database RPC to execute host promotion (updating both
-- the participant's role to 'host' and the room's host_id) in a single,
-- atomic Postgres transaction, preventing client-side split-brain desyncs.

create or replace function public.elect_room_host(p_room_code text, p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_exists boolean;
  v_has_online_host boolean;
begin
  -- 1. Verify the room exists
  select exists(select 1 from public.rooms where code = p_room_code) into v_room_exists;
  if not v_room_exists then
    return false;
  end if;

  -- 2. Verify there is no other online host currently in the room
  select exists(
    select 1 from public.room_participants
    where room_id = p_room_code
      and role = 'host'
      and is_online = true
      and user_id <> p_user_id
  ) into v_has_online_host;

  if v_has_online_host then
    return false;
  end if;

  -- 3. Update the participant's role to host
  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id;

  -- 4. Update the room's host reference
  update public.rooms
  set host_id = p_user_id
  where code = p_room_code;

  return true;
end;
$$;

-- Grant execution privileges on the election RPC
grant execute on function public.elect_room_host(text, text) to anon, authenticated, public;
