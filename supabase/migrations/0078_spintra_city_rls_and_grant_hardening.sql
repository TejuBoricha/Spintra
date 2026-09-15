-- Spintra City — Round 3 of the QA audit's fix phase: closes BUG-021,
-- BUG-025, BUG-026 and BUG-027 (the RLS/grants hardening group). Migrations
-- are append-only.
--
-- BUG-025: city_assets, city_auctions and city_trade_offers were all created
-- with a SELECT policy of `using (true)` -- world-readable across every room
-- with nothing but the public anon key. city_assets' own migration comment
-- (0064) says the intent was "public *within a match*", and city_matches /
-- city_match_players (0063) already implement exactly that intent correctly,
-- via is_member_of_room() joined through city_matches. This migration brings
-- the three straggler tables in line with that same, already-established
-- pattern -- copied verbatim, not reinvented.
--
-- BUG-021: city_match_results (0070) is a plain view, executed with its
-- owner's privileges rather than the caller's, so it bypassed the RLS this
-- migration is tightening everywhere else: any anon/authenticated caller
-- could read every finished match's room code, usernames and net worth,
-- site-wide. `security_invoker = true` (Postgres 15+) makes the view
-- evaluate as the calling role instead, so city_matches' and
-- city_match_players' own (already-correct) RLS applies to it for free.
--
-- BUG-026: city_matches and city_match_players never received the explicit
-- `revoke insert, update, delete` every sibling City table got at creation
-- (city_assets/city_board_spaces in 0064, city_auctions in 0069). Not
-- currently exploitable -- RLS has zero write policies on either table, so
-- Postgres denies every write regardless of the table-level grant -- but the
-- grant itself (inherited from 0031's `alter default privileges ... grant
-- ... insert, update, delete ... to anon, authenticated`, applied to every
-- table created after it including rng_seed's own table) sat there as a
-- single missing RLS policy away from a live cash/seed-write hole, which is
-- precisely the shape of a regression this repo has hit before (0050/0051).
-- Revoking now makes the "no policy" protection explicit and redundant with
-- itself, rather than solely implicit.
--
-- BUG-027: re-filed during re-verification against seed entropy, not the
-- EXECUTE grant on city_derive_dice (that function's algorithm is published
-- verbatim in migration 0064's own source and was reimplemented byte-for-byte
-- in 6 lines of Node -- revoking its grant would have provided zero benefit).
-- city_create_match derived a fresh seed with `(random() * 2^53)::bigint`;
-- Postgres's random() is a fast, non-cryptographic PRNG, not suitable for a
-- value the entire match's dice depend on. Switched to pgcrypto's
-- gen_random_bytes(8) (already enabled locally; OpenSSL RAND_bytes under the
-- hood, actually cryptographically secure) via the standard hex-to-bit64
-- cast. Schema-qualified as extensions.gen_random_bytes -- this function
-- runs `set search_path = public`, which does not include the `extensions`
-- schema pgcrypto installs into on this project. The explicit p_seed test
-- seam for service_role (DESIGN.md §3.2A) is untouched.

-- ---------------------------------------------------------------------------
-- BUG-025
-- ---------------------------------------------------------------------------
drop policy if exists "Match assets are readable" on public.city_assets;
create policy "Match assets are readable" on public.city_assets
  for select using (
    exists (
      select 1 from public.city_matches m
      where m.id = city_assets.match_id
        and public.is_member_of_room(m.room_code, auth.uid()::text)
    )
  );

drop policy if exists "Auctions are readable" on public.city_auctions;
create policy "Auctions are readable" on public.city_auctions
  for select using (
    exists (
      select 1 from public.city_matches m
      where m.id = city_auctions.match_id
        and public.is_member_of_room(m.room_code, auth.uid()::text)
    )
  );

drop policy if exists "Trade offers are readable" on public.city_trade_offers;
create policy "Trade offers are readable" on public.city_trade_offers
  for select using (
    exists (
      select 1 from public.city_matches m
      where m.id = city_trade_offers.match_id
        and public.is_member_of_room(m.room_code, auth.uid()::text)
    )
  );

-- ---------------------------------------------------------------------------
-- BUG-021
-- ---------------------------------------------------------------------------
alter view public.city_match_results set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- BUG-026
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.city_matches from anon, authenticated;
revoke insert, update, delete on public.city_match_players from anon, authenticated;

-- ---------------------------------------------------------------------------
-- BUG-027
-- ---------------------------------------------------------------------------
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
  -- browser client can never pick a seed whose outcomes it has precomputed --
  -- the service key is never shipped to the browser.
  if p_seed is not null then
    if auth.role() <> 'service_role' then
      raise exception 'CITY_SEED_NOT_PERMITTED';
    end if;
    v_seed := p_seed;
  else
    -- CSPRNG-derived (pgcrypto/OpenSSL), not Postgres's plain random().
    v_seed := ('x' || encode(extensions.gen_random_bytes(8), 'hex'))::bit(64)::bigint;
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
