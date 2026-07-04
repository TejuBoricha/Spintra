-- Migration 0016: Missing constraints and index found in the Session 37 audit
--
-- None of these were exploited or caused real problems — they close gaps
-- where malformed data could technically be inserted, or a query would
-- degrade to a full table scan as content grows.

-- 1. rooms.max_participants must be positive — a 0 or negative value would
--    make the participant-count trigger from migration 0009 always/never fire.
alter table public.rooms
  drop constraint if exists rooms_max_participants_positive;
alter table public.rooms
  add constraint rooms_max_participants_positive check (max_participants > 0);

-- 2. message_reports.message_id had no FK at all — a report could reference
--    a nonexistent message, and rows would silently orphan if a message were
--    ever deleted independent of its room.
alter table public.message_reports
  drop constraint if exists fk_message_reports_message;
alter table public.message_reports
  add constraint fk_message_reports_message
  foreign key (message_id) references public.chat_messages (id)
  on delete cascade;

-- 3. trivia_questions.correct_index must actually index into its own options
--    array, not just be a non-negative integer.
alter table public.trivia_questions
  drop constraint if exists trivia_questions_correct_index_in_bounds;
alter table public.trivia_questions
  add constraint trivia_questions_correct_index_in_bounds
  check (correct_index >= 0 and correct_index < jsonb_array_length(options));

-- 4. Every prompt-based activity (Truth or Dare, Would You Rather, Never
--    Have I Ever) filters activity_prompts by activity_type on every fetch —
--    only the primary key was indexed before this.
create index if not exists activity_prompts_activity_type_idx
  on public.activity_prompts (activity_type);
