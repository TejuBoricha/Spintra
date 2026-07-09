-- Migration 0038: Rate limit room_participants UPDATEs
--
-- Every other write path in this app (room/message/join/report creation,
-- migrations 0011/0025/0030) is rate-limited, but room_participants UPDATEs
-- never were — found in the Session 45 audit. A client can call
-- `.update({ username: ... })` on its own row at unlimited frequency; each
-- UPDATE fans out as a postgres_changes event to every subscriber in the
-- room, making this a realtime-message-flood vector against other
-- participants' clients (and the project's Realtime message quota),
-- distinct from all previously-fixed INSERT-side abuse.
--
-- Scoped to avoid breaking legitimate high-frequency-looking but rare
-- flows: a reconnect (one UPDATE), a host-election self-promotion (one
-- UPDATE), and presence-reconciliation writes (occasional, one per crashed
-- peer noticed) all comfortably fit inside a generous per-actor budget.
-- Keyed on auth.uid() (the actor performing the write, not the row being
-- written) since that's who a spam script actually authenticates as.

create table if not exists public.room_participants_update_attempts (
  id bigserial primary key,
  room_id text not null references public.rooms(code) on delete cascade,
  actor_id text not null,
  created_at timestamptz not null default now()
);

alter table public.room_participants_update_attempts enable row level security;
-- Deliberately no policies: only ever written/read by the trigger below,
-- which bypasses RLS as a security definer function.

create index if not exists room_participants_update_attempts_room_actor_created_idx
  on public.room_participants_update_attempts (room_id, actor_id, created_at);

create or replace function public.check_room_participants_update_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_limit constant integer := 30;
  window_seconds constant integer := 60;
  recent_count integer;
  actor text := auth.uid()::text;
begin
  select count(*) into recent_count
  from public.room_participants_update_attempts
  where room_id = new.room_id
    and actor_id = actor
    and created_at > now() - (window_seconds || ' seconds')::interval;

  if recent_count >= update_limit then
    perform public.log_moderation_event('room_participants_update_rate_limit', actor, new.room_id, recent_count::text || ' updates in ' || window_seconds || 's');
    raise exception 'Rate limit exceeded: too many updates to this room''s participants. Please slow down.';
  end if;

  insert into public.room_participants_update_attempts (room_id, actor_id) values (new.room_id, actor);

  return new;
end;
$$;

drop trigger if exists trg_check_room_participants_update_rate_limit on public.room_participants;
create trigger trg_check_room_participants_update_rate_limit
  before update on public.room_participants
  for each row execute function public.check_room_participants_update_rate_limit();
