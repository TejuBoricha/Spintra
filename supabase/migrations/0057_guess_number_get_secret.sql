-- Migration 0057: Add get_guess_number_secret RPC to allow host to recover secret after refresh or migration

create or replace function public.get_guess_number_secret(p_room_code text)
returns smallint
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_secret smallint;
begin
  if not exists (
    select 1 from public.rooms where code = p_room_code and host_id = auth.uid()::text
  ) then
    raise exception 'Only the host may view the secret number.';
  end if;

  select secret into v_secret from public.guess_number_secrets where room_code = p_room_code;

  return v_secret;
end;
$body$;

-- Revoke public execution on all guess number RPCs as best practice
revoke execute on function public.get_guess_number_secret(text) from public;
revoke execute on function public.set_guess_number_secret(text, smallint) from public;
revoke execute on function public.check_guess_number(text, smallint) from public;

grant execute on function public.get_guess_number_secret(text) to authenticated, anon;
