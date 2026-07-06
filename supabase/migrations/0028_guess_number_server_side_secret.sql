-- Migration 0028: Move Guess-the-Number's secret and win-check server-side
--
-- Found in the Session 41 production-readiness audit: the host's secret
-- number was broadcast as a plain Realtime event to every participant
-- (visible directly in devtools/network tab — no need to even try
-- guessing), and each guesser's own client independently computed and
-- broadcast its own "hint" with zero verification, so any client could
-- broadcast a fabricated "correct" result at will. Both problems share one
-- root cause: the secret was known client-side at all. Moves it behind two
-- SECURITY DEFINER RPCs backed by a table with no direct SELECT/INSERT/
-- UPDATE policies of its own, so no client (including the host's, after the
-- initial call) can read the secret back through the API — only compare
-- against it.

create table if not exists public.guess_number_secrets (
  room_code text primary key references public.rooms(code) on delete cascade,
  secret smallint not null check (secret between 1 and 100),
  updated_at timestamptz not null default now()
);

alter table public.guess_number_secrets enable row level security;
-- Deliberately no policies: every access path goes through the SECURITY
-- DEFINER functions below, which bypass RLS as the function owner. Direct
-- PostgREST access (select/insert/update) is denied to every role.

create or replace function public.set_guess_number_secret(p_room_code text, p_secret smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret < 1 or p_secret > 100 then
    raise exception 'Secret must be between 1 and 100.';
  end if;

  if not exists (
    select 1 from public.rooms where code = p_room_code and host_id = auth.uid()::text
  ) then
    raise exception 'Only the host may set the secret number.';
  end if;

  insert into public.guess_number_secrets (room_code, secret, updated_at)
  values (p_room_code, p_secret, now())
  on conflict (room_code) do update set secret = excluded.secret, updated_at = now();
end;
$$;

create or replace function public.check_guess_number(p_room_code text, p_guess smallint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret smallint;
begin
  if not public.is_member_of_room(p_room_code, auth.uid()::text) then
    raise exception 'Only room participants may submit a guess.';
  end if;

  select secret into v_secret from public.guess_number_secrets where room_code = p_room_code;

  if v_secret is null then
    raise exception 'No secret number has been set for this room yet.';
  end if;

  if p_guess = v_secret then
    return 'correct';
  elsif p_guess > v_secret then
    return 'too high';
  else
    return 'too low';
  end if;
end;
$$;

grant execute on function public.set_guess_number_secret(text, smallint) to authenticated, anon;
grant execute on function public.check_guess_number(text, smallint) to authenticated, anon;
