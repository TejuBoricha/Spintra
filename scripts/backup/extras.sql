-- Prints SQL that recreates what `supabase db dump` leaves out but Spintra
-- depends on, so a restore brings back a working app, not just its data:
--
--   * RLS policies on realtime.messages (private room channels are
--     authorized by these; without them every room channel refuses
--     everyone). RLS itself is on by default there, and only Supabase's
--     own role may change that, so the restore check asserts it instead.
--   * pg_cron jobs (room cleanup), with their on/off state.
--
-- Run against the live database at backup time (psql -At -f); the output is
-- saved as extras.sql next to roles/schema/data and applied last on
-- restore. Read-only: it only selects.
select format('drop policy if exists %I on %I.%I;', policyname, schemaname, tablename)
       || chr(10)
       || format(
            'create policy %I on %I.%I as %s for %s to %s%s%s;',
            policyname, schemaname, tablename, permissive, cmd,
            array_to_string(array(select quote_ident(r) from unnest(roles) as r), ', '),
            case when qual is not null then ' using (' || qual || ')' else '' end,
            case when with_check is not null then ' with check (' || with_check || ')' else '' end
          )
from pg_policies
where schemaname = 'realtime'
union all
-- Named jobs keep their name and on/off state (a job disabled during an
-- incident must not come back enabled); unnamed ones use the two-argument
-- form.
select case
         when jobname is not null then
           format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
           || case when not active
                then chr(10) || format('update cron.job set active = false where jobname = %L;', jobname)
                else '' end
         else format('select cron.schedule(%L, %L);', schedule, command)
       end
from cron.job;
