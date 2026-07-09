-- Migration 0049: Enforce max_participants bounds (2–50) at the database
--
-- Context: a room's capacity is chosen at creation via a slider bounded
-- min=2 max=50 (create-client.tsx), but the ONLY database constraint is
-- rooms_max_participants_positive (migration 0016: max_participants > 0).
-- The 50 ceiling and the floor of 2 have been enforced only in the browser,
-- so a crafted direct API call could set any positive value — an unbounded
-- worst case for realtime cost (every participant is a presence entry AND a
-- channel connection) and a mismatch between the UI and the data.
--
-- The upcoming Room Settings Panel (ADR-007) lets a host edit capacity after
-- creation, which makes this the moment to make the bound authoritative:
-- one DB constraint that the creation slider, the settings panel, and any
-- raw API call all inherit. 50 stays the deliberate product ceiling; raising
-- it later is a one-line change to make with load evidence, not now.
--
-- Written defensively: any pre-existing out-of-range row is clamped into
-- [2, 50] BEFORE the CHECK is added, so applying this migration can never
-- fail on legacy data (all legitimately-created rooms are already 2–50 via
-- the slider, but a migration must not assume no crafted rows exist).

-- 1. Clamp any existing rows outside the new bounds so the constraint below
--    can be added without a validation failure. LEAST/GREATEST pins each
--    value into [2, 50]; rows already in range are untouched.
update public.rooms
   set max_participants = least(greatest(max_participants, 2), 50)
 where max_participants < 2
    or max_participants > 50;

-- 2. Replace the positive-only constraint (0016) with the full bounded range.
--    The new constraint subsumes the old one (2..50 implies > 0), so the old
--    one is dropped rather than left as a redundant duplicate.
alter table public.rooms
  drop constraint if exists rooms_max_participants_positive;

alter table public.rooms
  drop constraint if exists rooms_max_participants_bounds;

alter table public.rooms
  add constraint rooms_max_participants_bounds
  check (max_participants >= 2 and max_participants <= 50);
