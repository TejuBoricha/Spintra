-- Replace a dare that asks a player to message someone outside the room
-- (audit K-4). Migration 0008 seeded "Text your crush right now" into the
-- in-room Truth or Dare deck. The standalone page's deck lost the same kind of
-- dare in the content pass, because it asks a player to contact a real
-- person who never agreed to play, and it is a bad dare for a classroom
-- room. The replacement keeps everything inside the room.
--
-- Matched on the exact text and type, so a deck an operator has already
-- edited is left alone, and running it twice changes nothing.

update public.activity_prompts
set prompt_data = '{"text": "Describe your day as a movie trailer voiceover"}'
where activity_type = 'truth-or-dare'
  and category = 'dare'
  and prompt_data->>'text' = 'Text your crush right now';
