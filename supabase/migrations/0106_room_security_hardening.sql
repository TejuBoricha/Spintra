-- Room security hardening (audit wave 1: D-1, D-13, D-2, D-3, D-4, D-8,
-- D-9, G-1).
--
-- Every hole closed here was reproduced against the local database with an
-- ordinary anonymous session, and the grants were confirmed on production:
--
--   D-1   elect_room_host trusted its p_user_id argument, so anyone could
--         make any user (themselves included) host of any room. Checking
--         the caller isn't enough on its own: any member may mark another
--         member offline (crash detection), so a member could mark the
--         host offline and elect themselves a moment later. A host must
--         now have been offline for 15 seconds before anyone can replace
--         them, and a connected host marks itself back online at once.
--   D-13  rooms_update let any member rewrite host_id once the host was
--         offline, and a member could set role = 'host' on their own row.
--   D-2   _record_award (the raw score/XP writer behind award_score) was
--         executable by anon and authenticated.
--   D-3   chat_messages accepted posts from non-members and kicked users,
--         under any display name.
--   D-4   clients chose created_at / joined_at / participant_count, which
--         bypassed every rate limit and kept rooms out of cleanup forever.
--   D-8   a non-host could overwrite a running tournament with another game.
--   D-9   internal helpers (cleanup, moderation log) were callable by anyone.
--   G-1   any player could switch everyone's game or push host events
--         (prompts, questions, spins) over the room's broadcast channel.
--
-- Server-side maintenance (psql as postgres, pg_cron, the service role) has
-- no auth.uid(). The forcing triggers below skip those callers; RLS already
-- stops a signed-out REST caller from reaching these tables at all.

-- ---------------------------------------------------------------------------
-- When each participant row last went offline. Server-set: a flip to
-- offline stamps now(), a flip to online clears it, and nothing else can
-- change it. Rows already offline before this migration have it null,
-- which elect_room_host treats as long gone.
-- ---------------------------------------------------------------------------
alter table public.room_participants add column if not exists offline_since timestamptz;

create or replace function public.track_participant_offline_since()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_online then
    new.offline_since := null;
  elsif tg_op = 'INSERT' or old.is_online then
    new.offline_since := now();
  else
    new.offline_since := old.offline_since;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aa_track_offline_since on public.room_participants;
create trigger trg_aa_track_offline_since
  before insert or update on public.room_participants
  for each row execute function public.track_participant_offline_since();

-- Two exemptions from the participant-update rate limit (0038). A player
-- marking their own row back online: a connected host does exactly that
-- when someone marks them offline, and must never be rate-limited out of it
-- (repeated offline flips could then outlast the grace period). And
-- elect_room_host's own writes, which are server-checked like award_score's.
create or replace function public.check_room_participants_update_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_limit constant integer := 30;
  window_seconds constant integer := 60;
  recent_count integer;
  actor text := auth.uid()::text;
begin
  if current_setting('app.bypass_participant_rate_limit', true) = 'true' then
    return new;
  end if;

  -- elect_room_host's own row changes are server-checked, like award_score's.
  -- Counting them against the caller could leave a room with no host.
  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  if old.user_id = actor
     and old.is_online = false and new.is_online = true
     and (to_jsonb(new) - 'is_online' - 'offline_since') = (to_jsonb(old) - 'is_online' - 'offline_since') then
    return new;
  end if;

  select count(*) into recent_count
  from public.room_participants_update_attempts
  where room_id = new.room_id
    and actor_id = actor
    and created_at > now() - (window_seconds || ' seconds')::interval;

  if recent_count >= update_limit then
    perform public.log_moderation_event('room_participants_update_rate_limit', actor, new.room_id, recent_count::text || ' updates in ' || window_seconds || 's');
    raise exception 'Rate limit exceeded: too many updates to this room''s participants. Please slow down.';
  end if;

  insert into public.room_participants_update_attempts (room_id, actor_id) values (new.room_id, actor);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- D-1: elect_room_host may only elect the caller, and only while the caller
-- is online in the room. The client already passes its own auth uid
-- (room-client.tsx sets currentUser.id from the session), so the signature
-- stays the same.
-- ---------------------------------------------------------------------------
create or replace function public.elect_room_host(p_room_code text, p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_host_id text;
  v_has_online_host boolean;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid()::text then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_room_code));

  select host_id into v_current_host_id
  from public.rooms
  where code = p_room_code;

  if not found then
    return false;
  end if;

  if v_current_host_id = p_user_id then
    return false;
  end if;

  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_code and user_id = p_user_id and is_online = true
  ) then
    return false;
  end if;

  -- The current host must be offline, and for at least 15 seconds, so a
  -- member can't mark a live host offline and take over in the gap before
  -- the host's client marks itself back online.
  select exists(
    select 1 from public.room_participants
    where room_id = p_room_code
      and role = 'host'
      and user_id <> p_user_id
      and (is_online = true or offline_since > now() - interval '15 seconds')
  ) into v_has_online_host;

  if v_has_online_host then
    return false;
  end if;

  perform set_config('app.electing_room_host', 'true', true);
  update public.room_participants
  set role = 'participant'
  where room_id = p_room_code and role = 'host' and user_id <> p_user_id;

  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id;

  update public.rooms
  set host_id = p_user_id
  where code = p_room_code;

  return true;
end;
$$;

revoke execute on function public.elect_room_host(text, text) from public, anon;
grant execute on function public.elect_room_host(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- D-13: only the host may update a room row directly. The old second branch
-- (any member, while no host was online) existed for self-promotion, which
-- elect_room_host has done atomically since 0061; nothing in the client
-- writes host_id directly.
-- ---------------------------------------------------------------------------
drop policy if exists "rooms_update" on public.rooms;
create policy "rooms_update" on public.rooms
  for update
  using (host_id = auth.uid()::text)
  with check (host_id = auth.uid()::text);

-- Server-managed room columns. Direct updates (RLS: the host only) may not
-- touch them; elect_room_host may change host_id only; the participant-count
-- trigger (a nested trigger) may change participant_count only.
create or replace function public.restrict_host_promotion_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if current_setting('app.electing_room_host', true) = 'true' then
    if (to_jsonb(new) - 'host_id') is distinct from (to_jsonb(old) - 'host_id') then
      raise exception 'Host election may only change host_id.';
    end if;
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    if (to_jsonb(new) - 'participant_count') is distinct from (to_jsonb(old) - 'participant_count') then
      raise exception 'Only participant_count may change here.';
    end if;
    return new;
  end if;

  if new.host_id is distinct from old.host_id
    or new.participant_count is distinct from old.participant_count
    or new.created_at is distinct from old.created_at
    or new.code is distinct from old.code
    or new.id is distinct from old.id
  then
    raise exception 'That room field is managed by the server.';
  end if;

  return new;
end;
$$;

-- D-13 (second path): a player may not promote their own row to host. They
-- may keep or regain host only when rooms.host_id already names them (the
-- reconnect path in use-room-subscription.ts). Demoting yourself stays free.
create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  if old.user_id = auth.uid()::text then
    if new.xp is distinct from old.xp
      or new.rank is distinct from old.rank
      or new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at
    then
      raise exception 'Scores and identity are set by the server, not by the player.';
    end if;
    if new.role = 'host' and old.role is distinct from 'host' and not exists (
      select 1 from public.rooms
      where code = old.room_id and host_id = auth.uid()::text
    ) then
      raise exception 'Only the room host can hold the host role.';
    end if;
    return new;
  end if;

  if exists (
    select 1 from public.rooms
    where code = old.room_id and host_id = auth.uid()::text
  ) then
    if new.username is distinct from old.username
      or new.avatar_url is distinct from old.avatar_url
      or new.xp is distinct from old.xp
      or new.rank is distinct from old.rank
      or new.role is distinct from old.role
      or new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at
    then
      raise exception 'A host may only change is_online on another participant''s row.';
    end if;
    return new;
  end if;

  if new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.xp is distinct from old.xp
    or new.rank is distinct from old.rank
    or new.role is distinct from old.role
    or new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.joined_at is distinct from old.joined_at
    or old.is_online is distinct from true
    or new.is_online is distinct from false
  then
    raise exception 'A participant may only mark another participant''s is_online false.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- D-4 (and the insert half of D-13): server-owned values on insert. Named
-- trg_aa_* so they run before the existing rate-limit, capacity and
-- single-host triggers, which then see the corrected row.
-- ---------------------------------------------------------------------------
create or replace function public.force_room_insert_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.created_at := now();
  new.participant_count := 0;
  return new;
end;
$$;

drop trigger if exists trg_aa_force_room_insert_values on public.rooms;
create trigger trg_aa_force_room_insert_values
  before insert on public.rooms
  for each row execute function public.force_room_insert_values();

create or replace function public.force_participant_insert_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.joined_at := now();
  new.xp := 0;
  new.rank := 'rookie';
  if new.role = 'host' and not exists (
    select 1 from public.rooms
    where code = new.room_id and host_id = new.user_id
  ) then
    new.role := 'participant';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aa_force_participant_insert_values on public.room_participants;
create trigger trg_aa_force_participant_insert_values
  before insert on public.room_participants
  for each row execute function public.force_participant_insert_values();

-- Chat: server time, and the sender's name as it is in the room, so nobody
-- can post under someone else's display name.
create or replace function public.force_chat_message_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return new;
  end if;
  new.created_at := now();
  select username into v_username
  from public.room_participants
  where room_id = new.room_id and user_id = new.user_id;
  if v_username is not null then
    new.username := v_username;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aa_force_chat_message_values on public.chat_messages;
create trigger trg_aa_force_chat_message_values
  before insert on public.chat_messages
  for each row execute function public.force_chat_message_values();

create or replace function public.force_message_report_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return new;
  end if;
  new.created_at := now();
  new.reviewed := false;
  select username into v_username
  from public.room_participants
  where room_id = new.room_id and user_id = new.reporter_id;
  new.reporter_username := v_username;
  return new;
end;
$$;

drop trigger if exists trg_aa_force_message_report_values on public.message_reports;
create trigger trg_aa_force_message_report_values
  before insert on public.message_reports
  for each row execute function public.force_message_report_values();

-- ---------------------------------------------------------------------------
-- D-3: only members of the room may post. A kicked user's row is deleted by
-- moderation_kick_ban, and room_bans stops them rejoining, so membership
-- covers both.
-- ---------------------------------------------------------------------------
drop policy if exists "messages_insert" on public.chat_messages;
create policy "messages_insert" on public.chat_messages
  for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()::text
    and public.is_member_of_room(room_id, auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- D-2, D-9: internal functions are not client API.
-- ---------------------------------------------------------------------------
revoke execute on function public._record_award(text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_inactive_rooms() from public, anon, authenticated;
revoke execute on function public.log_moderation_event(text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- G-1 and D-8: the server records, numbers and delivers every game event.
--
-- Before: every client broadcast game events itself on room:<CODE> (no
-- verified sender, so any player could switch the game or push prompts),
-- and every client upserted its whole event log into room_activity_state
-- (so any player could rewrite the history late joiners replay, including
-- a running tournament).
--
-- After: send_room_event is the only way a game event reaches anyone. It
-- checks who may send it (host events: the host; player events: any member,
-- stamped with their real id and name), numbers it with the room's next
-- sequence number, records it in room_activity_state, and broadcasts it on
-- room:<CODE>:events, a topic members can receive on but not send to.
-- Clients no longer write room_activity_state at all. The sequence number
-- lets a client see exactly which events it has: a gap in the numbers means
-- it missed one, and it catches up from the recorded log.
-- ---------------------------------------------------------------------------
create or replace function public.room_host_event_kinds()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'coin_flipping', 'coin_flip', 'dice_rolling', 'dice_roll',
    'wheel_entries', 'wheel_spinning', 'name_draw_winner', 'nd_winner',
    'team_maker_teams', 'tm_teams', 'tod_prompt', 'wyr_prompt', 'nhie_prompt',
    'trivia_question', 'scramble_word', 'bingo_call', 'bingo_reset',
    'bingo_verified', 'guess_reset', 'rps_reset', 'tournament_update',
    'tournament_format_selected', 'activity_reset'
  ]::text[];
$$;

-- A player's own answers and votes.
create or replace function public.room_player_event_kinds()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'wyr_vote', 'nhie_confess', 'rps_choice', 'trivia_answer',
    'guess_submit', 'bingo_win', 'scramble_correct'
  ]::text[];
$$;

drop trigger if exists trg_restrict_tournament_activity_state_write on public.room_activity_state;
drop function if exists public.restrict_tournament_activity_state_write();
drop policy if exists "room_activity_state_insert_participant" on public.room_activity_state;
drop policy if exists "room_activity_state_update_participant" on public.room_activity_state;
revoke insert, update, delete on public.room_activity_state from anon, authenticated;

-- Per-sender, per-room event budget: 40 events per 10 seconds. One row per
-- sender, updated in place. Nothing else reads it; clients have no access.
create table if not exists public.room_event_rate (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id text not null,
  window_start timestamptz not null default now(),
  event_count integer not null default 0,
  primary key (room_code, user_id)
);
alter table public.room_event_rate enable row level security;
revoke all on public.room_event_rate from anon, authenticated;

-- activity_state.session is the sequence number of the activity_change
-- that started the current log, so a client can tell a fresh log for the
-- same game (A, then B, then A again) from the one it already has.
--
-- Returns the event's sequence number, or null when the eventId was already
-- recorded (a retried send), in which case nothing is broadcast again.
-- The broadcast is {senderId, originId, seq, payload}: senderId is the
-- verified caller, originId the sending tab (the sender applies its own
-- event locally and skips the echo; the same user's other tabs still
-- apply it).
drop function if exists public.send_room_event(text, text, jsonb, text);
create or replace function public.send_room_event(
  p_room_code text,
  p_event text,
  p_payload jsonb,
  p_origin text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_room_type text;
  v_host_id text;
  v_username text;
  v_count integer;
  v_type text;
  v_kind text;
  v_payload jsonb := p_payload;
  v_state jsonb;
  v_events jsonb;
  v_next jsonb;
  v_seq bigint;
  v_over integer;
  v_player_count integer;
  v_drop_player integer;
  v_drop_host integer;
  v_max_size integer;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;

  select type, host_id into v_room_type, v_host_id
  from public.rooms
  where code = p_room_code;
  if not found then
    raise exception 'Room not found.';
  end if;

  select username into v_username
  from public.room_participants
  where room_id = p_room_code and user_id = v_uid;
  if not found then
    raise exception 'Join the room first.';
  end if;

  insert into public.room_event_rate as r (room_code, user_id, window_start, event_count)
  values (p_room_code, v_uid, now(), 1)
  on conflict (room_code, user_id) do update set
    window_start = case when r.window_start < now() - interval '10 seconds' then now() else r.window_start end,
    event_count = case when r.window_start < now() - interval '10 seconds' then 1 else r.event_count + 1 end
  returning event_count into v_count;
  if v_count > 40 then
    raise exception 'Too many game events. Slow down for a few seconds.';
  end if;

  -- One writer at a time per room, so numbers and log order agree.
  perform pg_advisory_xact_lock(hashtext('send_room_event:' || p_room_code));
  select activity_state into v_state
  from public.room_activity_state
  where room_code = p_room_code;
  v_seq := coalesce((v_state ->> 'seq')::bigint, 0) + 1;

  if p_event = 'activity_change' then
    if v_host_id is distinct from v_uid then
      raise exception 'Only the room host can do that.';
    end if;
    if pg_column_size(v_payload) > 2000 then
      raise exception 'Event too large.';
    end if;
    v_type := v_payload ->> 'type';
    if v_type is not null then
      if v_room_type in ('party', 'classroom') then
        if v_type not in ('team-maker', 'lucky-wheel', 'name-draw', 'tournament', 'coin-flip',
                          'dice', 'guess-number', 'rps', 'truth-or-dare', 'would-you-rather',
                          'never-have-i-ever', 'trivia', 'bingo', 'word-scramble') then
          raise exception 'Unknown game.';
        end if;
        if v_room_type = 'classroom'
           and v_type in ('truth-or-dare', 'would-you-rather', 'never-have-i-ever') then
          raise exception 'That game is not available in Classroom rooms.';
        end if;
      elsif v_type <> v_room_type then
        raise exception 'This room only plays %.', v_room_type;
      end if;
    end if;

    -- A new game starts a fresh log; the same game again (a retried send
    -- whose first attempt did land) keeps it. The sequence carries on
    -- either way, so a client never mistakes a new number for a seen one.
    if v_type is null then
      v_next := jsonb_build_object('seq', v_seq);
    elsif (v_state ->> 'type') is distinct from v_type then
      v_next := jsonb_build_object('type', v_type, 'seq', v_seq, 'session', v_seq, 'events', '[]'::jsonb);
    else
      v_next := jsonb_set(v_state, '{seq}', to_jsonb(v_seq));
    end if;

    insert into public.room_activity_state (room_code, activity_state)
    values (p_room_code, v_next)
    on conflict (room_code) do update set activity_state = excluded.activity_state;

  elsif p_event = 'activity_event' then
    v_kind := v_payload ->> 'kind';
    if v_kind = any (public.room_host_event_kinds()) then
      if v_host_id is distinct from v_uid then
        raise exception 'Only the room host can do that.';
      end if;
      -- A tournament_update carries the whole bracket; nothing else the
      -- host sends comes close to 50KB.
      v_max_size := 50000;
      if v_kind = 'tournament_update' then
        v_max_size := 400000;
      end if;
      if pg_column_size(v_payload) > v_max_size then
        raise exception 'Event too large.';
      end if;
      if v_payload ? 'senderId' then
        v_payload := jsonb_set(v_payload, '{senderId}', to_jsonb(v_uid));
      end if;
    elsif v_kind = any (public.room_player_event_kinds()) then
      -- An answer or vote is a few hundred bytes; anything bigger could
      -- only be padding meant to fill the log (200 x 1KB stays well under
      -- the 500KB size check, so players can't crowd out the host).
      if pg_column_size(v_payload) > 1000 then
        raise exception 'Event too large.';
      end if;
      -- A player speaks only for themselves, set whether or not the
      -- client included the field, so nothing lands under nobody.
      if v_kind in ('wyr_vote', 'nhie_confess', 'rps_choice', 'trivia_answer', 'bingo_win') then
        v_payload := jsonb_set(v_payload, '{userId}', to_jsonb(v_uid));
      end if;
      v_payload := jsonb_set(v_payload, '{username}', to_jsonb(coalesce(v_username, 'Guest')));
    else
      raise exception 'Unknown game event.';
    end if;

    -- A single-game room has no activity_change; its log starts here.
    if (v_state ->> 'type') is null and v_room_type not in ('party', 'classroom') then
      v_state := jsonb_build_object('type', v_room_type, 'seq', v_seq - 1, 'session', v_seq, 'events', '[]'::jsonb);
    end if;

    if (v_state ->> 'type') is null then
      -- Party or classroom room with no game running: nothing to record.
      return null;
    end if;

    v_events := case when jsonb_typeof(v_state -> 'events') = 'array'
                     then v_state -> 'events' else '[]'::jsonb end;

    if (v_payload ->> 'eventId') is not null and exists (
      select 1 from jsonb_array_elements(v_events) as x(e)
      where x.e ->> 'eventId' = v_payload ->> 'eventId'
    ) then
      return null;
    end if;

    v_payload := v_payload || jsonb_build_object('seq', v_seq);

    if v_kind = 'activity_reset' then
      -- The reset itself opens the new log, so a client catching up by
      -- sequence number applies it before what follows.
      v_events := jsonb_build_array(v_payload);
    else
      -- Each tournament_update carries the whole bracket and replaces the
      -- last, so only the newest is kept.
      if v_kind = 'tournament_update' then
        select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb) into v_events
        from jsonb_array_elements(v_events) with ordinality as x(e, ord)
        where x.e ->> 'kind' is distinct from 'tournament_update';
      end if;
      v_events := v_events || jsonb_build_array(v_payload);

      -- Keep at most 200. Players' events go first, so nobody can push the
      -- host's questions, calls or prompts out of the log by flooding it.
      v_over := jsonb_array_length(v_events) - 200;
      if v_over > 0 then
        select count(*) into v_player_count
        from jsonb_array_elements(v_events) as x(e)
        where not (x.e ->> 'kind' = any (public.room_host_event_kinds()));
        v_drop_player := least(v_over, v_player_count);
        v_drop_host := v_over - v_drop_player;
        select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_events
        from (
          select x.e, x.ord,
                 coalesce(x.e ->> 'kind' = any (public.room_host_event_kinds()), false) as is_host,
                 row_number() over (
                   partition by coalesce(x.e ->> 'kind' = any (public.room_host_event_kinds()), false)
                   order by x.ord
                 ) as rn
          from jsonb_array_elements(v_events) with ordinality as x(e, ord)
        ) as t
        where not ((not t.is_host and t.rn <= v_drop_player) or (t.is_host and t.rn <= v_drop_host));
      end if;
    end if;

    v_next := jsonb_set(jsonb_set(v_state, '{events}', v_events), '{seq}', to_jsonb(v_seq));
    -- Stay under room_activity_state_size_check (0059: 500KB). If the log
    -- won't fit, the number still advances and the event still goes out
    -- live; it just isn't kept for late joiners.
    if pg_column_size(v_next) >= 490000 then
      v_next := jsonb_set(v_state, '{seq}', to_jsonb(v_seq));
    end if;

    insert into public.room_activity_state (room_code, activity_state)
    values (p_room_code, v_next)
    on conflict (room_code) do update set activity_state = excluded.activity_state;

  else
    raise exception 'Unknown event.';
  end if;

  perform realtime.send(
    jsonb_build_object('senderId', v_uid, 'originId', p_origin, 'seq', v_seq, 'payload', v_payload),
    p_event,
    'room:' || p_room_code || ':events',
    true
  );
  return v_seq;
end;
$$;

revoke execute on function public.send_room_event(text, text, jsonb, text) from public, anon;
grant execute on function public.send_room_event(text, text, jsonb, text) to authenticated;

-- Members may send broadcast and presence on room:<CODE> only, not on
-- room:<CODE>:events, which only send_room_event writes to. Receiving is
-- unchanged: the existing select policy already covers both topics.
drop policy if exists "room members can send broadcast and presence" on "realtime"."messages";
create policy "room members can send broadcast and presence"
on "realtime"."messages"
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and split_part(realtime.topic(), ':', 3) = ''
  and public.is_member_of_room(split_part(realtime.topic(), ':', 2), (select auth.uid())::text)
);
