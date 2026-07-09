-- Migration 0050: Visual Scoreboard (room_scores) + XP awards (ADR-008, ADR-009)
--
-- Builds the durable, server-verified award mechanism both features share.
-- Evidence gathered before design: of the 14 activities, only Trivia
-- (trivia_answer, already RPC-verified via 0045) and the client-derived RPS
-- winner (independently computed by every client from rps_choice broadcasts
-- — no dedicated event exists) carry a reliable user_id. Bingo's only
-- trustworthy signal, bingo_verified, carries a username but no userId (the
-- raw bingo_win claim has one but is an *unverified* client claim). Scope for
-- v1 (ADR-008 S1) is Trivia + RPS + Bingo only.
--
-- The durable-store choice (ADR-008 S2, chosen deliberately against the
-- lower-risk per-session recommendation) means score writes cannot be raw
-- client INSERTs — a client-writable ledger is trivially spoofable. Every
-- write goes through award_score() below, a SECURITY DEFINER RPC that
-- RE-VERIFIES the claim server-side by reading the persisted
-- room_activity_state event log directly, never trusting client-supplied
-- "I won" claims. This is why the RPC needs activity-specific plpgsql
-- re-derivation logic (trivia's correct-answer check, RPS's resolveRound()
-- re-implemented in SQL, Bingo's card/called-numbers line check) rather than
-- a single generic path.
--
-- Idempotency: room_scores has a UNIQUE constraint on
-- (room_id, user_id, activity_type, round_key, award_kind). round_key is
-- NEVER supplied by the client — the RPC derives it itself from the
-- persisted event log (a monotonic "how many resets have occurred so far"
-- count for RPS/Bingo; the current question's id for Trivia), so a client
-- cannot forge a round_key to bypass the uniqueness check. The XP write
-- piggybacks on this SAME uniqueness check (see award_score's `ins`/
-- `v_inserted` pattern) — if the ledger insert was a no-op (already
-- recorded), XP is not incremented either. One mechanism, both writes.
--
-- The verification-timing race this depends on (the persisted event log is
-- debounced 600ms/max-wait-2s — use-room-subscription.ts) is closed by a new
-- client-side flushActivityState() the caller invokes immediately before
-- calling this RPC, not by anything in this migration.

-- ============================================================================
-- 1. room_scores: append-only ledger of awarded points
-- ============================================================================
create table if not exists public.room_scores (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(code) on delete cascade,
  user_id text not null,
  activity_type text not null check (activity_type in ('trivia', 'rps', 'bingo')),
  award_kind text not null check (award_kind in ('win', 'participation')),
  round_key text not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (room_id, user_id, activity_type, round_key, award_kind)
);

alter table public.room_scores enable row level security;

create index if not exists room_scores_room_id_idx on public.room_scores (room_id);

-- Everyone in the room reads the scoreboard — the opposite visibility model
-- from room_bans/message_reports (host-only). Mirrors room_activity_state's
-- participant-scoped select (migration 0035).
drop policy if exists "room_scores_select_participant" on public.room_scores;
create policy "room_scores_select_participant" on public.room_scores
  for select using (
    exists (
      select 1 from public.room_participants
      where room_id = room_scores.room_id and user_id = (select auth.uid())::text
    )
  );

-- Host-only reset (ADR-008 S3): a bulk delete of the room's ledger, fully
-- decoupled from activity_reset/changeActivity. No insert/update policy
-- exists for regular clients at all — every score-affecting write MUST go
-- through award_score() below.
drop policy if exists "room_scores_delete_host_only" on public.room_scores;
create policy "room_scores_delete_host_only" on public.room_scores
  for delete using (
    exists (
      select 1 from public.rooms
      where code = room_scores.room_id and host_id = (select auth.uid())::text
    )
  );

alter publication supabase_realtime add table public.room_scores;

-- ============================================================================
-- 2. Rate-limit exemption for award_score's room_participants writes
-- ============================================================================
-- The existing 30-updates/60s limit (migration 0038) exists to throttle raw,
-- untrusted client-initiated writes. award_score()'s XP write is a
-- server-verified, controlled write path — the same reasoning already
-- exempts elect_room_host (0046) from any equivalent limit. Re-creates the
-- trigger function with one added guard clause; every other line is
-- unchanged from 0038.
create or replace function public.check_room_participants_update_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_limit constant integer := 30;
  window_seconds constant integer := 60;
  recent_count integer;
  actor text := auth.uid()::text;
begin
  if current_setting('app.bypass_participant_rate_limit', true) = 'true' then
    return new;
  end if;

  select count(*) into recent_count
  from public.room_participants_update_attempts
  where room_id = new.room_id
    and actor_id = actor
    and created_at > now() - (window_seconds || ' seconds')::interval;

  if recent_count >= update_limit then
    perform public.log_moderation_event('room_participants_update_rate_limit', actor, new.room_id, recent_count::text || ' updates in ' || window_seconds || 's');
    raise exception 'Rate limit exceeded: too many updates to this room''s participants. Please slow down.';
  end if;

  insert into public.room_participants_update_attempts (room_id, actor_id) values (new.room_id, actor);

  return new;
end;
$$;

-- ============================================================================
-- 2b. Bypass for the host-participant-update restriction (migration 0014)
-- ============================================================================
-- restrict_host_participant_update() only lets a caller change is_online on
-- another participant's row — exactly the guard that would otherwise block
-- award_score()'s participation fan-out (crediting XP to OTHER online
-- participants when a Bingo round resolves, ADR-008 S5). Found live while
-- testing this migration locally: Bob's legitimate win claim failed with "A
-- participant may only mark another participant's is_online false" the
-- moment the RPC tried to credit Alice/Carol's participation XP. Same
-- bypass-flag pattern as section 2 — server-verified writes from this RPC
-- are not the client-vs-client case this trigger protects against.
create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

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

-- ============================================================================
-- 3. tier_for_xp: single source of truth for rank thresholds (ADR-009),
--    used server-side so room_participants.rank stays correct immediately
--    after an award, not just after the next reconnect's client-driven sync.
--    Mirrors lib/xp.ts's tierOf() — the two must be kept in sync by hand.
-- ============================================================================
create or replace function public.tier_for_xp(p_xp integer)
returns text
language sql
immutable
as $$
  select case
    when p_xp >= 1500 then 'legend'
    when p_xp >= 700 then 'master'
    when p_xp >= 300 then 'challenger'
    when p_xp >= 100 then 'explorer'
    else 'rookie'
  end;
$$;

-- ============================================================================
-- 4. award_score: the shared, server-verified award RPC
-- ============================================================================
-- p_question_id/p_choice_index are only meaningful for activity_type='trivia'
-- (the client already holds this in local component state — there's no
-- reason to make the RPC re-derive it from the event log when a direct,
-- server-verifiable answer key lookup already exists via
-- trivia_questions.correct_index, migration 0045's exact pattern). RPS and
-- Bingo need no client-supplied identifying arguments at all — the RPC
-- derives the current round and the winner entirely from server-persisted
-- state, so there is nothing for a client to spoof.
create or replace function public.award_score(
  p_room_id text,
  p_activity_type text,
  p_question_id uuid default null,
  p_choice_index integer default null
)
returns table (awarded boolean, new_xp integer, new_rank text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
  v_state jsonb;
  v_events jsonb;
  v_round_key text;
  v_award_kind text;
  v_points integer;
  v_xp_delta integer;
  v_inserted boolean := false;
  v_correct_index integer;
  v_boundary_idx integer;
  v_reset_count integer;
  v_choices jsonb;
  v_distinct_choices text[];
  v_winning_choice text;
  v_user_choice text;
  v_called jsonb;
  v_called_numbers integer[];
  v_card jsonb;
  v_card_arr integer[][];
  v_has_line boolean := false;
  v_line integer[][];
  v_col integer;
  v_row integer;
  v_covered boolean;
begin
  -- Caller must be a genuine, currently-tracked participant of this room.
  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = v_user_id
  ) then
    return query select false, null::integer, null::text;
    return;
  end if;

  -- Bypass the participant-update rate limit (section 2) and the
  -- other-participant XP/rank restriction (section 2b) for this RPC's
  -- writes — both exist to constrain raw client-initiated updates; this is
  -- a server-verified path, including when it credits participation XP to
  -- participants other than the caller (Bingo's fan-out, ADR-008 S5).
  perform set_config('app.bypass_participant_rate_limit', 'true', true);
  perform set_config('app.bypass_participant_restriction', 'true', true);

  if p_activity_type = 'trivia' then
    -- Re-verify server-side, identical to verify_trivia_answer (0045) —
    -- never trust a client-supplied "correct" flag for the award itself.
    if p_question_id is null then
      return query select false, null::integer, null::text;
      return;
    end if;

    select correct_index into v_correct_index
    from public.trivia_questions where id = p_question_id;

    v_round_key := p_question_id::text;

    if v_correct_index is not null and p_choice_index = v_correct_index then
      v_award_kind := 'win';
      v_points := 3;
      v_xp_delta := 15;
    else
      v_award_kind := 'participation';
      v_points := 1;
      v_xp_delta := 5;
    end if;

    with ins as (
      insert into public.room_scores (room_id, user_id, activity_type, award_kind, round_key, points)
      values (p_room_id, v_user_id, 'trivia', v_award_kind, v_round_key, v_points)
      on conflict (room_id, user_id, activity_type, round_key, award_kind) do nothing
      returning 1
    )
    select exists(select 1 from ins) into v_inserted;

    if v_inserted then
      update public.room_participants
      set xp = coalesce(xp, 0) + v_xp_delta,
          rank = public.tier_for_xp(coalesce(xp, 0) + v_xp_delta)
      where room_id = p_room_id and user_id = v_user_id;
    end if;

  elsif p_activity_type = 'rps' then
    select activity_state into v_state
    from public.room_activity_state where room_code = p_room_id;
    v_events := coalesce(v_state->'events', '[]'::jsonb);

    -- Round boundary: index of the last reset event (0 if none yet).
    select coalesce(max(idx), 0) into v_boundary_idx
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('rps_reset', 'activity_reset');

    -- Round key: how many resets have occurred so far — a monotonic label
    -- for "this round" that the RPC derives itself, never client-supplied.
    select count(*) into v_reset_count
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('rps_reset', 'activity_reset');
    v_round_key := v_reset_count::text;

    -- Deciding choices: rps_choice events after the boundary, from
    -- currently-online participants only (matches the client's own
    -- decidingChoices filter in rps-activity.tsx), last choice per user.
    with events_ordered as (
      select e.val, e.idx
      from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    ),
    deciding as (
      select distinct on (eo.val->>'userId')
        eo.val->>'userId' as user_id,
        eo.val->>'choice' as choice
      from events_ordered eo
      where eo.val->>'kind' = 'rps_choice'
        and eo.idx > v_boundary_idx
        and exists (
          select 1 from public.room_participants rp
          where rp.room_id = p_room_id and rp.user_id = eo.val->>'userId' and rp.is_online = true
        )
      order by eo.val->>'userId', eo.idx desc
    )
    select
      array_agg(distinct choice),
      (select choice from deciding where user_id = v_user_id)
    into v_distinct_choices, v_user_choice
    from deciding;

    if v_user_choice is null then
      -- Caller never locked in a choice this round — nothing to award.
      return query select false, null::integer, null::text;
      return;
    end if;

    -- Resolve the round exactly like resolveRound() in rps-activity.tsx:
    -- <=1 distinct choice = tie, 3 distinct = no-contest, 2 distinct = decided.
    v_winning_choice := null;
    if array_length(v_distinct_choices, 1) = 2 then
      declare
        a text := v_distinct_choices[1];
        b text := v_distinct_choices[2];
        beats jsonb := '{"Rock":"Scissors","Paper":"Rock","Scissors":"Paper"}'::jsonb;
      begin
        if beats->>a = b then
          v_winning_choice := a;
        else
          v_winning_choice := b;
        end if;
      end;
    end if;

    if v_winning_choice is not null and v_user_choice = v_winning_choice then
      v_award_kind := 'win';
      v_points := 3;
      v_xp_delta := 15;
    else
      v_award_kind := 'participation';
      v_points := 1;
      v_xp_delta := 5;
    end if;

    with ins as (
      insert into public.room_scores (room_id, user_id, activity_type, award_kind, round_key, points)
      values (p_room_id, v_user_id, 'rps', v_award_kind, v_round_key, v_points)
      on conflict (room_id, user_id, activity_type, round_key, award_kind) do nothing
      returning 1
    )
    select exists(select 1 from ins) into v_inserted;

    if v_inserted then
      update public.room_participants
      set xp = coalesce(xp, 0) + v_xp_delta,
          rank = public.tier_for_xp(coalesce(xp, 0) + v_xp_delta)
      where room_id = p_room_id and user_id = v_user_id;
    end if;

  elsif p_activity_type = 'bingo' then
    select activity_state into v_state
    from public.room_activity_state where room_code = p_room_id;
    v_events := coalesce(v_state->'events', '[]'::jsonb);

    select coalesce(max(idx), 0) into v_boundary_idx
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('bingo_reset', 'activity_reset');

    select count(*) into v_reset_count
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('bingo_reset', 'activity_reset');
    v_round_key := v_reset_count::text;

    -- Called numbers since the last reset (bingo_call events accumulate
    -- across the whole round, unlike rps_choice's single-shot-per-round).
    select coalesce(array_agg((e.val->>'number')::integer), array[]::integer[])
    into v_called_numbers
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' = 'bingo_call' and idx > v_boundary_idx;

    -- The caller's own persisted card — never trust a client-supplied card.
    select bingo_card into v_card
    from public.room_participants
    where room_id = p_room_id and user_id = v_user_id;

    if v_card is null then
      return query select false, null::integer, null::text;
      return;
    end if;

    -- Re-implement the exact 12-line check from BINGO_LINES (lib/utils.ts):
    -- 5 rows, 5 columns, 2 diagonals, free space at [2,2].
    for v_line in
      select * from (values
        (array[[0,0],[1,0],[2,0],[3,0],[4,0]]), (array[[0,1],[1,1],[2,1],[3,1],[4,1]]),
        (array[[0,2],[1,2],[2,2],[3,2],[4,2]]), (array[[0,3],[1,3],[2,3],[3,3],[4,3]]),
        (array[[0,4],[1,4],[2,4],[3,4],[4,4]]),
        (array[[0,0],[0,1],[0,2],[0,3],[0,4]]), (array[[1,0],[1,1],[1,2],[1,3],[1,4]]),
        (array[[2,0],[2,1],[2,2],[2,3],[2,4]]), (array[[3,0],[3,1],[3,2],[3,3],[3,4]]),
        (array[[4,0],[4,1],[4,2],[4,3],[4,4]]),
        (array[[0,0],[1,1],[2,2],[3,3],[4,4]]),
        (array[[0,4],[1,3],[2,2],[3,1],[4,0]])
      ) as lines(v_line)
    loop
      v_covered := true;
      for i in 1..5 loop
        v_col := v_line[i][1];
        v_row := v_line[i][2];
        if not (v_col = 2 and v_row = 2) then
          if not ((v_card->v_col->>v_row)::integer = any(v_called_numbers)) then
            v_covered := false;
            exit;
          end if;
        end if;
      end loop;
      if v_covered then
        v_has_line := true;
        exit;
      end if;
    end loop;

    if not v_has_line then
      return query select false, null::integer, null::text;
      return;
    end if;

    -- Winner's own award.
    with ins as (
      insert into public.room_scores (room_id, user_id, activity_type, award_kind, round_key, points)
      values (p_room_id, v_user_id, 'bingo', 'win', v_round_key, 3)
      on conflict (room_id, user_id, activity_type, round_key, award_kind) do nothing
      returning 1
    )
    select exists(select 1 from ins) into v_inserted;

    if v_inserted then
      update public.room_participants
      set xp = coalesce(xp, 0) + 15,
          rank = public.tier_for_xp(coalesce(xp, 0) + 15)
      where room_id = p_room_id and user_id = v_user_id;

      -- Participation credit (ADR-008 S5): every OTHER online participant at
      -- the moment of verification — derived from live room_participants
      -- presence, not a client-supplied roster or a new Bingo event.
      with participants_ins as (
        insert into public.room_scores (room_id, user_id, activity_type, award_kind, round_key, points)
        select p_room_id, rp.user_id, 'bingo', 'participation', v_round_key, 1
        from public.room_participants rp
        where rp.room_id = p_room_id and rp.is_online = true and rp.user_id <> v_user_id
        on conflict (room_id, user_id, activity_type, round_key, award_kind) do nothing
        returning user_id
      )
      update public.room_participants rp
      set xp = coalesce(rp.xp, 0) + 5,
          rank = public.tier_for_xp(coalesce(rp.xp, 0) + 5)
      from participants_ins pi
      where rp.room_id = p_room_id and rp.user_id = pi.user_id;
    end if;

  else
    return query select false, null::integer, null::text;
    return;
  end if;

  return query
    select v_inserted, rp.xp, rp.rank
    from public.room_participants rp
    where rp.room_id = p_room_id and rp.user_id = v_user_id;
end;
$$;

grant execute on function public.award_score(text, text, uuid, integer) to anon, authenticated, public;
