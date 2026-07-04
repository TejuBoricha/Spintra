-- Migration 0014: Restrict two RLS escape hatches to the single column each was meant for
--
-- Found in the Session 37 pre-launch audit: both of these existing policies
-- correctly gate WHO can update a row, but not WHICH columns — a crafted
-- direct API call could ride either escape hatch to rewrite unrelated data.
-- Postgres RLS policies apply to the whole row, not individual columns, so
-- the fix is a BEFORE UPDATE trigger comparing OLD vs NEW for the columns
-- that must stay untouched in each escape-hatch path.

-- ============================================================================
-- 1. rooms: the host-election self-promotion escape hatch (migration 0006)
--    only needs to let a non-host participant set host_id when the room has
--    no online host — not rewrite the room's name/type/visibility/limits.
-- ============================================================================
create or replace function public.restrict_host_promotion_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The actual host can update anything (normal host operations: lock
  -- toggle, settings, etc.) — this trigger only restricts the *other*
  -- branch of the rooms_update policy, where the caller is self-promoting.
  if old.host_id = auth.uid()::text then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.type is distinct from old.type
    or new.is_public is distinct from old.is_public
    or new.is_locked is distinct from old.is_locked
    or new.max_participants is distinct from old.max_participants
    or new.settings is distinct from old.settings
    or new.code is distinct from old.code
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only host_id may change when self-promoting to host.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_host_promotion_update on public.rooms;
create trigger trg_restrict_host_promotion_update
  before update on public.rooms
  for each row execute function public.restrict_host_promotion_update();

-- ============================================================================
-- 2. room_participants: the host-update-participants policy (migration 0007)
--    only needs to let a host mark a crashed participant's is_online false —
--    not rewrite that participant's username/xp/rank/role.
-- ============================================================================
create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Updating your own row is unrestricted (normal reconnect/profile sync).
  if old.user_id = auth.uid()::text then
    return new;
  end if;

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
end;
$$;

drop trigger if exists trg_restrict_host_participant_update on public.room_participants;
create trigger trg_restrict_host_participant_update
  before update on public.room_participants
  for each row execute function public.restrict_host_participant_update();
