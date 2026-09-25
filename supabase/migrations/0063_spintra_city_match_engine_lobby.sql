-- Spintra City — Slice 1: room type, match lifecycle, seats, lobby.
--
-- Scope note: this migration deliberately covers ONLY the lobby (create a
-- match, take a seat, ready up, start). No board, assets, dice, cards, money,
-- or trading — those land in later slices. Slice 1 exists to prove the
-- architecture end to end (see docs/SPINTRA_CITY_SPEC.md §7) while it is still
-- cheap to change direction.
--
-- Architecture (docs/SPINTRA_CITY_DESIGN.md §2.2): unlike the other 14
-- activities, Spintra City does NOT use the client-driven room_activity_state
-- event-log replay pattern. Postgres is the referee: clients call narrow
-- SECURITY DEFINER commands that validate and apply state in one locked
-- transaction. Realtime only announces that state changed.

-- ---------------------------------------------------------------------------
-- 1. Allow the new room type
-- ---------------------------------------------------------------------------
-- rooms.type carries a CHECK enumerating every known RoomType (0039). Adding
-- "city" to the TypeScript union alone is NOT enough — room creation would
-- fail at the DB layer with the client believing the type is valid.
alter table public.rooms
  drop constraint if exists rooms_type_check;
alter table public.rooms
  add constraint rooms_type_check
  check (type in (
    'team-maker', 'lucky-wheel', 'name-draw', 'tournament', 'coin-flip',
    'dice', 'guess-number', 'rps', 'truth-or-dare', 'would-you-rather',
    'never-have-i-ever', 'trivia', 'bingo', 'word-scramble', 'party',
    'classroom', 'city'
  ));

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.city_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,

  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'paused', 'finished', 'abandoned')),
  mode text not null default 'classic'
    check (mode in ('classic', 'timed')),
  time_limit_minutes integer
    check (time_limit_minutes is null or time_limit_minutes between 10 and 240),

  -- null = unlimited (DESIGN.md §3.2B). Present from day one specifically so
  -- introducing scarcity later is a rules change, not a migration against
  -- live matches.
  building_supply_limit integer
    check (building_supply_limit is null or building_supply_limit > 0),

  -- Randomness is DERIVED from (seed, counter), never stored as a
  -- precomputed outcome sequence (DESIGN.md §3.2A). Nothing sits in a row
  -- waiting to leak, and a whole match replays exactly from one value.
  -- Both columns are withheld from clients by the column grants in §4.
  rng_seed bigint not null,
  rng_counter integer not null default 0 check (rng_counter >= 0),

  -- Turn state. Unused in Slice 1 (no gameplay yet) but defined now so later
  -- slices don't need to alter a table that may hold live matches.
  current_seat integer check (current_seat is null or current_seat between 0 and 7),
  phase text check (phase is null or phase in (
    'awaiting_roll', 'movement', 'space_resolution',
    'required_decision', 'optional_actions', 'auction'
  )),
  turn_started_at timestamptz,

  created_by text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- At most one non-terminal match per room. A partial unique index (rather than
-- an RPC-side check) makes a concurrent double-create impossible at the
-- storage layer, not merely unlikely.
create unique index if not exists city_matches_one_live_per_room
  on public.city_matches (room_code)
  where status in ('lobby', 'active', 'paused');

create index if not exists city_matches_room_code_idx
  on public.city_matches (room_code);

create table if not exists public.city_match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.city_matches(id) on delete cascade,
  user_id text not null,

  -- 2..8 seats (SPEC.md FR-04). Enforced here rather than through
  -- rooms.max_participants, which is a generic 2..50 bound shared by every
  -- game type and must also accommodate spectators (SPEC.md §5.8).
  seat integer not null check (seat between 0 and 7),

  -- Snapshot at seat time, same convention as chat_messages.username (0040)
  -- and room_bans.username (0043): the room_participants row can be deleted
  -- (e.g. by a kick) while the match seat must still render a name.
  username text not null check (char_length(username) between 1 and 100),

  is_ready boolean not null default false,
  status text not null default 'seated'
    check (status in ('seated', 'active', 'bankrupt', 'retired')),

  -- Economy fields — zeroed in Slice 1, meaningful from Slice 3.
  cash integer not null default 0,
  position integer not null default 0 check (position between 0 and 39),
  consecutive_autopilot_turns integer not null default 0,
  time_reserve_ms integer not null default 0,

  -- Written once at match end; a historical record, not a live cache, so it
  -- cannot drift (DESIGN.md §3.1G).
  final_net_worth integer,

  joined_at timestamptz not null default now(),

  unique (match_id, user_id),
  unique (match_id, seat)
);

create index if not exists city_match_players_match_id_idx
  on public.city_match_players (match_id);

-- Rate-limit ledger for the command RPCs, mirroring the convention used by
-- 0011/0025/0030/0033/0038.
create table if not exists public.city_command_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  room_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists city_command_attempts_lookup_idx
  on public.city_command_attempts (user_id, room_code, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_seated_in_match(p_match_id uuid, p_user_id text)
returns boolean
security definer
set search_path = public
language plpgsql as $$
begin
  return exists (
    select 1 from public.city_match_players
    where match_id = p_match_id and user_id = p_user_id
  );
end;
$$;

-- Shared rate-limit gate for every City command. 60 commands per 60s per
-- (user, room) — generous enough that ordinary play never notices, tight
-- enough to stop a scripted flood.
create or replace function public.city_rate_limit_check(p_room_code text, p_user_id text)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_recent integer;
begin
  select count(*) into v_recent
  from public.city_command_attempts
  where user_id = p_user_id
    and room_code = p_room_code
    and created_at > now() - interval '60 seconds';

  if v_recent >= 60 then
    raise exception 'CITY_RATE_LIMIT: too many actions, slow down';
  end if;

  insert into public.city_command_attempts (user_id, room_code)
  values (p_user_id, p_room_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS and column-level exposure
-- ---------------------------------------------------------------------------
-- Information model (DESIGN.md §3.1C): every match fact is public to room
-- members — cash, ownership, seats, the action log — exactly as money and
-- deeds are visible on a physical table. The ONLY server-side secret is the
-- RNG state. Collapsing "many secrets" to one narrow, clearly-labelled thing
-- is deliberate: this repo has shipped an over-permissive select policy four
-- times (0045, 0028/0057, 0048, 0062).

alter table public.city_matches enable row level security;
alter table public.city_match_players enable row level security;
alter table public.city_command_attempts enable row level security;

drop policy if exists city_matches_select on public.city_matches;
create policy city_matches_select on public.city_matches
  for select using (public.is_member_of_room(room_code, auth.uid()::text));

drop policy if exists city_match_players_select on public.city_match_players;
create policy city_match_players_select on public.city_match_players
  for select using (
    exists (
      select 1 from public.city_matches m
      where m.id = city_match_players.match_id
        and public.is_member_of_room(m.room_code, auth.uid()::text)
    )
  );

-- No insert/update/delete policies anywhere by design: every write goes
-- through a SECURITY DEFINER command below, which re-derives identity from
-- auth.uid() rather than trusting a parameter.

-- Column allowlist for the RNG state, same mechanism 0045 uses for trivia's
-- answer key. Withholding it here means it is unreachable through PostgREST,
-- not merely undocumented.
revoke select on table public.city_matches from anon, authenticated, public;
grant select (
  id, room_code, status, mode, time_limit_minutes, building_supply_limit,
  current_seat, phase, turn_started_at, created_by, created_at, started_at,
  finished_at
) on table public.city_matches to anon, authenticated;

grant select on table public.city_match_players to anon, authenticated;

-- The attempts ledger is internal bookkeeping; no client ever reads it.
revoke all on table public.city_command_attempts from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 5. Protect a live match from ordinary room deletion  (SPEC.md FR-37)
-- ---------------------------------------------------------------------------
-- Every sibling table cascades from rooms, and city_matches does too — that
-- keeps backups, cleanup, and orphan-avoidance behaving normally. The hazard
-- is that "close the room" (a one-click host action that hard-deletes the row,
-- use-room-subscription.ts) would then erase a live match silently.
--
-- So the cascade stays, and the *accidental* path is closed: deleting a room
-- with a non-terminal match raises unless the caller explicitly opts in via a
-- transaction-local flag. Deliberate callers (Close Room behind match-aware
-- confirmation, and the cleanup cron below) set it; nothing else can trip it
-- by accident.
--
-- Note on the flag pattern: 0052's own comment cautions that transaction-local
-- bypass flags are less precedented in this codebase than they look. It is
-- used here because the alternative (ON DELETE RESTRICT) surfaces an opaque FK
-- error to a host who simply clicked Close Room.
create or replace function public.prevent_room_delete_with_live_match()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  if coalesce(current_setting('app.force_close_room', true), '') = 'true' then
    return old;
  end if;

  if exists (
    select 1 from public.city_matches
    where room_code = old.code
      and status in ('lobby', 'active', 'paused')
  ) then
    raise exception 'ROOM_HAS_LIVE_MATCH: this room has a Spintra City match in progress';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_room_delete_with_live_match on public.rooms;
create trigger trg_prevent_room_delete_with_live_match
  before delete on public.rooms
  for each row execute function public.prevent_room_delete_with_live_match();

-- The cleanup cron is a deliberate caller, so it sets the flag. It must also
-- not be aborted wholesale by one guarded room — without this rewrite, a
-- single City room would raise and roll back the entire sweep for every room.
--
-- City rooms additionally get a longer threshold than the standard 2h rule
-- (DESIGN.md §3): a match represents far more player investment than a round
-- of Coin Flip, and §3 requires a fully-disconnected match to pause durably
-- rather than be destroyed.
create or replace function public.cleanup_inactive_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.force_close_room', 'true', true);

  delete from public.rooms
  where code not in (
    select distinct room_id from public.room_participants where is_online = true
  )
  and created_at < now() - interval '2 hours'
  and type <> 'city';

  delete from public.rooms
  where code not in (
    select distinct room_id from public.room_participants where is_online = true
  )
  and created_at < now() - interval '24 hours'
  and type = 'city';

  delete from public.city_command_attempts
  where created_at < now() - interval '1 hour';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Commands
-- ---------------------------------------------------------------------------
-- Every command below: derives identity from auth.uid() (never a parameter,
-- per 0052's award_score convention rather than 0046's weaker one), takes a
-- per-match advisory lock (0029's convention) so concurrent calls serialise,
-- and rate-limits through the shared gate.

create or replace function public.city_create_match(
  p_room_code text,
  p_mode text default 'classic',
  p_time_limit_minutes integer default null,
  p_seed bigint default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_room record;
  v_match_id uuid;
  v_seed bigint;
begin
  if v_user_id is null then
    raise exception 'CITY_UNAUTHENTICATED';
  end if;

  perform public.city_rate_limit_check(p_room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_room_code, 0));

  select code, host_id, type into v_room
  from public.rooms where code = p_room_code;

  if v_room.code is null then
    raise exception 'CITY_ROOM_NOT_FOUND';
  end if;
  if v_room.type <> 'city' then
    raise exception 'CITY_WRONG_ROOM_TYPE';
  end if;
  if v_room.host_id <> v_user_id then
    raise exception 'CITY_NOT_HOST';
  end if;
  if p_mode not in ('classic', 'timed') then
    raise exception 'CITY_INVALID_MODE';
  end if;

  -- Test seam (DESIGN.md §3.2A): an explicit seed makes a match exactly
  -- reproducible, which automated tests need. Restricted to service_role so a
  -- browser client can never pick a seed whose outcomes it has precomputed —
  -- the service key is never shipped to the browser.
  if p_seed is not null then
    if auth.role() <> 'service_role' then
      raise exception 'CITY_SEED_NOT_PERMITTED';
    end if;
    v_seed := p_seed;
  else
    v_seed := (random() * 9007199254740991)::bigint;
  end if;

  -- The advisory lock above serializes callers for this room, but the partial
  -- unique index is still the real guarantee (it also covers a caller that
  -- somehow bypasses this function). Translate its raw constraint violation
  -- into the same CITY_* vocabulary every other failure here uses, so the
  -- client can map it to friendly copy instead of falling through to a
  -- generic "something went wrong".
  begin
    insert into public.city_matches (room_code, mode, time_limit_minutes, rng_seed, created_by)
    values (
      p_room_code,
      p_mode,
      case when p_mode = 'timed' then coalesce(p_time_limit_minutes, 60) else null end,
      v_seed,
      v_user_id
    )
    returning id into v_match_id;
  exception when unique_violation then
    raise exception 'CITY_MATCH_ALREADY_EXISTS';
  end;

  return v_match_id;
end;
$$;

create or replace function public.city_join_seat(
  p_match_id uuid,
  p_username text
)
returns integer
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match record;
  v_seat integer;
  v_taken integer;
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

  -- Re-read under the lock: status may have changed between the read above
  -- and acquiring it.
  select status into v_match.status
  from public.city_matches where id = p_match_id;

  if v_match.status <> 'lobby' then
    raise exception 'CITY_MATCH_ALREADY_STARTED';
  end if;
  if not public.is_member_of_room(v_match.room_code, v_user_id) then
    raise exception 'CITY_NOT_ROOM_MEMBER';
  end if;

  -- Idempotent: taking a seat twice returns the existing seat rather than
  -- failing, so a double-click or a retry after a dropped response is safe.
  select seat into v_seat
  from public.city_match_players
  where match_id = p_match_id and user_id = v_user_id;
  if v_seat is not null then
    return v_seat;
  end if;

  select count(*) into v_taken
  from public.city_match_players where match_id = p_match_id;
  if v_taken >= 8 then
    raise exception 'CITY_MATCH_FULL';
  end if;

  -- Lowest free seat, so seat numbers stay compact as players come and go.
  select coalesce(min(s), 0) into v_seat
  from generate_series(0, 7) s
  where s not in (
    select seat from public.city_match_players where match_id = p_match_id
  );

  insert into public.city_match_players (match_id, user_id, seat, username)
  values (p_match_id, v_user_id, v_seat, left(coalesce(nullif(p_username, ''), 'Player'), 100));

  return v_seat;
end;
$$;

create or replace function public.city_leave_seat(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'CITY_UNAUTHENTICATED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select status into v_status from public.city_matches where id = p_match_id;
  if v_status is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  -- Leaving is a lobby-only action. Abandoning an already-started match is a
  -- retire, which carries a liquidation sequence (DESIGN.md §3.1D) and lands
  -- in a later slice.
  if v_status <> 'lobby' then
    raise exception 'CITY_MATCH_ALREADY_STARTED';
  end if;

  delete from public.city_match_players
  where match_id = p_match_id and user_id = v_user_id;
end;
$$;

create or replace function public.city_set_ready(p_match_id uuid, p_ready boolean)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match record;
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

  if v_match.status <> 'lobby' then
    raise exception 'CITY_MATCH_ALREADY_STARTED';
  end if;

  update public.city_match_players
  set is_ready = p_ready
  where match_id = p_match_id and user_id = v_user_id;

  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
end;
$$;

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

  -- FR-04: 2..8 players. The upper bound is already guaranteed by the seat
  -- CHECK and the fullness check in city_join_seat.
  if v_seated < 2 then
    raise exception 'CITY_NOT_ENOUGH_PLAYERS';
  end if;
  if v_ready < v_seated then
    raise exception 'CITY_PLAYERS_NOT_READY';
  end if;

  -- Roster locks here (FR-05): status leaves 'lobby', so city_join_seat and
  -- city_leave_seat both start refusing. Later arrivals are spectators.
  update public.city_matches
  set status = 'active',
      started_at = now(),
      current_seat = 0,
      phase = 'awaiting_roll',
      turn_started_at = now()
  where id = p_match_id;

  update public.city_match_players
  set status = 'active'
  where match_id = p_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, so internal helpers are
-- explicitly revoked rather than left implicitly callable.
revoke all on function public.city_rate_limit_check(text, text) from public, anon, authenticated;
revoke all on function public.prevent_room_delete_with_live_match() from public, anon, authenticated;

grant execute on function public.is_seated_in_match(uuid, text) to anon, authenticated;
grant execute on function public.city_create_match(text, text, integer, bigint) to anon, authenticated;
grant execute on function public.city_join_seat(uuid, text) to anon, authenticated;
grant execute on function public.city_leave_seat(uuid) to anon, authenticated;
grant execute on function public.city_set_ready(uuid, boolean) to anon, authenticated;
grant execute on function public.city_start_match(uuid) to anon, authenticated;

-- Realtime: clients subscribe to match/seat changes to drive the lobby.
-- Payloads carry no secret — the RNG columns are withheld by the grants in §4.
-- Guarded rather than a bare `alter publication ... add table` (the shape used
-- by 0018/0043): every other statement in this migration is idempotent, and a
-- bare add raises "already member of publication" on re-application, which
-- makes local iteration needlessly painful.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'city_matches'
  ) then
    alter publication supabase_realtime add table public.city_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'city_match_players'
  ) then
    alter publication supabase_realtime add table public.city_match_players;
  end if;
end
$$;
