-- Migration 0036: Realtime Broadcast & Presence Authorization
--
-- Every DB write path in this app (room creation, joins, chat, bans, activity
-- state) has been hardened across 35 migrations of RLS/rate-limiting/trigger
-- work. The one transport that was never brought into that hardening is the
-- Supabase Realtime Broadcast/Presence channel itself (`room:{code}`) --
-- Broadcast/Presence access is open-by-default unless a project explicitly
-- opts into Realtime Authorization, which this app never did.
--
-- Concretely, before this migration: any anonymous session -- no signup
-- required -- could open devtools and `supabase.channel('room:XXXXXX').
-- subscribe()` for ANY room code, including private (is_public=false) rooms,
-- silently observing every live game event and presence-tracked user_id with
-- no row ever created in room_participants and no trace left. The same
-- channel accepted forged broadcasts (activity_change / activity_event) that
-- every real client trusts unconditionally. Worst case: a banned user
-- (room_bans, migration 0012) kept full realtime access after being kicked,
-- because the ban trigger only blocks a room_participants INSERT, never the
-- channel -- the entire moderation feature was bypassable at this layer.
--
-- Fix: enable Realtime Authorization. The client now creates the channel
-- with `{ config: { private: true } }`; access to it is then gated by RLS
-- policies on realtime.messages, keyed off the same is_member_of_room()
-- security-definer helper migration 0009 already built for exactly this
-- purpose. The room code is recovered from the channel topic ("room:XXXXXX")
-- via split_part().
--
-- IMPORTANT ordering note -- see use-room-subscription.ts: Realtime
-- Authorization is evaluated ONCE at channel.subscribe() time and then
-- cached for that connection's lifetime (per Supabase's own docs: "Client
-- access policies are cached for the duration of the connection"). This
-- means the client MUST ensure its own room_participants row already exists
-- before calling channel.subscribe() with private:true -- otherwise that
-- client would be denied and never receive/send another broadcast or
-- presence message for the rest of that session, since the denial is
-- cached too. The accompanying client change gates the channel-subscribe
-- effect on a `participantRowReady` flag set only after the participant
-- upsert (trackSelf) has actually completed.
--
-- Postgres Changes (chat_messages/room_participants/rooms INSERT/UPDATE/
-- DELETE subscriptions on the same channel object) are entirely unaffected
-- by this: that mechanism is governed solely by table-level RLS, not by
-- realtime.messages, and Supabase's docs confirm private and public channels
-- can both subscribe to Postgres Changes without interference.

alter table realtime.messages enable row level security;

drop policy if exists "room members can receive broadcast and presence" on "realtime"."messages";
create policy "room members can receive broadcast and presence"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.is_member_of_room(split_part(realtime.topic(), ':', 2), (select auth.uid())::text)
);

drop policy if exists "room members can send broadcast and presence" on "realtime"."messages";
create policy "room members can send broadcast and presence"
on "realtime"."messages"
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.is_member_of_room(split_part(realtime.topic(), ':', 2), (select auth.uid())::text)
);
