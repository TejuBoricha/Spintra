# SPINTRA_CITY_CONTENT.md — "The Wheelworks" Board & Content

> Companion to `docs/SPINTRA_CITY_DESIGN.md`. That file holds **decisions** (architecture,
> product rules, integration plan); this file holds the **content** — the board, the economy, the
> card decks, the tokens. Split so a balance/content edit doesn't churn the architecture doc.
>
> **Status: first full draft, not yet approved.** The theme direction ("The Wheelworks") was
> chosen by the user from three concept pitches; everything below is a first pass built on that
> choice and is open to revision. Numbers in particular are a starting point for a balance pass,
> not a finished economy.

---

## 1. Theme

**The Wheelworks** — a city built around, and powered by, enormous fortune wheels. Brass, steam,
cogs, ticket booths, carousel lights, fairground optimism. The conceit ties the game back to
Spintra's own "spin" identity without turning the board into a platform advertisement: the city
*is* a wheelworks, and that's simply what its districts, industries, and landmarks are about.

**Currency:** **Spins** (written as `120 Spins`, abbreviated `120sp` in tight UI).

**Tone:** warm, playful, slightly retro-industrial. Not cartoonish, not gritty.

---

## 2. IP note (read before adding any content)

The rule *structure* below deliberately mirrors the classic property-trading game: 40 spaces, 8
colour-grouped sets, 4 transit spaces, 2 utilities, 4 corners, 2 card decks, 2 tax spaces,
buy-or-auction, complete-a-set-to-build, even-build, mortgaging. This is intentional per the
user's instruction to "maintain the core," and rules/systems are the safe part to retain.

What must stay original — and is original throughout this document — is every **expressive**
element: space names, currency name, deck names, card text, token names, and all artwork. The
economy numbers below were also derived independently rather than lifted, so the board plays with
a familiar *shape* without reproducing the original's literal price/rent tables.

Anyone adding content later: keep that line exactly where it is. New card text and space names
must be written fresh, never adapted phrase-by-phrase from the source game.

---

## 3. Board layout (40 spaces)

Positions are 0-indexed clockwise from the start corner.

| # | Space | Type | Group | Price |
|---|---|---|---|---|
| 0 | **The Grand Spindle** | Corner — start | — | — |
| 1 | Rusty Spoke Lane | Property | Scrapspin | 55 |
| 2 | Civic Card | Card draw | — | — |
| 3 | Tinker's End | Property | Scrapspin | 65 |
| 4 | Maintenance Levy | Tax (180 Spins) | — | — |
| 5 | Northgate Tramline | Transit | Tramlines | 190 |
| 6 | Cogwheel Commons | Property | Cogwheel | 90 |
| 7 | Fortune Card | Card draw | — | — |
| 8 | Bearing Street | Property | Cogwheel | 90 |
| 9 | Flywheel Way | Property | Cogwheel | 110 |
| 10 | **The Lockworks** | Corner — detention / just visiting | — | — |
| 11 | Carousel Court | Property | Fairgrounds | 130 |
| 12 | The Steamworks | Utility | Utilities | 140 |
| 13 | Ribbon Row | Property | Fairgrounds | 130 |
| 14 | Fortune Fairgrounds | Property | Fairgrounds | 150 |
| 15 | Eastgate Tramline | Transit | Tramlines | 190 |
| 16 | Jackpot Junction | Property | Jackpot | 170 |
| 17 | Civic Card | Card draw | — | — |
| 18 | Lucky Seven Street | Property | Jackpot | 170 |
| 19 | Marquee Mile | Property | Jackpot | 190 |
| 20 | **The Layover** | Corner — free rest | — | — |
| 21 | Ferris Heights | Property | Ferris | 210 |
| 22 | Fortune Card | Card draw | — | — |
| 23 | Gearbox Gardens | Property | Ferris | 210 |
| 24 | Ferris Financial District | Property | Ferris | 235 |
| 25 | Southgate Tramline | Transit | Tramlines | 190 |
| 26 | Spindle Quarter | Property | Spindle | 255 |
| 27 | Governor's Turn | Property | Spindle | 255 |
| 28 | The Aqueduct | Utility | Utilities | 140 |
| 29 | Clockspring Close | Property | Spindle | 280 |
| 30 | **Gearfall** | Corner — go to detention | — | — |
| 31 | Gilded Gear Avenue | Property | Gilded | 300 |
| 32 | Momentum Park | Property | Gilded | 300 |
| 33 | Civic Card | Card draw | — | — |
| 34 | Grand Prize Promenade | Property | Gilded | 330 |
| 35 | Westgate Tramline | Transit | Tramlines | 190 |
| 36 | Fortune Card | Card draw | — | — |
| 37 | Windfall Way | Property | Jubilee | 360 |
| 38 | Grand Tariff | Tax (90 Spins) | — | — |
| 39 | Jubilee Heights | Property | Jubilee | 420 |

**Counts check:** 22 properties across 8 groups (2/3/3/3/3/3/3/2), 4 transit, 2 utilities,
2 taxes, 6 card draws (3 Fortune + 3 Civic), 4 corners = 40.

---

## 4. Property groups & rent

Development tiers, in ascending order: **Kiosk → Pavilion → Arcade → Tower → Grand Wheel**
(the last being the hotel-equivalent, one per property, replacing four Towers).

Base rent applies to an undeveloped property. Owning a **complete group** doubles base rent on its
undeveloped members, as usual.

| Group | Properties | Price(s) | Base | Kiosk | Pavilion | Arcade | Tower | Grand Wheel | Build cost/tier |
|---|---|---|---|---|---|---|---|---|---|
| Scrapspin | 2 | 55 / 65 | 4 | 20 | 60 | 180 | 320 | 450 | 50 |
| Cogwheel | 3 | 90 / 90 / 110 | 7 | 35 | 100 | 300 | 450 | 600 | 50 |
| Fairgrounds | 3 | 130 / 130 / 150 | 11 | 50 | 150 | 450 | 625 | 750 | 100 |
| Jackpot | 3 | 170 / 170 / 190 | 15 | 70 | 200 | 550 | 750 | 900 | 100 |
| Ferris | 3 | 210 / 210 / 235 | 19 | 90 | 250 | 700 | 875 | 1050 | 150 |
| Spindle | 3 | 255 / 255 / 280 | 23 | 110 | 330 | 800 | 975 | 1150 | 150 |
| Gilded | 3 | 300 / 300 / 330 | 27 | 130 | 390 | 900 | 1100 | 1275 | 200 |
| Jubilee | 2 | 360 / 420 | 35 | 175 | 500 | 1100 | 1300 | 1500 | 200 |

**Transit (Tramlines)** — rent scales with how many of the four the owner holds:
1 → 30, 2 → 60, 3 → 120, 4 → 240 Spins.

**Utilities** — rent is a multiplier on the roll that landed you there:
1 owned → 5× the dice total, both owned → 12× the dice total.

**Mortgaging** — mortgage value is 50% of the listed price; lifting a mortgage costs the mortgage
value plus 10% interest. Developed properties must be stripped back to undeveloped before
mortgaging; selling a development tier back to the bank returns half its build cost.

---

## 5. Starting conditions

- **Starting cash:** 1,600 Spins per player.
- **Salary for passing The Grand Spindle:** 200 Spins.
- **Detention release fee:** 90 Spins, or roll doubles within three turns, or spend a Release
  Papers card.
- **Doubles:** roll again; three consecutive doubles sends you to The Lockworks.

---

## 6. Fortune Cards (16)

The dramatic deck — movement, windfalls, sudden reversals. Drawn at positions 7, 22, 36.

1. The crowds are with you. Advance to The Grand Spindle and collect 200 Spins.
2. Every ticket in Jubilee Heights is spoken for. Advance there — buy it if it's unclaimed, or pay
   the owner double the usual rent.
3. Catch the next tram. Advance to the nearest Tramline and pay its owner twice the standard fare;
   if nobody owns it, you may claim it.
4. The fairground is calling. Advance to Fortune Fairgrounds; collect 200 Spins if you pass The
   Grand Spindle on the way.
5. Your main wheel throws a spoke. Go directly to The Lockworks — no salary, no detour.
6. You misjudge the turn. Roll back three spaces.
7. A record night at the ticket booths. Collect 150 Spins.
8. Emergency gearing repairs. Pay 75 Spins.
9. Your grand reopening draws the whole city. Collect 100 Spins from every other player.
10. Steam pressure surges. Advance to The Steamworks — claim it if unowned, otherwise roll and pay
    the owner ten times the total.
11. City engineers order a full inspection. Pay 40 Spins per Kiosk or Pavilion, 150 per Arcade or
    Tower, and 300 per Grand Wheel you own.
12. **Release Papers.** Keep this card until you use it; it frees you from The Lockworks once.
13. Opening day at Cogwheel Commons. Advance there, collecting 200 Spins if you pass The Grand
    Spindle.
14. Your lucky streak holds one more night. Collect 60 Spins.
15. A miscounted till goes against you. Pay 50 Spins.
16. A free ride is offered on the western line. Advance to Westgate Tramline, collecting 200 Spins
    if you pass The Grand Spindle.

---

## 7. Civic Cards (16)

The steadier deck — civic life, guild business, small fortunes and small bills. Drawn at
positions 2, 17, 33.

1. Annual dividend from the Wheelwrights' Guild. Collect 120 Spins.
2. An overbooked show is refunded. Collect 45 Spins.
3. A carousel mishap lands you with medical bills. Pay 100 Spins.
4. You take second place in the lantern parade. Collect 40 Spins.
5. The street festival levy comes due. Pay 60 Spins.
6. An old ride operator leaves you their workshop. Collect 250 Spins.
7. **Release Papers.** Keep this card until you use it; it frees you from The Lockworks once.
8. Cited for running an unlicensed wheel. Go directly to The Lockworks — no salary, no detour.
9. Founders' Day collection. Take 25 Spins from each of the other players.
10. You sell a season's worth of scrap brass. Collect 70 Spins.
11. Apprentice wheelwrights' school fees. Pay 80 Spins.
12. City maintenance assessment. Pay 45 Spins per Kiosk or Pavilion, 130 per Arcade or Tower, and
    275 per Grand Wheel you own.
13. You're summoned to the opening ceremony. Advance to The Grand Spindle and collect 200 Spins.
14. An old insurance claim finally settles. Collect 90 Spins.
15. Contribute to the Ferris restoration fund. Pay 55 Spins.
16. A visitor tips you generously at the gate. Collect 35 Spins.

---

## 8. Tokens (8 — one per possible seat)

Brass Cog · Ticket Stub · Lucky Coin · Carousel Horse · Wind-Up Key · Pocket Compass ·
Confetti Cannon · Paper Lantern

All eight are original designs; none reference the classic game's piece set.

---

## 9. Optional rule toggles (host-selectable at lobby)

Defaults keep the core game intact; every toggle below is **off** unless stated.

- **Bonus Spin at The Layover** *(the Spintra flourish — off by default)*: landing on the free-rest
  corner triggers a short wheel spin for a small random reward, instead of the corner being a
  no-op. Kept optional precisely because a dead corner is part of the classic core; this is the
  one place the platform's own identity can surface mechanically without altering the base game.
- **Even build** *(on by default)*: developments must be added and removed evenly across a group.
- **Auction on decline** *(on by default)*: declining to buy sends the property to auction among
  all remaining players.
- **Detention collection**: fines and fees accumulate into a pot claimed by the next player to
  land on The Layover. (Mutually exclusive with Bonus Spin.)
- **Timed mode length**: see `SPINTRA_CITY_DESIGN.md` §3 — ends at a set limit, ranked by net
  worth.

---

## 10. Open content questions

- **Board art direction** — nothing visual has been designed yet. Needs a colour palette per
  group (8 distinct, accessible in both light and dark themes, per the site's existing
  theme-aware conventions), token artwork, and a board render approach (SVG? CSS grid? canvas?).
- **Economy balance pass** — every number above is a reasoned first draft, never playtested. The
  cash-to-price ratio, salary, and rent curve all want a real balance check before launch.
- **Card count** — 16 per deck is a starting point; the classic game uses 16 in each of its two
  decks, and this matches that shape. Worth revisiting if playtests show repetition.
- **Space-name localisation** — all names are English-only, consistent with the rest of the site
  (`AI_CONTEXT.md` notes static content is English-only, no i18n).
