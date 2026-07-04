-- Migration 0018: Let a room's host actually see message reports
--
-- Found in the Session 37 audit: message_reports (migration 0012) was
-- deliberately insert-only with no select policy, "reviewed via Supabase
-- SQL editor" — meaning a user who reports a message gets a success toast,
-- but no host ever sees it in the app itself. Adds a select policy scoped to
-- the room's actual host, and a reviewed flag so a host can dismiss reports
-- they've handled.

alter table public.message_reports
  add column if not exists reviewed boolean not null default false;

drop policy if exists "message_reports_select_host" on public.message_reports;
create policy "message_reports_select_host" on public.message_reports
  for select using (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
  );

drop policy if exists "message_reports_update_host" on public.message_reports;
create policy "message_reports_update_host" on public.message_reports
  for update using (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
  );

-- Restrict the host's update to only the reviewed flag, not the report's
-- historical facts (who reported whom, why, which message).
create or replace function public.restrict_message_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_id is distinct from old.message_id
    or new.room_id is distinct from old.room_id
    or new.reported_user_id is distinct from old.reported_user_id
    or new.reporter_id is distinct from old.reporter_id
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
  then
    raise exception 'A host may only change the reviewed flag on a message report.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restrict_message_report_update on public.message_reports;
create trigger trg_restrict_message_report_update
  before update on public.message_reports
  for each row execute function public.restrict_message_report_update();

alter publication supabase_realtime add table public.message_reports;
