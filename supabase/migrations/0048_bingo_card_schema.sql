-- Migration 0048: Bingo Card Server-Side Storage
--
-- The Bingo activity generates each player's 5x5 card grid on the client.
-- Win claims are broadcast via the realtime event bus, but the host has no
-- way to verify whether the claiming player's card actually contains a
-- winning line from the called numbers — a compromised client can fabricate
-- a win by broadcasting `bingo_win` immediately.
--
-- This migration adds a `bingo_card` jsonb column to `room_participants`
-- so the client can persist its generated card at creation time. When the
-- host receives a `bingo_win` event, it fetches the winner's card from the
-- database and validates the claim before announcing it to the room.

alter table public.room_participants
  add column if not exists bingo_card jsonb;
