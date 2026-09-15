# SPINTRA_CITY_CONTENT.md — World Board & Content

> Companion to `docs/SPINTRA_CITY_DESIGN.md`. That file holds **decisions** (architecture,
> product rules, integration plan); this file holds the **content** — the board, the economy, the
> card decks, the tokens. Split so a balance/content edit doesn't churn the architecture doc.
>
> **Status: second full draft, not yet approved.** Supersedes the "The Wheelworks" invented-city
> draft, which the user replaced with **real cities and flags** (the richup.io approach) on
> 2026-08-29. Numbers are carried over unchanged from that draft — they were an independent
> balance first pass and the theme swap doesn't invalidate them — but they remain unplaytested.

---

## 1. Theme

**A trip around the world.** The board is a travel route; properties are real cities grouped by
country, each set carrying its national flag. Recognisable at a glance, nobody's invented lore to
learn, and it gives the set-collection mechanic a natural visual language: you're collecting
countries.

**Currency:** **Spins** (written as `120 Spins`, abbreviated `120sp` in tight UI). Carried over
from the previous draft — it derives from Spintra's own identity, not the abandoned city theme, so
it survives the change.

**Tone:** bright, modern, travel-poster. Flags and city names do the heavy lifting; the art
direction should feel like a departure board, not a board game box.

---

## 2. Content notes (read before adding any content)

**On the rules structure.** The rule *structure* below deliberately mirrors the classic
property-trading game: 40 spaces, 8 grouped sets, 4 transit spaces, 2 utilities, 4 corners, 2 card
decks, 2 tax spaces, buy-or-auction, complete-a-set-to-build, even-build, mortgaging. This is
intentional per the user's instruction to "maintain the core," and rules/systems are the safe part
to retain.

**On real place names.** City and country names are factual geography and not anyone's property,
which is what makes this direction available at all. Flags are likewise public. What still must be
original is every **expressive** element: card text, corner and deck names, token names, tier
names, and all artwork — original throughout this document. Economy numbers were derived
independently rather than lifted.

**On ordering countries by price — decide this deliberately.** The price ladder is a game-balance
artifact, but a board that runs cheap→expensive across real nations *will* be read as a ranking of
those nations. Two mitigations are applied below, and a third option is left open for the user:

1. Regions are **interleaved** rather than sorted, so the ladder isn't a clean wealthy/less-wealthy
   gradient — Portugal sits at the bottom and the UAE at the top, with Poland, Japan, South Africa,
   Australia, Canada and India spread across the middle in no regional order.
2. Within each country the cities ascend, so the visible progression reads as *within* a country,
   not *between* them.
3. **Open alternative:** order the board as a literal westward travel route and let price follow
   the route rather than any tiering. This removes the ranking reading entirely, at the cost of a
   less legible price gradient for players. Flagged for the user rather than decided here.

---

## 3. Board layout (40 spaces)

Positions are 0-indexed clockwise from the start corner.

| # | Space | Type | Group | Price |
|---|---|---|---|---|
| 0 | **Departure** | Corner — start, collect 200 | — | — |
| 1 | Porto | Property | 🇵🇹 Portugal | 55 |
| 2 | Boarding Pass | Card draw | — | — |
| 3 | Lisbon | Property | 🇵🇹 Portugal | 65 |
| 4 | Travel Tax | Tax (180 Spins) | — | — |
| 5 | Heathrow | Transit | Airports | 190 |
| 6 | Kraków | Property | 🇵🇱 Poland | 90 |
| 7 | City Fund | Card draw | — | — |
| 8 | Gdańsk | Property | 🇵🇱 Poland | 90 |
| 9 | Warsaw | Property | 🇵🇱 Poland | 110 |
| 10 | **Customs** | Corner — held / just passing through | — | — |
| 11 | Osaka | Property | 🇯🇵 Japan | 130 |
| 12 | Power Grid | Utility | Utilities | 140 |
| 13 | Kyoto | Property | 🇯🇵 Japan | 130 |
| 14 | Tokyo | Property | 🇯🇵 Japan | 150 |
| 15 | Changi | Transit | Airports | 190 |
| 16 | Cape Town | Property | 🇿🇦 South Africa | 170 |
| 17 | City Fund | Card draw | — | — |
| 18 | Durban | Property | 🇿🇦 South Africa | 170 |
| 19 | Jo'burg | Property | 🇿🇦 South Africa | 190 |
| 20 | **Layover** | Corner — free rest | — | — |
| 21 | Melbourne | Property | 🇦🇺 Australia | 210 |
| 22 | Boarding Pass | Card draw | — | — |
| 23 | Brisbane | Property | 🇦🇺 Australia | 210 |
| 24 | Sydney | Property | 🇦🇺 Australia | 235 |
| 25 | Schiphol | Transit | Airports | 190 |
| 26 | Montréal | Property | 🇨🇦 Canada | 255 |
| 27 | Vancouver | Property | 🇨🇦 Canada | 255 |
| 28 | Data Centre | Utility | Utilities | 140 |
| 29 | Toronto | Property | 🇨🇦 Canada | 280 |
| 30 | **Detained** | Corner — go to Customs | — | — |
| 31 | Jaipur | Property | 🇮🇳 India | 300 |
| 32 | Bengaluru | Property | 🇮🇳 India | 300 |
| 33 | City Fund | Card draw | — | — |
| 34 | Mumbai | Property | 🇮🇳 India | 330 |
| 35 | Dubai Intl | Transit | Airports | 190 |
| 36 | Boarding Pass | Card draw | — | — |
| 37 | Abu Dhabi | Property | 🇦🇪 UAE | 360 |
| 38 | Luxury Duty | Tax (90 Spins) | — | — |
| 39 | Dubai | Property | 🇦🇪 UAE | 420 |

**Counts check:** 22 properties across 8 country sets (2/3/3/3/3/3/3/2), 4 airports, 2 utilities,
2 taxes, 6 card draws (3 Boarding Pass + 3 City Fund), 4 corners = 40.

**This table is the prototype's board, verbatim** (artifact `3c7391e1`), so the doc and the working
render agree. An earlier draft of this file proposed a different country set (Egypt, Brazil, Italy);
it was dropped because the prototype already carries hand-drawn flag gradients for the eight below,
and those render correctly on Windows where emoji flags do not.

**One rename applied:** the prototype originally called the movement deck **"Chance"**, which is the
literal deck name from the classic game and breaches §2's originality rule. It is **Boarding Pass**
in both the doc and the prototype now. `City Fund` was already original and is unchanged.

**Rendering note.** Flag emoji are regional-indicator pairs and render as bare letter pairs on
Windows (a real defect hit during prototyping — a deed card displayed "ZA"). The emoji above are
for *this document's* readability only. **The board must render flags procedurally** — CSS
gradients or drawn geometry — never as emoji. See `SPINTRA_CITY_DESIGN.md` §5.

---

## 4. Country sets & rent

Development tiers, in ascending order: **Hostel → Inn → Hotel → Resort → Landmark** (the last
being the hotel-equivalent, one per property, replacing four Resorts).

Base rent applies to an undeveloped property. Owning a **complete country** doubles base rent on
its undeveloped members, as usual.

| Country | Cities | Price(s) | Base | Hostel | Inn | Hotel | Resort | Landmark | Build cost/tier |
|---|---|---|---|---|---|---|---|---|---|
| Portugal | 2 | 55 / 65 | 4 | 20 | 60 | 180 | 320 | 450 | 50 |
| Poland | 3 | 90 / 90 / 110 | 7 | 35 | 100 | 300 | 450 | 600 | 100 |
| Japan | 3 | 130 / 130 / 150 | 11 | 50 | 150 | 450 | 625 | 750 | 100 |
| South Africa | 3 | 170 / 170 / 190 | 15 | 70 | 200 | 550 | 750 | 900 | 150 |
| Australia | 3 | 210 / 210 / 235 | 19 | 90 | 250 | 700 | 875 | 1050 | 150 |
| Canada | 3 | 255 / 255 / 280 | 23 | 110 | 330 | 800 | 975 | 1150 | 200 |
| India | 3 | 300 / 300 / 330 | 27 | 130 | 390 | 900 | 1100 | 1275 | 200 |
| UAE | 2 | 360 / 420 | 35 | 175 | 500 | 1100 | 1300 | 1500 | 200 |

The price and rent ladder is unchanged from the previous draft — only the country names moved, so
the (unplaytested) economy carries over intact. Build costs match the prototype's `BUILDCOST` map,
which the raise-funds panel uses to price a building sold back at half cost.

**Airports** — rent scales with how many of the four the owner holds:
1 → 30, 2 → 60, 3 → 120, 4 → 240 Spins.

**Utilities** — rent is a multiplier on the roll that landed you there:
1 owned → 5× the dice total, both owned → 12× the dice total.

**Mortgaging** — mortgage value is 50% of the listed price; lifting a mortgage costs the mortgage
value plus 10% interest. Developed properties must be stripped back to undeveloped before
mortgaging; selling a development tier back to the bank returns half its build cost.

---

## 5. Starting conditions

- **Starting cash:** 1,600 Spins per player.
- **Salary for passing Departure:** 200 Spins.
- **Customs release fee:** 90 Spins, or roll doubles within three turns, or spend a Transit Visa
  card. **On the third failed turn the fee is paid automatically** — see `SPINTRA_CITY_DESIGN.md`
  §3.1A, which defines this as a deliberate exception to the "a timeout never auto-spends" rule,
  because by then no free option remains.
- **Doubles:** roll again; three consecutive doubles sends you to Customs.

---

## 6. Boarding Pass cards (16)

The dramatic deck — movement, windfalls, sudden reversals. Drawn at positions 2, 22, 36.

1. The gate opens early. Advance to Departure and collect 200 Spins.
2. Every room in Dubai is booked but yours. Advance there — buy it if it's unclaimed, or pay the
   owner double the usual rent.
3. Standby seat comes through. Advance to the nearest Airport and pay its owner twice the standard
   fare; if nobody owns it, you may claim it.
4. The festival starts the day you land. Advance to Cape Town; collect 200 Spins if you pass Departure on the way.
5. Your passport is flagged at the desk. Go directly to Customs — no salary, no detour.
6. You misread the platform number. Roll back three spaces.
7. Peak season pricing works in your favour. Collect 150 Spins.
8. Emergency baggage fees. Pay 75 Spins.
9. Your grand reopening draws travellers from everywhere. Collect 100 Spins from every other player.
10. A city-wide surge hits the grid. Advance to the Power Grid — claim it if unowned, otherwise
    roll and pay the owner ten times the total.
11. Every property you own is due a safety inspection. Pay 40 Spins per Hostel or Inn, 150 per
    Hotel or Resort, and 300 per Landmark.
12. **Transit Visa.** Keep this card until you use it; it clears you through Customs once.
13. A gallery opening draws the whole city. Advance to Kraków, collecting 200 Spins if you pass
    Departure.
14. The exchange rate moves your way. Collect 60 Spins.
15. A miscounted till goes against you. Pay 50 Spins.
16. A free transfer is offered on the Gulf route. Advance to Dubai Intl, collecting 200 Spins if
    you pass Departure.

---

## 7. City Fund cards (16)

The steadier deck — small fortunes, small bills, the ordinary business of travelling. Drawn at
positions 7, 17, 33.

1. Annual dividend from your travel fund. Collect 120 Spins.
2. An overbooked flight is refunded. Collect 45 Spins.
3. A minor mishap abroad lands you with medical bills. Pay 100 Spins.
4. Second place in a street photography contest. Collect 40 Spins.
5. The tourist levy comes due. Pay 60 Spins.
6. A guesthouse you once stayed in is left to you. Collect 250 Spins.
7. **Transit Visa.** Keep this card until you use it; it clears you through Customs once.
8. Caught letting rooms without a licence. Go directly to Customs — no salary, no detour.
9. Everyone chips in for the group photo. Take 25 Spins from each of the other players.
10. You sell a year of accumulated air miles. Collect 70 Spins.
11. Staff training and language courses. Pay 80 Spins.
12. City maintenance assessment. Pay 45 Spins per Hostel or Inn, 130 per Hotel or Resort, and 275
    per Landmark.
13. You are invited to a ribbon-cutting back home. Advance to Departure and collect 200 Spins.
14. An old travel insurance claim finally settles. Collect 90 Spins.
15. Contribute to a heritage restoration fund. Pay 55 Spins.
16. A guest tips you generously on the way out. Collect 35 Spins.

---

## 8. Tokens (8 — one per possible seat)

Suitcase · Camera · Passport · Compass · Hot-Air Balloon · Paper Plane · Backpack · Postage Stamp

All eight are original designs; none reference the classic game's piece set.

---

## 9. Optional rule toggles (host-selectable at lobby)

Defaults keep the core game intact; every toggle below is **off** unless stated.

- **Bonus Spin at The Layover** *(the Spintra flourish — off by default)*: landing on the free-rest
  corner triggers a short wheel spin for a small random reward, instead of the corner being a
  no-op. Kept optional precisely because a dead corner is part of the classic core; this is the
  one place the platform's own identity can surface mechanically without altering the base game.
- **Even build** *(on by default)*: developments must be added and removed evenly across a country.
- **Auction on decline** *(on by default)*: declining to buy sends the property to auction among
  all remaining players.
- **Customs collection**: fines and fees accumulate into a pot claimed by the next player to land
  on The Layover. (Mutually exclusive with Bonus Spin.)
- **Timed mode length**: see `SPINTRA_CITY_DESIGN.md` §3 — ends at a set limit, ranked by net
  worth.

Note that the host's **pace preset** (Relaxed / Standard / Blitz) is *not* in this list — it lives
with the match-creation controls and locks at match start. See `SPINTRA_CITY_DESIGN.md` §3.

---

## 10. Open content questions

- **Country-order sensitivity** — the board ships with price tiering plus §2's interleaving. §2's
  third option (ordering as a literal travel route instead) remains available but is not planned.
  `[USER]` if you want it revisited.
- **Board art direction** — needs a palette per country set (8 distinct, accessible in both light
  and dark themes, per the site's existing theme-aware conventions), token artwork, and procedural
  flag rendering (see §3's rendering note). A flat, square, text-first board was validated during
  prototyping; an isometric one was built and rejected.
- **Economy balance pass** — every number above is a reasoned first draft, never playtested. The
  cash-to-price ratio, salary, and rent curve all want a real balance check before launch.
- **Card count** — 16 per deck is a starting point, matching the classic game's shape. Worth
  revisiting if playtests show repetition.
- **City selection** — the 22 cities are a first pass chosen for recognisability and regional
  spread. Swapping individual cities is cheap; swapping a whole country set changes the flag art.
- **Space-name localisation** — all names are English-only, consistent with the rest of the site
  (`AI_CONTEXT.md` notes static content is English-only, no i18n).
