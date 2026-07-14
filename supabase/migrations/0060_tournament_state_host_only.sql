-- Migration 0060: only the room's current host may persist tournament state
--
-- Context (docs/HOST_MIGRATION_AUDIT.md, finding H1): room_activity_state's
-- RLS (migration 0035) deliberately lets any participant write it — correct
-- for every other activity, whose scoring either has no stakes (coin flip,
-- dice, wheel) or is independently re-verified server-side via award_score
-- (RPS/Bingo/Trivia, ADR-008/009). Tournament is the one activity with real,
-- visible stakes (bracket results, a declared champion) and zero backstop:
-- its entire scoring flow is client-computed and broadcast with nothing
-- re-deriving or verifying it. Any room member — not just the host — could
-- persist an arbitrary tournament_update (declare themselves champion, wipe
-- a bracket) and have it survive reconnects/replay to every future joiner.
--
-- This closes the persistence half of that gap: only the room's live host
-- (auth.uid() = rooms.host_id, checked fresh on every write, not a cached
-- value) may write an activity_state whose type is 'tournament'. Every
-- other activity type is untouched — the `(new.activity_state ->> 'type')
-- = 'tournament'` guard means this trigger is a no-op for all 13 other
-- games' state and for clearing activity_state entirely (a plain-null write
-- has no type field, so the guard never engages).
--
-- Deliberately narrow, unlike this session's earlier 0056 regression: this
-- trigger only inspects the JSON payload's own `type` discriminator and
-- doesn't touch or re-derive any other function's logic.
--
-- This does not, on its own, stop a forged LIVE broadcast from visually
-- flickering an already-connected client for a moment (broadcasts are
-- pub/sub, delivered before any DB write happens) — that's addressed
-- client-side in tournament-activity.tsx via a self-reported senderId
-- checked against each client's own live-synced host id. That client check
-- is not a security boundary (a determined client could lie about
-- senderId); THIS trigger, checking the real auth.uid(), is.

create or replace function public.restrict_tournament_activity_state_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.activity_state ->> 'type') = 'tournament' then
    if not exists (
      select 1 from public.rooms
      where code = new.room_code and host_id = auth.uid()::text
    ) then
      raise exception 'Only the room host may update tournament state.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restrict_tournament_activity_state_write on public.room_activity_state;
create trigger trg_restrict_tournament_activity_state_write
  before insert or update on public.room_activity_state
  for each row execute function public.restrict_tournament_activity_state_write();
