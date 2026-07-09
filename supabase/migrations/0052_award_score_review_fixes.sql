-- Migration 0052: Fixes from code review of PR #20 (ADR-008/009's award_score)
--
-- Six fixes, all found in code review, none of them security-critical (the
-- one that was — the restrict_host_participant_update regression — was
-- already fixed and pushed separately in migration 0051):
--
-- 1. Trivia's round_key was just the question's UUID. trivia-activity.tsx's
--    drawNextQuestion() reshuffles and can legitimately re-draw the same
--    question once its shuffle bag is exhausted (no cross-cycle exclusion) —
--    a second correct answer to a re-drawn question collided with the first
--    answer's ledger row and silently earned nothing. Fixed by folding the
--    question's sequence number (already broadcast on every trivia_question
--    event as `num`) into the round_key, so a re-drawn question gets a
--    distinct key each time it's actually asked.
-- 2. The insert-with-on-conflict + conditional XP/rank update block was
--    copy-pasted 4 times (trivia win/participation, rps win/participation,
--    bingo win, bingo's participation fan-out). Extracted into a single
--    internal helper, _record_award() — NOT granted execute to anon/
--    authenticated (only award_score, itself SECURITY DEFINER, calls it;
--    granting it directly would let a client forge arbitrary awards,
--    bypassing every verification this migration exists to enforce).
-- 3. room_scores_select_participant hand-rolled the same membership check
--    every other membership-scoped policy in this codebase gets from the
--    shared is_member_of_room() helper (migration 0009) — now reuses it.
-- 4. The RPS/Bingo branches each scanned the persisted event log twice
--    (once for v_boundary_idx, once for v_reset_count) with an identical
--    filter — combined into one scan per branch.
-- 5. This migration's own comment (section 2, in 0050) inaccurately claimed
--    "the same reasoning already exempts elect_room_host (0046) from any
--    equivalent limit" — elect_room_host has no bypass mechanism at all; it
--    was never exempted, it just hasn't been observed hitting the rate
--    limit in practice. Corrected so a future reader doesn't treat the GUC
--    bypass-flag pattern as more precedented than it actually is.
-- 6. award_score is dropped and recreated with a new parameter
--    (p_question_num) — Postgres identifies functions by full signature,
--    so `create or replace` with a different parameter list creates an
--    ADDITIONAL overload rather than truly replacing the old one; the old
--    4-parameter signature is explicitly dropped first to avoid leaving a
--    stale, insecure-by-omission overload live.

-- ============================================================================
-- 1. Corrected comment on the rate-limit bypass (fix 5) — the trigger body
--    itself is unchanged from 0050/0051, only the explanatory comment above
--    it needs correcting. Re-stating the function is the only way to move
--    a comment that sits inside a prior migration's create-or-replace.
-- ============================================================================
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
  -- Server-verified writes from award_score() (ADR-008/009) bypass this
  -- limit entirely — it exists to throttle raw, untrusted client-initiated
  -- writes (e.g. a script spamming `.update({ username })`), which does not
  -- describe a write this RPC has already independently re-verified.
  -- Correction (0052): no other RPC in this codebase uses this bypass
  -- pattern today — elect_room_host (0046) is NOT "exempted" by any
  -- equivalent mechanism, it simply hasn't been observed hitting this
  -- limit in practice. This is the first, not another instance of an
  -- established convention.
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
-- 2. room_scores RLS: reuse is_member_of_room() (fix 3)
-- ============================================================================
drop policy if exists "room_scores_select_participant" on public.room_scores;
create policy "room_scores_select_participant" on public.room_scores
  for select using (
    public.is_member_of_room(room_id, (select auth.uid())::text)
  );

-- ============================================================================
-- 3. _record_award: shared insert+conflict+XP-update helper (fix 2)
-- ============================================================================
-- Deliberately NOT granted execute to anon/authenticated/public — this is
-- an internal building block for award_score only. It performs a raw,
-- unverified ledger insert and XP credit; granting it directly to clients
-- would let anyone forge arbitrary awards, bypassing every server-side
-- verification award_score exists to enforce. award_score can call it
-- regardless of grants because both are SECURITY DEFINER, running as the
-- function owner.
create or replace function public._record_award(
  p_room_id text,
  p_user_id text,
  p_activity_type text,
  p_award_kind text,
  p_round_key text,
  p_points integer,
  p_xp_delta integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
  v_new_xp integer;
begin
  with ins as (
    insert into public.room_scores (room_id, user_id, activity_type, award_kind, round_key, points)
    values (p_room_id, p_user_id, p_activity_type, p_award_kind, p_round_key, p_points)
    on conflict (room_id, user_id, activity_type, round_key, award_kind) do nothing
    returning 1
  )
  select exists(select 1 from ins) into v_inserted;

  if v_inserted then
    update public.room_participants
    set xp = coalesce(xp, 0) + p_xp_delta
    where room_id = p_room_id and user_id = p_user_id
    returning xp into v_new_xp;

    update public.room_participants
    set rank = public.tier_for_xp(v_new_xp)
    where room_id = p_room_id and user_id = p_user_id;
  end if;

  return v_inserted;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on function creation —
-- writing no `grant` statement here does NOT mean "no client can call
-- this" the way it would for a table's default-deny RLS. Explicitly
-- revoking is required, or `authenticated`/`anon` (which inherit PUBLIC's
-- grants) can call this raw, unverified award path directly, defeating
-- every check award_score performs before ever reaching it. Confirmed live
-- while testing this migration: without this revoke, a client-side
-- `supabase.rpc('_record_award', {...})` call succeeded.
revoke execute on function public._record_award(text, text, text, text, text, integer, integer) from public;

-- ============================================================================
-- 4. award_score: rewritten to use _record_award, fix the trivia round_key
--    collision (fix 1), and combine the duplicate boundary/count scans
--    (fix 4). Explicitly drops the old 4-parameter signature first (fix 6).
-- ============================================================================
drop function if exists public.award_score(text, text, uuid, integer);

create or replace function public.award_score(
  p_room_id text,
  p_activity_type text,
  p_question_id uuid default null,
  p_choice_index integer default null,
  p_question_num integer default null
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
  v_distinct_choices text[];
  v_winning_choice text;
  v_user_choice text;
  v_called_numbers integer[];
  v_card jsonb;
  v_has_line boolean := false;
  v_line integer[][];
  v_col integer;
  v_row integer;
  v_covered boolean;
begin
  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = v_user_id
  ) then
    return query select false, null::integer, null::text;
    return;
  end if;

  perform set_config('app.bypass_participant_rate_limit', 'true', true);
  perform set_config('app.bypass_participant_restriction', 'true', true);

  if p_activity_type = 'trivia' then
    if p_question_id is null then
      return query select false, null::integer, null::text;
      return;
    end if;

    select correct_index into v_correct_index
    from public.trivia_questions where id = p_question_id;

    -- Round key folds in the question's sequence number (fix 1) — a
    -- reshuffled, legitimately-repeated question gets a distinct key each
    -- time it's actually asked, instead of colliding with its first answer.
    v_round_key := p_question_id::text || ':' || coalesce(p_question_num, 0)::text;

    if v_correct_index is not null and p_choice_index = v_correct_index then
      v_award_kind := 'win'; v_points := 3; v_xp_delta := 15;
    else
      v_award_kind := 'participation'; v_points := 1; v_xp_delta := 5;
    end if;

    select public._record_award(p_room_id, v_user_id, 'trivia', v_award_kind, v_round_key, v_points, v_xp_delta)
      into v_inserted;

  elsif p_activity_type = 'rps' then
    select activity_state into v_state
    from public.room_activity_state where room_code = p_room_id;
    v_events := coalesce(v_state->'events', '[]'::jsonb);

    -- Boundary index and reset count in one scan (fix 4) — both are
    -- derived from the same reset-event set.
    select coalesce(max(idx), 0), count(*) into v_boundary_idx, v_reset_count
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('rps_reset', 'activity_reset');
    v_round_key := v_reset_count::text;

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
      return query select false, null::integer, null::text;
      return;
    end if;

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
      v_award_kind := 'win'; v_points := 3; v_xp_delta := 15;
    else
      v_award_kind := 'participation'; v_points := 1; v_xp_delta := 5;
    end if;

    select public._record_award(p_room_id, v_user_id, 'rps', v_award_kind, v_round_key, v_points, v_xp_delta)
      into v_inserted;

  elsif p_activity_type = 'bingo' then
    select activity_state into v_state
    from public.room_activity_state where room_code = p_room_id;
    v_events := coalesce(v_state->'events', '[]'::jsonb);

    select coalesce(max(idx), 0), count(*) into v_boundary_idx, v_reset_count
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' in ('bingo_reset', 'activity_reset');
    v_round_key := v_reset_count::text;

    select coalesce(array_agg((e.val->>'number')::integer), array[]::integer[])
    into v_called_numbers
    from jsonb_array_elements(v_events) with ordinality as e(val, idx)
    where e.val->>'kind' = 'bingo_call' and idx > v_boundary_idx;

    select bingo_card into v_card
    from public.room_participants
    where room_id = p_room_id and user_id = v_user_id;

    if v_card is null then
      return query select false, null::integer, null::text;
      return;
    end if;

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

    select public._record_award(p_room_id, v_user_id, 'bingo', 'win', v_round_key, 3, 15)
      into v_inserted;

    if v_inserted then
      -- Participation credit (ADR-008 S5): every OTHER online participant,
      -- one _record_award call each — still the shared helper, just called
      -- once per recipient instead of the hand-rolled bulk UPDATE 0050 had.
      declare
        v_other record;
      begin
        for v_other in
          select rp.user_id from public.room_participants rp
          where rp.room_id = p_room_id and rp.is_online = true and rp.user_id <> v_user_id
        loop
          perform public._record_award(p_room_id, v_other.user_id, 'bingo', 'participation', v_round_key, 1, 5);
        end loop;
      end;
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

grant execute on function public.award_score(text, text, uuid, integer, integer) to anon, authenticated, public;
