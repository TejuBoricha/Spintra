-- Spintra City — Slice 2: the board, server-authoritative dice, and movement.
--
-- Scope note: this migration covers rolling, moving, passing Departure, the
-- doubles rule, and ending a turn. It deliberately does NOT resolve what a
-- player lands ON — no rent, buying, cards, tax or detention effects. Those
-- are Slice 3. A landing currently just parks the token and opens the optional
-- actions window (docs/SPINTRA_CITY_SPEC.md §7).
--
-- 0063 is append-only from here even though it has not reached production:
-- it is committed and applied to local stacks, and every other migration in
-- this repo follows the append-only convention. Editing it would silently
-- diverge anyone who already ran it.

-- ---------------------------------------------------------------------------
-- 1. The board, as authoritative server data
-- ---------------------------------------------------------------------------
-- Prices and rents live in Postgres, not in the client bundle: rent is money,
-- and a client that can redefine a rent table can rewrite the economy. The
-- board is not secret, so it is world-readable — it is *authorship* that must
-- stay server-side, not confidentiality.
--
-- Content source: docs/SPINTRA_CITY_CONTENT.md §3 and §4.

create table if not exists public.city_board_spaces (
  idx integer primary key check (idx between 0 and 39),
  name text not null,
  kind text not null check (kind in
    ('corner', 'property', 'airport', 'utility', 'tax', 'card')),

  -- country set key for properties; null for everything else
  country text,
  price integer check (price is null or price > 0),
  build_cost integer check (build_cost is null or build_cost > 0),

  -- [base, hostel, inn, hotel, resort, landmark] — 6 entries for properties
  rent integer[],

  -- tax spaces only
  tax_amount integer check (tax_amount is null or tax_amount > 0),

  -- which deck a card space draws from
  deck text check (deck is null or deck in ('boarding_pass', 'city_fund')),

  constraint city_board_property_shape check (
    kind <> 'property' or (country is not null and price is not null
      and build_cost is not null and array_length(rent, 1) = 6)
  )
);

comment on table public.city_board_spaces is
  'Reference data: the 40 board spaces with authoritative prices and rents. Seeded, never user-written.';

insert into public.city_board_spaces (idx, name, kind, country, price, build_cost, rent, tax_amount, deck) values
  (0,  'Departure',     'corner',   null, null, null, null, null, null),
  (1,  'Porto',         'property', 'pt',   55,   50, '{4,20,60,180,320,450}',        null, null),
  (2,  'Boarding Pass', 'card',     null, null, null, null, null, 'boarding_pass'),
  (3,  'Lisbon',        'property', 'pt',   65,   50, '{4,20,60,180,320,450}',        null, null),
  (4,  'Travel Tax',    'tax',      null, null, null, null, 180, null),
  (5,  'Heathrow',      'airport',  null,  190, null, null, null, null),
  (6,  'Kraków',        'property', 'pl',   90,  100, '{7,35,100,300,450,600}',       null, null),
  (7,  'City Fund',     'card',     null, null, null, null, null, 'city_fund'),
  (8,  'Gdańsk',        'property', 'pl',   90,  100, '{7,35,100,300,450,600}',       null, null),
  (9,  'Warsaw',        'property', 'pl',  110,  100, '{7,35,100,300,450,600}',       null, null),
  (10, 'Customs',       'corner',   null, null, null, null, null, null),
  (11, 'Osaka',         'property', 'jp',  130,  100, '{11,50,150,450,625,750}',      null, null),
  (12, 'Power Grid',    'utility',  null,  140, null, null, null, null),
  (13, 'Kyoto',         'property', 'jp',  130,  100, '{11,50,150,450,625,750}',      null, null),
  (14, 'Tokyo',         'property', 'jp',  150,  100, '{11,50,150,450,625,750}',      null, null),
  (15, 'Changi',        'airport',  null,  190, null, null, null, null),
  (16, 'Cape Town',     'property', 'za',  170,  150, '{15,70,200,550,750,900}',      null, null),
  (17, 'City Fund',     'card',     null, null, null, null, null, 'city_fund'),
  (18, 'Durban',        'property', 'za',  170,  150, '{15,70,200,550,750,900}',      null, null),
  (19, 'Jo''burg',      'property', 'za',  190,  150, '{15,70,200,550,750,900}',      null, null),
  (20, 'Layover',       'corner',   null, null, null, null, null, null),
  (21, 'Melbourne',     'property', 'au',  210,  150, '{19,90,250,700,875,1050}',     null, null),
  (22, 'Boarding Pass', 'card',     null, null, null, null, null, 'boarding_pass'),
  (23, 'Brisbane',      'property', 'au',  210,  150, '{19,90,250,700,875,1050}',     null, null),
  (24, 'Sydney',        'property', 'au',  235,  150, '{19,90,250,700,875,1050}',     null, null),
  (25, 'Schiphol',      'airport',  null,  190, null, null, null, null),
  (26, 'Montréal',      'property', 'ca',  255,  200, '{23,110,330,800,975,1150}',    null, null),
  (27, 'Vancouver',     'property', 'ca',  255,  200, '{23,110,330,800,975,1150}',    null, null),
  (28, 'Data Centre',   'utility',  null,  140, null, null, null, null),
  (29, 'Toronto',       'property', 'ca',  280,  200, '{23,110,330,800,975,1150}',    null, null),
  (30, 'Detained',      'corner',   null, null, null, null, null, null),
  (31, 'Jaipur',        'property', 'in',  300,  200, '{27,130,390,900,1100,1275}',   null, null),
  (32, 'Bengaluru',     'property', 'in',  300,  200, '{27,130,390,900,1100,1275}',   null, null),
  (33, 'City Fund',     'card',     null, null, null, null, null, 'city_fund'),
  (34, 'Mumbai',        'property', 'in',  330,  200, '{27,130,390,900,1100,1275}',   null, null),
  (35, 'Dubai Intl',    'airport',  null,  190, null, null, null, null),
  (36, 'Boarding Pass', 'card',     null, null, null, null, null, 'boarding_pass'),
  (37, 'Abu Dhabi',     'property', 'ae',  360,  200, '{35,175,500,1100,1300,1500}',  null, null),
  (38, 'Luxury Duty',   'tax',      null, null, null, null,  90, null),
  (39, 'Dubai',         'property', 'ae',  420,  200, '{35,175,500,1100,1300,1500}',  null, null)
on conflict (idx) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Per-match ownership
-- ---------------------------------------------------------------------------
-- One row per owned space per match. Absence means "unowned" — cheaper than
-- seeding 40 rows per match, and it makes "who owns what" a plain join.
-- Ownership is the source of truth; nothing derived from it is stored
-- (DESIGN.md §3.1G).

create table if not exists public.city_assets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.city_matches(id) on delete cascade,
  space_idx integer not null references public.city_board_spaces(idx),
  owner_seat integer not null check (owner_seat between 0 and 7),

  -- 0..4 buildings, 5 = the Landmark (hotel-equivalent)
  buildings integer not null default 0 check (buildings between 0 and 5),
  is_mortgaged boolean not null default false,

  acquired_at timestamptz not null default now(),

  unique (match_id, space_idx)
);

create index if not exists city_assets_match_owner_idx
  on public.city_assets (match_id, owner_seat);

-- A mortgaged property cannot carry buildings — they must be sold first
-- (DESIGN.md §3.1D). Enforced here so no command path can produce the state.
alter table public.city_assets
  drop constraint if exists city_assets_mortgage_excludes_buildings;
alter table public.city_assets
  add constraint city_assets_mortgage_excludes_buildings
  check (not (is_mortgaged and buildings > 0));

-- ---------------------------------------------------------------------------
-- 3. Turn clock and roll state
-- ---------------------------------------------------------------------------
-- The turn clock is pausable (DESIGN.md §3): it runs only while the game is
-- waiting on the active player alone. Storing elapsed-so-far plus a paused-at
-- marker lets the server compute the true deadline without a background job.
alter table public.city_matches
  add column if not exists turn_clock_elapsed_ms integer not null default 0
    check (turn_clock_elapsed_ms >= 0),
  add column if not exists turn_clock_paused_at timestamptz,
  -- host pace preset, locked at match start (SPEC.md FR-42)
  add column if not exists pace_seconds integer not null default 40
    check (pace_seconds in (25, 40, 60)),
  add column if not exists last_roll integer[],
  add column if not exists doubles_count integer not null default 0
    check (doubles_count between 0 and 3);

-- 0063 revokes blanket SELECT on city_matches and grants it column by column,
-- so that rng_seed and rng_counter can never be read by a client. Columns added
-- above are therefore INVISIBLE until named here — without this the client gets
-- a 403 on the whole row, not a null for the new fields. (Found by running the
-- app against this migration: every match fetch failed with 42501.)
--
-- rng_seed and rng_counter stay revoked, deliberately.
grant select (
  turn_clock_elapsed_ms, turn_clock_paused_at, pace_seconds, last_roll, doubles_count
) on table public.city_matches to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.city_board_spaces enable row level security;
alter table public.city_assets enable row level security;

drop policy if exists "Board spaces are public reference data" on public.city_board_spaces;
create policy "Board spaces are public reference data"
  on public.city_board_spaces for select using (true);

-- Assets are public within a match: ownership is open information in this
-- genre, and hiding it would break the trading loop.
drop policy if exists "Match assets are readable" on public.city_assets;
create policy "Match assets are readable"
  on public.city_assets for select using (true);

-- No direct writes from clients — every mutation goes through a command RPC.
revoke insert, update, delete on public.city_assets from anon, authenticated;
revoke insert, update, delete on public.city_board_spaces from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Dice
-- ---------------------------------------------------------------------------
-- Derived from (rng_seed, rng_counter) rather than random(), so a match is
-- reproducible from its seed and a test can pin outcomes (DESIGN.md §3.2A).
-- Two bytes per die keeps modulo bias at 4/65536 (~0.006%), which is far below
-- anything observable in play.
create or replace function public.city_derive_dice(p_seed bigint, p_counter integer)
returns integer[]
language plpgsql
immutable
as $$
declare
  v_hash bytea := decode(md5(p_seed::text || ':' || p_counter::text), 'hex');
begin
  return array[
    ((get_byte(v_hash, 0) * 256 + get_byte(v_hash, 1)) % 6) + 1,
    ((get_byte(v_hash, 2) * 256 + get_byte(v_hash, 3)) % 6) + 1
  ];
end;
$$;

comment on function public.city_derive_dice(bigint, integer) is
  'Deterministic 2d6 from a match seed and counter. Pure — same inputs always give the same roll.';

-- ---------------------------------------------------------------------------
-- 6. Commands
-- ---------------------------------------------------------------------------

create or replace function public.city_roll_dice(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_dice integer[];
  v_from integer;
  v_to integer;
  v_passed boolean := false;
  v_salary constant integer := 200;
  v_is_doubles boolean;
  v_detained boolean := false;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if not found then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  -- re-read under the lock: everything below depends on it not having moved
  select * into v_match from public.city_matches where id = p_match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase <> 'awaiting_roll' then
    raise exception 'CITY_WRONG_PHASE';
  end if;

  v_dice := public.city_derive_dice(v_match.rng_seed, v_match.rng_counter);
  v_is_doubles := v_dice[1] = v_dice[2];
  v_from := v_me.position;

  -- Three doubles in a row is a trip to Customs — no movement, no salary.
  if v_is_doubles and v_match.doubles_count = 2 then
    v_to := 10;
    v_detained := true;
  else
    v_to := (v_from + v_dice[1] + v_dice[2]) % 40;
    v_passed := (v_from + v_dice[1] + v_dice[2]) >= 40;
  end if;

  update public.city_match_players
     set position = v_to,
         cash = cash + case when v_passed then v_salary else 0 end
   where id = v_me.id;

  update public.city_matches
     set rng_counter = rng_counter + 1,
         last_roll = v_dice,
         doubles_count = case
           when v_detained then 0
           when v_is_doubles then doubles_count + 1
           else 0 end,
         -- Slice 2 parks the token; landing effects arrive in Slice 3.
         phase = 'optional_actions',
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return jsonb_build_object(
    'dice', v_dice,
    'from', v_from,
    'to', v_to,
    'passed_departure', v_passed,
    'salary', case when v_passed then v_salary else 0 end,
    'doubles', v_is_doubles,
    'detained', v_detained
  );
end;
$$;

create or replace function public.city_end_turn(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
  v_again boolean := false;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if not found then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  select * into v_match from public.city_matches where id = p_match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase = 'awaiting_roll' then
    raise exception 'CITY_MUST_ROLL_FIRST';
  end if;

  -- Doubles grant another roll (SPEC.md FR-16), and the clock resets with it
  -- (FR-44) — each re-roll is a fresh decision cycle, not a continuation.
  if v_match.doubles_count between 1 and 2 then
    v_again := true;
    v_next := v_me.seat;
  else
    -- next still-playing seat, wrapping
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > v_me.seat
     order by seat limit 1;

    if v_next is null then
      select seat into v_next
        from public.city_match_players
       where match_id = p_match_id
         and status not in ('bankrupt', 'retired')
       order by seat limit 1;
    end if;
  end if;

  update public.city_matches
     set current_seat = v_next,
         phase = 'awaiting_roll',
         doubles_count = case when v_again then doubles_count else 0 end,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return jsonb_build_object('next_seat', v_next, 'roll_again', v_again);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Fund the economy at match start
-- ---------------------------------------------------------------------------
-- 0063's city_start_match left every seat on cash = 0, which was correct while
-- Slice 1 had no economy at all. Slice 2 introduces the Departure salary, so
-- money now moves — and paying a salary into an unfunded economy would mean
-- players start bankrupt the first time rent lands in Slice 3. Redefined here
-- rather than edited in 0063, which is append-only.
--
-- Starting cash is granted at START, not at seat time: a lobby seat carries no
-- money, so leaving and retaking a seat can never mint any.
create or replace function public.city_start_match(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match record;
  v_host text;
  v_seated integer;
  v_ready integer;
  v_starting_cash constant integer := 1600;  -- CONTENT.md §5
begin
  if v_user_id is null then
    raise exception 'CITY_UNAUTHENTICATED';
  end if;

  select id, room_code, status into v_match
  from public.city_matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select status into v_match.status from public.city_matches where id = p_match_id;
  if v_match.status <> 'lobby' then
    raise exception 'CITY_MATCH_ALREADY_STARTED';
  end if;

  select host_id into v_host from public.rooms where code = v_match.room_code;
  if v_host <> v_user_id then
    raise exception 'CITY_NOT_HOST';
  end if;

  select count(*), count(*) filter (where is_ready)
  into v_seated, v_ready
  from public.city_match_players where match_id = p_match_id;

  if v_seated < 2 then
    raise exception 'CITY_NOT_ENOUGH_PLAYERS';
  end if;
  if v_ready < v_seated then
    raise exception 'CITY_PLAYERS_NOT_READY';
  end if;

  update public.city_matches
  set status = 'active',
      started_at = now(),
      current_seat = 0,
      phase = 'awaiting_roll',
      turn_started_at = now(),
      turn_clock_elapsed_ms = 0,
      turn_clock_paused_at = null,
      doubles_count = 0
  where id = p_match_id;

  update public.city_match_players
  set status = 'active',
      cash = v_starting_cash,
      position = 0
  where match_id = p_match_id;
end;
$$;

revoke all on function public.city_start_match(uuid) from public;
grant execute on function public.city_start_match(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.city_roll_dice(uuid) from public;
revoke all on function public.city_end_turn(uuid) from public;
grant execute on function public.city_roll_dice(uuid) to anon, authenticated;
grant execute on function public.city_end_turn(uuid) to anon, authenticated;
grant execute on function public.city_derive_dice(bigint, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Realtime
-- ---------------------------------------------------------------------------
-- Guarded: ALTER PUBLICATION ... ADD TABLE is not idempotent and raises if the
-- table is already a member (the mistake 0063 hit on re-application).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'city_assets'
  ) then
    alter publication supabase_realtime add table public.city_assets;
  end if;
end;
$$;
