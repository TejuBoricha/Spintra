-- Migration 0039: Bound remaining unconstrained columns (Session 45 audit)
--
-- Three gaps found reading every migration end-to-end:
-- 1. room_activity_state.activity_state (and its rooms predecessor before
--    it) had no server-side size bound — the 200-event cap is enforced
--    only client-side (use-room-subscription.ts), and any room participant
--    can upsert this table directly per migration 0035's RLS policies.
-- 2. rooms.code had no length/format constraint despite being the real FK
--    target for 5 other tables (room_participants, chat_messages,
--    room_bans, message_reports, room_activity_state) — the client always
--    generates a fixed 6-character code, but nothing enforced that.
-- 3. rooms.type had no server-side enum constraint, unlike
--    room_participants.role (constrained since 0001, tightened in 0021) —
--    validated client-side only against games.ts's GAMES array.
--
-- All three bounds are generous, matching the existing pattern (migration
-- 0034): comfortably above real usage, so no existing data is affected.

alter table public.room_activity_state
  drop constraint if exists room_activity_state_size_check;
alter table public.room_activity_state
  add constraint room_activity_state_size_check
  check (pg_column_size(activity_state) < 100000);

alter table public.rooms
  drop constraint if exists rooms_code_length_check;
alter table public.rooms
  add constraint rooms_code_length_check
  check (char_length(code) between 1 and 12);

alter table public.rooms
  drop constraint if exists rooms_type_check;
alter table public.rooms
  add constraint rooms_type_check
  check (type in (
    'team-maker', 'lucky-wheel', 'name-draw', 'tournament', 'coin-flip',
    'dice', 'guess-number', 'rps', 'truth-or-dare', 'would-you-rather',
    'never-have-i-ever', 'trivia', 'bingo', 'word-scramble', 'party', 'classroom'
  ));
