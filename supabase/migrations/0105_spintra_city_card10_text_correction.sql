-- Corrects card 10's text, which 0104 made wrong.
--
-- 0104 reworded card 10 to "pay the owner double the usual rent", reasoning
-- from the effect seeded in 0068 (rent_multiplier 2). But 0079 had already
-- replaced that effect with {"flat_rent_multiplier": 10}, which charges
-- roll x 10 regardless of how many utilities the owner holds. The original
-- "ten times your roll" wording was accurate; this restores that meaning
-- without the em dash. Text only: the effect is unchanged.

update public.city_cards
   set text = 'A city-wide surge hits the grid. Advance to the Power Grid. Buy it if nobody owns it, or pay the owner ten times your roll.'
 where id = 10
   and effect ->> 'flat_rent_multiplier' = '10';
