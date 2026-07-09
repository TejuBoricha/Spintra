-- Migration 0041: First-party analytics events
--
-- Session 45 audit finding: zero analytics/telemetry anywhere, deliberately
-- deferred at the time rather than reaching for a third-party tool — the
-- site's cookie banner already promises "no advertising or third-party
-- tracking," so this has to be a first-party event log in the app's own
-- Supabase project instead.
--
-- Deliberately small scope: 3 events that answer real product questions
-- (how many rooms get created, do people who join actually stick around
-- long enough to matter, which games get played) rather than instrumenting
-- every click. No FK to rooms.code — rooms get deleted on close/cascade
-- (migration 0002), and aggregate counts should survive that, not get wiped
-- with the room. No select policy: this is internal operational data, not
-- shown to any user in the app, readable only via the Supabase
-- Dashboard/service role — consistent with moderation_events (migration
-- 0032) and the cookie banner's promise.
create table if not exists public.analytics_events (
  id bigserial primary key,
  event_name text not null check (event_name in ('room_created', 'room_joined', 'activity_started')),
  activity_type text,
  actor_id text not null,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events
  for insert with check (actor_id = (select auth.uid())::text);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events (event_name, created_at);

-- Same defense-in-depth rate limiting as every other client-writable insert
-- path in this app (rooms/messages/joins/reports, migrations 0011/0025/0030,
-- room_participants updates migration 0038) — a compromised or malicious
-- client could otherwise hammer this table directly via devtools, bypassing
-- the UI actions that normally trigger it. Generous: legitimate use is at
-- most a few dozen of these per session (creating/joining a handful of
-- rooms, switching activities), not hundreds.
create table if not exists public.analytics_events_insert_attempts (
  id bigserial primary key,
  actor_id text not null,
  created_at timestamptz not null default now()
);

alter table public.analytics_events_insert_attempts enable row level security;

create index if not exists analytics_events_insert_attempts_actor_created_idx
  on public.analytics_events_insert_attempts (actor_id, created_at);

create or replace function public.check_analytics_events_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_limit constant integer := 100;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.analytics_events_insert_attempts
  where actor_id = new.actor_id
    and created_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= event_limit then
    perform public.log_moderation_event('analytics_events_rate_limit', new.actor_id, null, recent_count::text || ' events in ' || window_minutes || 'm');
    raise exception 'Rate limit exceeded: too many analytics events. Please slow down.';
  end if;

  insert into public.analytics_events_insert_attempts (actor_id) values (new.actor_id);

  return new;
end;
$$;

drop trigger if exists trg_check_analytics_events_rate_limit on public.analytics_events;
create trigger trg_check_analytics_events_rate_limit
  before insert on public.analytics_events
  for each row execute function public.check_analytics_events_rate_limit();
