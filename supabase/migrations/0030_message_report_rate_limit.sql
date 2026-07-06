-- Migration 0030: Rate limit on message_reports
--
-- Found in the Session 41 audit: message_reports (migration 0012) has a
-- unique (message_id, reporter_id) constraint, which stops the same client
-- reporting the same message twice, but nothing stops one identity from
-- rapidly reporting many *different* messages/users in quick succession —
-- the client-side dedup in use-room-chat.ts's reportMessage is an in-memory
-- ref, trivially reset by a page reload, not a real limit. Same
-- before-insert trigger pattern as migration 0011/0025 (security definer,
-- count + raise exception); RLS already guarantees reporter_id = auth.uid(),
-- so counting by that column can't be spoofed by a client.

create or replace function public.check_message_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_limit constant integer := 10;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.message_reports
  where reporter_id = new.reporter_id
    and created_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= report_limit then
    raise exception 'Rate limit exceeded: you can submit up to % reports every % minutes. Please wait before reporting again.', report_limit, window_minutes;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_message_report_rate_limit on public.message_reports;
create trigger trg_check_message_report_rate_limit
  before insert on public.message_reports
  for each row execute function public.check_message_report_rate_limit();

create index if not exists message_reports_reporter_id_created_at_idx
  on public.message_reports (reporter_id, created_at);
