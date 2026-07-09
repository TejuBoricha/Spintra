-- Migration 0051: Fix a security regression introduced by migration 0050
--
-- Found in code review (PR #20), after 0050 was already applied live:
-- 0050's `restrict_host_participant_update()` was written from an outdated
-- copy of this function (migration 0014's original), not the version
-- migration 0019 later replaced it with. 0019 added a critical distinction
-- that 0050 silently dropped:
--   - the room's actual HOST may change is_online on anyone's row, any
--     direction (existing crash-detection behavior)
--   - any OTHER participant may only flip another's is_online from
--     true -> false, never the reverse, never any other column (0019's
--     reconciliation path — can only make stale data MORE accurate)
--
-- 0050's version collapsed both cases into one generic rule with no
-- host/non-host branching and no direction check at all — meaning, live in
-- production since 0050 was pushed, ANY participant could flip ANY other
-- participant's is_online in EITHER direction, reopening exactly the hole
-- 0019 closed. This restores 0019's exact behavior, with 0050's
-- server-verified-write bypass flag layered on top of it (not in place of
-- it) — the bypass is for award_score()'s own trusted writes, not a
-- replacement for the client-vs-client protection this trigger exists for.

create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-verified writes from award_score() (ADR-008/009) bypass this
  -- restriction entirely — see migration 0050's comment on this flag.
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

  -- Updating your own row is unrestricted (normal reconnect/profile sync).
  if old.user_id = auth.uid()::text then
    return new;
  end if;

  -- The room's actual host may change is_online on anyone's row (existing
  -- crash-detection behavior) — restored from migration 0019.
  if exists (
    select 1 from public.rooms
    where code = old.room_id and host_id = auth.uid()::text
  ) then
    if new.username is distinct from old.username
      or new.avatar_url is distinct from old.avatar_url
      or new.xp is distinct from old.xp
      or new.rank is distinct from old.rank
      or new.role is distinct from old.role
      or new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at
    then
      raise exception 'A host may only change is_online on another participant''s row.';
    end if;
    return new;
  end if;

  -- Any other participant of the same room may only flip is_online from
  -- true to false — never to true, never any other column. Restored from
  -- migration 0019; 0050's rewrite silently dropped this direction check
  -- entirely, which is the regression this migration fixes.
  if new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.xp is distinct from old.xp
    or new.rank is distinct from old.rank
    or new.role is distinct from old.role
    or new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.joined_at is distinct from old.joined_at
    or old.is_online is distinct from true
    or new.is_online is distinct from false
  then
    raise exception 'A participant may only mark another participant''s is_online false.';
  end if;

  return new;
end;
$$;
