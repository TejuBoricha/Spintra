# Pending migrations (drafts, not applied, not tested against a database)

Two small migrations are designed and written but **not** in `supabase/migrations/`, because a file placed there is applied to production by the deploy workflow when its PR merges, and neither has been run against the local database yet. As of `main` = `ed6a90e` the latest migration is **0114**, so these are **0115** and **0116**. Each needs a row in `docs/ARCHITECTURE.md` §4 (migration table) or the docs-drift gate fails.

Written 2026-09-30 during the product-audit fixes. Nothing here has been reviewed by the owner.

## 0115: one trivia award per player per question (audit G-3, server half)

**Problem.** `room_scores` is unique on `(room_id, user_id, activity_type, round_key, award_kind)`. For trivia the kind is `win` (right answer) or `participation` (any other), so if a wrong pick and the right one both reach `award_score` for the same question, both are recorded (1 + 3 points, 5 + 15 XP). PR #66 fixed the client (the buttons lock on the first click), but `award_score` is callable by anyone in the room, so the server has to hold too.

**Design.** Redefine `_record_award` (the shared writer behind `award_score`; last defined in 0052, grants changed in 0106). For `activity_type = 'trivia'` only: take a transaction-scoped advisory lock keyed on room, user and round, then return `false` if any trivia row already exists for that user and round. RPS, bingo and City are untouched. The lock makes the check and the insert one step, so two answers sent at the same moment cannot both pass. `create or replace` keeps the function's grants; the file repeats the `revoke` for safety.

**Before applying, verify (none of this has been done):**
1. `npx supabase@2.109.0 db reset` applies 0001 to 0115 from scratch.
2. A SQL or Playwright-with-psql check: for one room and question, call `award_score` twice as the same user with different choices (one right, one wrong, both orders). Expected: one `room_scores` row, XP changed once, second call returns `awarded = false`. Confirm the same scenario writes two rows on the current code (that is the before-evidence).
3. Two parallel calls for the same user and question (two psql sessions) record one row.
4. `scripts/city-regression.mjs` still reports its expected count (City uses `_record_award` with another activity type; the trivia branch must not touch it).
5. The existing trivia specs (`multiplayer-loop.spec.ts` "XP earned from a trivia win survives an immediate reconnect", `qa-x33-trivia-answer-guards.spec.ts`) still pass.

```sql
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
```

## 0116: replace a dare that texts someone outside the room (audit K-4)

**Problem.** Migration 0008 seeded "Text your crush right now" into `activity_prompts` (the in-room Truth or Dare deck). The standalone page's deck already lost this kind of dare (audit K-1 to K-3, K-5, K-6, built on the branch, see `HANDOFF.md`).

**Design.** An idempotent `update` matched on the exact text, type and category, so a row an operator already edited is left alone.

**Before applying, verify:** `db reset` applies it; `select prompt_data from activity_prompts where prompt_data->>'text' = 'Text your crush right now'` returns no row afterwards and the replacement text exists once; running the statement twice changes nothing.

```sql
-- Replace a dare that asks a player to message someone outside the room
-- (audit K-4). Migration 0008 seeded "Text your crush right now" into the
-- in-room Truth or Dare deck. The standalone page's deck lost the same kind of
-- dare in the content pass, because it asks a player to contact a real
-- person who never agreed to play, and it is a bad dare for a classroom
-- room. The replacement keeps everything inside the room.
--
-- Matched on the exact text and type, so a deck an operator has already
-- edited is left alone, and running it twice changes nothing.

update public.activity_prompts
set prompt_data = '{"text": "Describe your day as a movie trailer voiceover"}'
where activity_type = 'truth-or-dare'
  and category = 'dare'
  and prompt_data->>'text' = 'Text your crush right now';
```

## When these are turned into real migrations

Copy each block to `supabase/migrations/0115_trivia_one_award_per_question.sql` and `0116_replace_text_your_crush_dare.sql`, add the two rows to `docs/ARCHITECTURE.md` §4 (and update its "Current status" line), record the verification in `TASKS.md` and `CHANGELOG_AI.md`, and delete this file. They go in one PR (both are small and independent); the deploy workflow applies them when it merges, so merge only when CI is green on the exact head.
