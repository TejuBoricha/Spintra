-- Copy-only fix for four Spintra City card texts. No schema or effect change.
--
-- Rewords four cards seeded by 0068 so they read without em dashes, in line
-- with the site-wide copy rule (an ESLint rule now blocks them in src/, but
-- card text lives here in the database, out of that rule's reach).
--
-- Card 10 also said "pay the owner ten times your roll", which was only true
-- when the owner holds one utility. Its effect is rent_multiplier 2 on top of
-- city_rent_for's utility rent (roll x5 with one utility, roll x12 with both),
-- so it actually charges 10x or 24x. "Double the usual rent" is accurate in
-- both cases and matches how card 2 already describes the same effect.

update public.city_cards
   set text = 'Every room in Dubai is booked but yours. Advance there. Buy it if nobody owns it, or pay the owner double the usual rent.'
 where id = 2;

update public.city_cards
   set text = 'Your passport is flagged at the desk. Go directly to Customs, and don''t collect your salary on the way.'
 where id = 5;

update public.city_cards
   set text = 'A city-wide surge hits the grid. Advance to the Power Grid. Buy it if nobody owns it, or pay the owner double the usual rent.'
 where id = 10;

update public.city_cards
   set text = 'Caught letting rooms without a licence. Go directly to Customs, and don''t collect your salary on the way.'
 where id = 24;
