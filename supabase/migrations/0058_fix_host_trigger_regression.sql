-- Migration 0058: Fix host participant update trigger regression
--
-- Restores the correct host/participant branching logic from migration 0051
-- that was accidentally overwritten by migration 0056, while preserving
-- 0056's app.electing_room_host bypass and 0050's app.bypass_participant_restriction bypass.

create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-verified writes from award_score() (ADR-008/009)
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

  -- Transaction-local flag set only by elect_room_host (0056)
  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  -- Updating your own row is unrestricted (normal reconnect/profile sync).
  if old.user_id = auth.uid()::text then
    return new;
  end if;

  -- The room's actual host may change is_online on anyone's row (existing
  -- crash-detection behavior) — restored from migration 0019/0051.
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
  -- migration 0019/0051; 0056's rewrite silently dropped this direction check.
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
