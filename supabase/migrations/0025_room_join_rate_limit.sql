-- Migration 0025: Rate limit new room_participants inserts
--
-- Found in the Session 41 production-readiness audit: room creation and
-- chat messages were rate-limited (migration 0011), but nothing throttled
-- new room joins. Combined with Session 39's change to rank Explore's
-- Trending/Popular rails by real online participant counts, this meant a
-- script could rapid-join (and leave/rejoin) a room to force it onto the
-- most visible rails at zero cost. Same before-insert trigger pattern as
-- 0011, scoped to genuinely new joins only (INSERT, not UPDATE) so a
-- legitimate reconnect — which goes through UPDATE, per trackSelf() in
-- use-room-subscription.ts — is never affected.
--
-- Same caveat as every other auth.uid()-keyed limiter in this app: this
-- raises the bar for a single rotated-in-a-loop script, not a determined
-- attacker rotating anonymous sessions per join (see migration 0001's
-- header and AI_CONTEXT.md's Known Issues) — accepted, not a gap unique to
-- this trigger.

create or replace function public.check_room_join_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  join_limit constant integer := 20;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.room_participants
  where user_id = new.user_id
    and joined_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= join_limit then
    raise exception 'Rate limit exceeded: you can join up to % rooms every % minutes. Please wait before joining another room.', join_limit, window_minutes;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_room_join_rate_limit on public.room_participants;
create trigger trg_check_room_join_rate_limit
  before insert on public.room_participants
  for each row execute function public.check_room_join_rate_limit();

create index if not exists room_participants_user_id_joined_at_idx
  on public.room_participants (user_id, joined_at);
