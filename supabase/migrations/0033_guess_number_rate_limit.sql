-- Migration 0033: Rate limit on Guess-the-Number's check_guess_number RPC
--
-- Found in the Session 43 audit re-derivation: migration 0028 moved the
-- secret and hint-check server-side (SECURITY DEFINER), correctly stopping
-- clients from reading the secret directly, but check_guess_number itself
-- has no call-frequency limit, unlike every other write path in this
-- codebase (room creation/joins/messages/reports, migrations 0011/0025/
-- 0030). Since it only verifies room membership, a scripted client can
-- binary-search the 1-100 secret in ~7 rapid calls. This is a low-severity
-- "spoils the party game" issue, not a data-exposure bug, but the fix
-- follows the same before-action count-and-reject pattern used everywhere
-- else, applied inside the RPC instead of a trigger since there's no
-- underlying insert to hang a trigger off.

create table if not exists public.guess_number_attempts (
  id bigserial primary key,
  room_code text not null references public.rooms(code) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now()
);

alter table public.guess_number_attempts enable row level security;
-- Deliberately no policies: only ever written/read by check_guess_number
-- below, which bypasses RLS as the function owner.

create index if not exists guess_number_attempts_room_user_created_idx
  on public.guess_number_attempts (room_code, user_id, created_at);

create or replace function public.check_guess_number(p_room_code text, p_guess smallint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret smallint;
  guess_limit constant integer := 15;
  window_seconds constant integer := 60;
  recent_count integer;
begin
  if not public.is_member_of_room(p_room_code, auth.uid()::text) then
    raise exception 'Only room participants may submit a guess.';
  end if;

  select count(*) into recent_count
  from public.guess_number_attempts
  where room_code = p_room_code
    and user_id = auth.uid()::text
    and created_at > now() - (window_seconds || ' seconds')::interval;

  if recent_count >= guess_limit then
    perform public.log_moderation_event('guess_number_rate_limit', auth.uid()::text, p_room_code, recent_count::text || ' guesses in ' || window_seconds || 's');
    raise exception 'Rate limit exceeded: you can submit up to % guesses every % seconds. Please slow down.', guess_limit, window_seconds;
  end if;

  select secret into v_secret from public.guess_number_secrets where room_code = p_room_code;

  if v_secret is null then
    raise exception 'No secret number has been set for this room yet.';
  end if;

  insert into public.guess_number_attempts (room_code, user_id) values (p_room_code, auth.uid()::text);

  if p_guess = v_secret then
    return 'correct';
  elsif p_guess > v_secret then
    return 'too high';
  else
    return 'too low';
  end if;
end;
$$;
