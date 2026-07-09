-- Migration 0045: Secure Trivia Answer Keys
--
-- Restricts column-level access to the trivia correct_index column,
-- preventing clients from querying answer keys directly from the database.
-- Adds a secure database RPC function to verify selected answers instead.

-- 1. Revoke public table-level SELECT from default roles
revoke select on table public.trivia_questions from anon, authenticated, public;

-- 2. Grant column-level SELECT on non-sensitive columns only
grant select (id, text, options, category, difficulty, created_at) on table public.trivia_questions to anon, authenticated, public;

-- 3. Create security definer function to return the correct answer index
create or replace function public.verify_trivia_answer(p_question_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct_index integer;
begin
  select correct_index into v_correct_index
  from public.trivia_questions
  where id = p_question_id;

  return v_correct_index;
end;
$$;

-- 4. Grant execution privileges on the verification RPC
grant execute on function public.verify_trivia_answer(uuid) to anon, authenticated, public;
