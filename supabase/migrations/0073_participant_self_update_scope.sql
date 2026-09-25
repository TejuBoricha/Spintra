-- Restrict what a participant may change on their own row (BUG-012).
--
-- `restrict_host_participant_update` waves self-edits through wholesale:
--
--   -- Updating your own row is unrestricted (normal reconnect/profile sync).
--   if old.user_id = auth.uid()::text then
--     return new;
--   end if;
--
-- The RLS policy permits the row, and the trigger then permits every column, so
-- an ordinary player could `PATCH /rest/v1/room_participants` on themselves and
-- set `xp` and `rank` to anything. The QA audit set 999999 / 'legend' and
-- confirmed the write persisted by re-reading the row as superuser, bypassing
-- the engine-authoritative scoring path entirely (`city_finish_match` ->
-- `_record_award`, and `award_score` for every other game).
--
-- Cross-player and cross-room edits were already blocked; only self-edit was
-- open. The comment's intent — "normal reconnect/profile sync" — is right, it
-- just was not scoped to the columns that intent covers.
--
-- Engine-owned and identity columns are now refused on the self path:
--   xp, rank        scoring, written only via _record_award / award_score
--   room_id,user_id identity, changing these would move the row to someone else
--   joined_at       ordering and seniority
--
-- Left alone, because they are genuinely the player's own to change:
--   username, avatar_url   profile
--   is_online              presence / reconnect
--   role                   host election owns this, guarded by its own trigger
--                          and the app.electing_room_host flag checked above
--
-- Both server-side award paths set `app.bypass_participant_restriction` and
-- return before reaching here, so scoring is unaffected.
create or replace function public.restrict_host_participant_update()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
begin
  -- Server-verified writes from award_score() (ADR-008/009)
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

  -- Transaction-local flag set only by elect_room_host (0056)
  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  -- Your own row: profile and presence are yours, scoring and identity are not.
  if old.user_id = auth.uid()::text then
    if new.xp is distinct from old.xp
      or new.rank is distinct from old.rank
      or new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at
    then
      raise exception 'Scores and identity are set by the server, not by the player.';
    end if;
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
$fn$;
