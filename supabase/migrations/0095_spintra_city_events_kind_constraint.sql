-- Spintra City — closes the last review finding from 0093/0094: `kind` was a
-- bare `text` column with nothing enforcing it stayed one of the values the
-- client actually understands. A typo in a future insert (0093/0094 already
-- hand-copy the same "insert into city_match_events" shape 15 times, with a
-- v2 batch of more kinds already planned per TASKS.md) would insert
-- successfully and silently fall through to the client's generic "<actor> —
-- <kind>" fallback text, with nothing in Postgres or CI catching it.
--
-- A CHECK constraint, not a shared insert helper function: it catches the
-- exact failure mode (an unrecognised kind reaching the table) without
-- touching any of the 12 already-reviewed insert sites again, and it's
-- enforced no matter what inserts the row — a future migration, a manual
-- fix, anything.
alter table public.city_match_events
  add constraint city_match_events_kind_check
  check (kind = any (array[
    'rolled', 'bought', 'auction_started', 'auction_won', 'auction_unsold',
    'rent_paid', 'tax_paid', 'built', 'sold_building', 'mortgaged', 'unmortgaged',
    'trade_accepted', 'bankrupt', 'retired',
    'card_collected', 'card_visa_gained', 'card_sent_to_customs', 'card_charged'
  ]));
