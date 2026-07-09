-- Migration 0047: Device Fingerprinting for Ban Evasion
--
-- (Filename references IP bans; the actual mechanism below is device-
-- fingerprint-only — no IP address is collected or hashed anywhere in this
-- migration or getDeviceFingerprint(), src/lib/utils.ts. Left the filename
-- as-is rather than renumber/rename an already-numbered migration file for
-- a title-only mismatch.)
--
-- The existing room_bans system (migration 0012) blocks rejoin by matching
-- user_id. Because Spintra uses anonymous authentication, a banned user can
-- clear their browser's localStorage, obtain a fresh anonymous token with a
-- brand-new auth.uid(), and rejoin the exact same room under a different
-- identity — completely bypassing the ban.
--
-- This migration adds a second enforcement layer:
--   1. room_participants gains a `fingerprint_hash` column (supplied by the
--      client at join time — a SHA-256 of stable device signals).
--   2. room_bans gains a `fingerprint_hash` column, populated automatically
--      from the banned user's room_participants row when the ban is inserted.
--   3. The before-insert trigger `check_room_ban_before_join` is updated to
--      block the insert if the room has a ban matching EITHER the user_id OR
--      the fingerprint_hash.
--
-- Net effect: rotating anonymous tokens no longer bypasses bans unless the
-- user also changes their device signals (screen size, timezone, locale, etc.)

-- ============================================================================
-- 1. Add fingerprint_hash column to room_participants
-- ============================================================================
alter table public.room_participants
  add column if not exists fingerprint_hash text;

-- ============================================================================
-- 2. Add fingerprint_hash column to room_bans
-- ============================================================================
alter table public.room_bans
  add column if not exists fingerprint_hash text;

-- ============================================================================
-- 3. Auto-populate fingerprint_hash on room_bans from the participant row
-- ============================================================================
create or replace function public.copy_fingerprint_to_ban()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fill in fingerprint_hash if the inserting client didn't already
  -- supply one. Both real kick call sites (handleKickParticipant,
  -- confirmKickReportedUser) delete the room_participants row before
  -- inserting the ban — by the time this trigger would run its own lookup,
  -- there is nothing left to find, so it would silently overwrite a
  -- correct client-supplied value with null if it ran unconditionally.
  -- This remains a best-effort fallback for any future insert path that
  -- doesn't delete the participant row first.
  if new.fingerprint_hash is null then
    select rp.fingerprint_hash into new.fingerprint_hash
      from public.room_participants rp
     where rp.room_id = new.room_id
       and rp.user_id = new.user_id
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_copy_fingerprint_to_ban on public.room_bans;
create trigger trg_copy_fingerprint_to_ban
  before insert on public.room_bans
  for each row execute function public.copy_fingerprint_to_ban();

-- ============================================================================
-- 4. Update the ban-check trigger to also match on fingerprint_hash
-- ============================================================================
create or replace function public.check_room_ban_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block if there is a ban matching the user_id directly (original behavior)
  -- OR a ban matching the device fingerprint (new behavior).
  if exists (
    select 1 from public.room_bans rb
    where rb.room_id = new.room_id
      and (
        rb.user_id = new.user_id
        or (
          new.fingerprint_hash is not null
          and rb.fingerprint_hash is not null
          and rb.fingerprint_hash = new.fingerprint_hash
        )
      )
  ) then
    raise exception 'You have been banned from this room by the host.';
  end if;
  return new;
end;
$$;

-- Re-create the trigger (function body changed, trigger binding stays the same)
drop trigger if exists trg_check_room_ban on public.room_participants;
create trigger trg_check_room_ban
  before insert on public.room_participants
  for each row execute function public.check_room_ban_before_join();

-- ============================================================================
-- 5. Index for efficient fingerprint lookups during ban checks
-- ============================================================================
create index if not exists room_bans_fingerprint_hash_idx
  on public.room_bans (room_id, fingerprint_hash)
  where fingerprint_hash is not null;
