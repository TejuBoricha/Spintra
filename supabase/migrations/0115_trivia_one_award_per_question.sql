-- Trivia: one award per player per question (audit G-3, server half).
--
-- room_scores is unique on (room_id, user_id, activity_type, round_key,
-- award_kind). For trivia the award kind is "win" (right answer) or
-- "participation" (any other answer), so a player whose answers for the
-- same question both reached the server, a wrong pick and then the right
-- one, was recorded twice: 1 + 3 points and 5 + 15 XP for one question.
-- The client now locks after the first click (PR #66), but the server is
-- the place that has to hold, because award_score is callable by anyone
-- in the room.
--
-- _record_award is the shared writer behind award_score for every game, so
-- the rule is scoped to trivia here and rps, bingo and City are untouched.
-- The first answer that is recorded for a question is the one that counts.
-- A transaction-scoped advisory lock keyed on the player and the question
-- makes the check and the insert one step, so two answers sent at the same
-- moment cannot both pass the check.
--
-- Only the function body changes; the grants stay as 0106 left them and are
-- repeated below so this file does not depend on that.

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
  if p_activity_type = 'trivia' then
    perform pg_advisory_xact_lock(
      hashtext('trivia-award:' || p_room_id || ':' || p_user_id || ':' || p_round_key)
    );
    if exists (
      select 1 from public.room_scores
      where room_id = p_room_id
        and user_id = p_user_id
        and activity_type = 'trivia'
        and round_key = p_round_key
    ) then
      return false;
    end if;
  end if;

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

revoke execute on function public._record_award(text, text, text, text, text, integer, integer) from public, anon, authenticated;
