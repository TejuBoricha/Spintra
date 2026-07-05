-- Migration 0020: Actually schedule the room auto-expiry job.
--
-- Migration 0009 created public.cleanup_inactive_rooms() (deletes rooms with
-- no online participants that are more than 2 hours old, cascading to their
-- participants/messages) but only left a comment telling an administrator to
-- run `cron.schedule(...)` by hand in the Supabase SQL editor. That manual
-- step was never actually done, so rooms have persisted indefinitely in
-- production ever since — this migration closes that gap by enabling
-- pg_cron and scheduling the existing function directly, so it no longer
-- depends on a human remembering a one-off manual step.

create extension if not exists pg_cron with schema extensions;

-- Idempotent: drop any prior schedule under this name before recreating it,
-- so re-running this migration (or a future edit to the schedule/command)
-- doesn't fail or double-schedule the job.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-inactive-rooms-cron') then
    perform cron.unschedule('cleanup-inactive-rooms-cron');
  end if;
end;
$$;

select cron.schedule(
  'cleanup-inactive-rooms-cron',
  '*/30 * * * *',
  $$select public.cleanup_inactive_rooms()$$
);
