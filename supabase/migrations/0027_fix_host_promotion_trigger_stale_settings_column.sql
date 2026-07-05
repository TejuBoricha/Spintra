-- Migration 0027: Fix restrict_host_promotion_update() referencing a dropped column
--
-- Live production bug: migration 0014's restrict_host_promotion_update()
-- trigger function compares new.settings against old.settings, but
-- migration 0017 (which ran after) dropped rooms.settings entirely and
-- never updated this function. Since plpgsql resolves NEW/OLD record field
-- access at execution time, not at CREATE FUNCTION time, this didn't fail
-- until the trigger actually ran — every self-promotion host election
-- (electHostIfNeeded, whenever the current host has gone offline) has been
-- failing with "record "new" has no field "settings"" ever since 0017
-- shipped. Recreated with the settings comparison removed; every other
-- restricted column is unchanged.

create or replace function public.restrict_host_promotion_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The actual host can update anything (normal host operations: lock
  -- toggle, activity state, etc.) — this trigger only restricts the *other*
  -- branch of the rooms_update policy, where the caller is self-promoting.
  if old.host_id = auth.uid()::text then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.type is distinct from old.type
    or new.is_public is distinct from old.is_public
    or new.is_locked is distinct from old.is_locked
    or new.max_participants is distinct from old.max_participants
    or new.code is distinct from old.code
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only host_id may change when self-promoting to host.';
  end if;

  return new;
end;
$$;
