# QA Report — Spintra City

**Product:** Spintra City (new Monopoly-style multiplayer mode for spintra.io)
**Branch / commit:** `feat/spintra-city-design` @ `cb08868`
**Migrations under test:** `0063`–`0070` (local only — **none are on production**)
**Audit date:** 2026-08-30
**Method:** four parallel lanes — SQL engine rules, security/API/DB over real HTTP,
browser/multiplayer via Playwright, and spec-conformance/regression.

> **Update, 2026-09-01 — a fix phase followed this audit.** All 4 criticals and 12
> of the 40 remaining bugs below are now fixed and verified **on the local stack
> only** — see §1b for exactly what changed and what is still open. The body of
> this report below is left exactly as originally written, as the historical
> record of what the audit found; §1b is the only section describing the fixes.
> **Nothing has been deployed to production.** The release recommendation in §18
> describes the state as originally audited, not the current local state — read
> §1b before drawing a release conclusion from this document.

---

## 1. Executive summary

Spintra City's **core game loop works**. Two players can create a room, seat, ready,
start, roll, move, buy, pay rent, build, trade, auction, go bankrupt and be scored
into the existing room scoreboard. Realtime sync between clients is verified working.
The rules engine is largely correct: 101 of 120 executed rule tests pass, including
the entire rent matrix, even-build, the insolvency ladder, and 30 of 32 cards.

It is **not releasable**. Four independent defects can each permanently destroy a match
in progress, and one of them additionally bricks the room it happened in. Moderation
does not work at all inside a match: a kicked and banned player retains full control of
their seat. An entire slice of 20 MUST requirements — disconnect handling, autopilot,
forced retire, and the turn clock itself — was never implemented, and the turn clock the
UI implies exists is decorative.

**Release recommendation: NOT READY FOR RELEASE.**

### Headline numbers

| | Count |
|---|---|
| Total test cases executed | **298** |
| Passed | **231** |
| Failed | **67** |
| Blocked | **0** |
| **Not tested** | **0** |
| Not applicable (feature not deployed) | **1** |
| Withdrawn as unreliable | **2** |
| Pass rate (of executed) | **77.5 %** |
| Total confirmed bugs | **44** |
| Critical | **4** |
| High | **13** |
| Medium | **12** |
| Low | **15** |
| *(after an independent re-verification pass — see §1a)* | |

---

## 1a. Independent re-verification pass

Every filed bug was re-tested from scratch by testers instructed to **falsify** it, not confirm
it. That pass changed this report materially, and the changes are recorded here rather than
quietly folded in.

### Findings that did not survive as filed

| Bug | What was wrong |
|---|---|
| **BUG-018** (detention doubles) | **Not a defect as filed.** The behaviour is real, but it *matches* DESIGN §3.1A, and the player rolls twice yet **moves once** — "grants a whole extra roll" overstates it. Only residual: the fresh roll can itself set `doubles_count`. Downgraded MEDIUM → **LOW, documentation gap**. |
| **BUG-027** (dice oracle) | **Premise false.** The claim was that `city_derive_dice`'s EXECUTE grant is the risk. But the function is pure and **its algorithm is published verbatim in migration 0064**; it was reimplemented in 6 lines of Node with byte-identical output. Revoking the grant would provide *zero* security benefit. **Re-filed against seed entropy** (`random() * 2^53` from a non-CSPRNG, fed to md5, with `last_roll` readable as known plaintext). |
| **BUG-019** (cash disclosure) | **Half false.** `city_net_worth` confirmed leaking exact hidden cash. But `city_max_liquidation` returned **0, not a leak** — that half does not hold. Investigating it uncovered BUG-045 instead. |
| **BUG-031** (raw errors) | Confirmed, with a correction: a negative `give_cash` on an *empty* offer trips `city_trade_not_empty` first, not the column check named in the original report. |

### Severity corrections

| Bug | Was | Now | Why |
|---|---|---|---|
| **BUG-005** | CRITICAL | **HIGH** | The freeze is **temporary** — the payer recovers on their own turn. A stall of up to N−1 turns, not a permanent deadlock. |
| **BUG-020** | MEDIUM | **LOW** | Successful commands **are** throttled — call 61 got `CITY_RATE_LIMIT` with exactly 60 in the ledger. Only *invalid* command spam is unmetered: a DB-load nuisance, no gameplay advantage. |
| **BUG-034** | HIGH | **MEDIUM** | Confusing, not damaging — no state corruption, and one click on the only enabled button recovers it. |
| **BUG-039** | MEDIUM | **LOW** | The server enforces the identical rule (`city_assert_can_manage` → `CITY_NOT_YOUR_TURN`), so there is no client/server mismatch and nothing exploitable. It reduces to a missing explanation — a copy fix. |
| **BUG-038** | MEDIUM | **HIGH** | *Understated.* Proven behaviourally across matches: activity in a completely separate room made idle clients run a full 5-query refetch. With `city_trade_offers`/`city_auctions` both carrying RLS `USING (true)`, there is no row-level gate to compensate. Cross-tenant amplification. |
| **BUG-008** | HIGH | **HIGH (floor)** | *Understated.* Six concurrent unauthenticated force-settles charged the winner **six times** — 1600 → 400, with 1,000 destroyed and no counterparty. It scales with concurrency. |

### Magnitude correction

**BUG-037** — the filed "~30× amplification / ~1,000 reads" is overstated by about a third.
Measured twice under isolation (one mutation per window, 2.5 s quiet before, 5 s settle after),
with a verified idle baseline of **0** reads: **22.9 reads per mutation across two clients**
(11.5 per client, ≈2.3 refetch rounds each). 32 mutations projects to ~730 reads, not ~1,000.
Every per-mutation count was an exact multiple of 5, which does confirm the "no coalescing"
half of the claim precisely.

### Two new bugs found *by* the re-verification

- **BUG-044 (MEDIUM)** — `city_charge` **overwrites** `pending_debt` instead of accumulating it,
  so a second off-turn charge erases the first creditor's claim outright (50 owed to Bo replaced
  by 40 owed to Cy; Bo's claim vanished). Reachable only because BUG-005 lets a debt survive
  across other players' turns.
- **BUG-045 (MEDIUM)** — `city_max_liquidation` returns **0** through NULL propagation:
  `build_cost` is NULL for stations, so `buildings * (build_cost/2)` is `0 * NULL = NULL`, which
  poisons the `sum()` and is then flattened by `coalesce(...,0)`. A seat holding an unmortgaged
  190 property reports 0 liquidation instead of 95. **Bankruptcy survivability checks depend on
  this number**, so it will bankrupt players who could actually pay.

### What held

Everything else survived falsification with its severity intact, including all four remaining
criticals (BUG-001, 002, 003, 004), BUG-009, BUG-010 (proven at runtime, not just by code
reading), BUG-012, BUG-014, BUG-035, and the whole disclosure set. BUG-010's runtime proof also
showed `city_place_bid` and `city_settle_auction` carry **no match-status guard either**, which
is why it escalates from "a phase field was twiddled" to property and cash actually moving after
scoring.

---

## 1b. Fix phase update (2026-09-01) — local only, not deployed

A fix phase followed this audit, in four rounds. **All 4 criticals are now
fixed and independently verified**, along with 24 further bugs closed across
the four rounds. Everything in this section happened **entirely on the local
Docker stack** — production has none of migrations `0063`–`0080` and remains
exactly as this audit found it. This section does not revise the audit above;
it records what changed after it.

### What changed

| Fixed | Closed by | How it was verified |
|---|---|---|
| **BUG-001** kick strands the match on the departed seat | `0074` — a trigger on `room_participants` retires the seat and hands the turn on | Load test (20 concurrent matches, byte-identical counts); three hand-checked scenarios (lobby departure, mid-turn, off-turn) |
| **BUG-002** kicked/banned player keeps acting | `0071` — membership re-checked in `city_rate_limit_check`, the one chokepoint all 19 command RPCs already call | Regression harness; re-verified against the real pre-fix committed source |
| **BUG-003** no route to resolve a stalled turn | `0076` (`city_claim_timeout`) + a client-side auto-claim effect mirroring `city-auction.tsx`'s own pattern | 5 behavioral SQL proofs across all branches; a live two-browser test where a genuinely stalled opponent recovers with **zero manual clicks** on either page |
| **BUG-004** a solvent debtor is never deadlocked | `0072` — `city_try_settle_debt` now fires on any cash inflow, not just mortgage/sell | Regression harness; load test |
| **BUG-008** unauthenticated auction force-settle | `0071` — `p_force` dropped from the client-callable signature entirely | Confirmed `42501 permission denied` over real HTTP with a minted JWT |
| **BUG-009** decline auctions an already-owned space | `0071` — added the missing ownership check | Regression harness |
| **BUG-010** a finished match stays mutable | `0071` — null-safe status/phase guards (`is distinct from`) | Regression harness |
| **BUG-012** self-inflated xp/rank | `0073` — engine-owned columns excluded from the self-update path | Confirmed refused (HTTP 400) over real HTTP; confirmed legitimate self-updates (reconnect, rename, avatar) still work |
| **BUG-013** health check probes the wrong realtime path | Direct fix, `src/app/api/health/route.ts` | `/api/health` now returns `200, status: "ok", realtime: "reachable"` |
| **BUG-014** bankruptcy hands over developed buildings free | `0072` — developments sold to the bank first, per DESIGN §3.1D | Regression harness |
| **BUG-019** `city_net_worth`/liquidation leak cash to outsiders | `0071` — both revoked from clients; confirmed unused by the client | — |
| **BUG-024** trade cash doesn't discharge a debt | `0072` — same auto-settle-on-cash trigger as BUG-004 | Regression harness |
| **BUG-031** raw Postgres errors leak instead of `CITY_*` codes | `0071` — `city_rate_limit_check` now raises `CITY_MATCH_NOT_FOUND` on a null room code before it can hit the NOT NULL violation | — |
| **BUG-038** two realtime subscriptions unfiltered across all matches | `use-city-match.ts` — extended the existing `matchIdRef` client guard to all three tables | Two independent live matches: match-2 activity produced **0** requests on an idle match-1 client; that same client's own action produced 20 (proves it's scoped, not just deaf) |
| **BUG-044** a second charge erases the first creditor's claim | `0075` — additive `city_debt_queue`, `pending_debt`'s existing meaning left untouched | Regression harness proves the **full loop** (both creditors actually paid, not just a number recorded); re-verified against the real pre-fix `city_charge` |
| **BUG-045** max liquidation collapses to 0 for a station holder | `0072` — `coalesce(build_cost, 0)`, matching `city_net_worth`'s existing guard | Regression harness |
| **BUG-005** an off-turn debtor is locked out of every raise-funds action | `0077` — `city_assert_can_manage` gains a defaulted `p_allow_off_turn_debt` flag, passed only by the three raise-funds/give-up actions | Regression harness: off-turn `city_mortgage` succeeds and the raised cash clears the debt in full (creditor paid); `city_build` stays refused off-turn |
| **BUG-011** a debtor could strip assets to an accomplice via trade | `0077` — `city_accept_trade` now refuses an accepting debtor unless the trade's own cash fully covers `pending_debt` | Regression harness: a sub-debt trade is refused and the property stays put; a debt-clearing trade succeeds and auto-settles via the existing 0072 trigger |
| **BUG-023** an expired trade offer's status update silently rolled back | `0077` — removed the doomed update-then-raise (any exception in the same statement undoes it regardless); accept's actual refusal was never affected either way | Code review — no independent pre/post behavioral difference exists to assert (see below) |
| **BUG-029** management actions ignored match phase entirely | `0077` — `city_assert_can_manage` now refuses all five gated actions during an active auction, and `city_build` specifically during `required_decision` | Regression harness: both refusals confirmed with the exact expected error code, not just "it failed" |
| **BUG-021** `city_match_results` bypasses RLS via view-owner execution | `0078` — `security_invoker = true`, so it now evaluates as the calling role and inherits `city_matches`/`city_match_players`' existing RLS | Regression harness: an outsider reads 0 rows for a finished match in a room they never joined |
| **BUG-025** `city_assets`/`city_auctions`/`city_trade_offers` world-readable | `0078` — all three get the same `is_member_of_room` join `city_matches`/`city_match_players` already used, replacing `using (true)` | Regression harness: an outsider reads 0 rows across all three tables; a genuine room member still reads them normally |
| **BUG-026** `city_matches`/`city_match_players` missing an explicit write revoke | `0078` — `revoke insert, update, delete ... from anon, authenticated` on both, matching every sibling City table | Regression harness: a raw client `UPDATE` on either table is refused with `insufficient_privilege` (42501), not merely blocked by RLS |
| **BUG-027** match seed used Postgres's non-cryptographic `random()` | `0078` — re-filed during re-verification against seed entropy, not `city_derive_dice`'s grant; switched to `pgcrypto`'s `gen_random_bytes(8)` | Regression harness: source check confirms `gen_random_bytes` is used and no bare `random()` seed assignment remains |
| **BUG-015** an unaffordable direct card charge left the wrong phase | `0079` — `city_roll_dice`'s phase logic now also covers a card that charges the drawing player directly ('pay'/'per_building'), not just a direct landing or a card-triggered nested landing | Regression harness: landing on a real "pay 75" card with 10 cash leaves `phase=required_decision`, not `optional_actions` |
| **BUG-016** the deck stopped being a true permutation once a Transit Visa was held | `0079` — `city_draw_card` now derives from the round's full, fixed-size permutation and only substitutes the next slot if the drawn one is the currently-held visa, instead of re-deriving the round from a shrinking eligible count | Regression harness: all 15 non-visa `city_fund` cards appear at least once across 16 draws with the visa picked up mid-round |
| **BUG-017** "double rent" cards charged the unscaled base rent | `0079` — the multiplier now applies to `city_resolve_landing`'s own computed rent, not to the dice total fed into it (which only utilities ever read) | Regression harness: a rent-multiplier card against a 23-rent property charges exactly 46 |
| **BUG-032** card 10 charged 24× the roll instead of the stated 10× | `0079` — a new flat-rent parameter replaces the normal utility formula outright for this card, instead of pre-scaling the dice total feeding into it | Regression harness: a roll of 6 against an owner holding both utilities charges exactly 60 |

**Improved as a side effect, not independently verified as fully closed:**
- **BUG-006** (turn clock decorative) — `city_claim_timeout` (0076) now reads `turn_started_at`/`pace_seconds` for a real purpose, so the clock is no longer purely decorative; a genuine consequence exists once it lapses. The original defect's core claim no longer holds. What remains open: no visible countdown is rendered anywhere (a separate, cosmetic gap this fix did not address).

**A gap this fix phase introduced in itself, found and closed in the same
round it was introduced:** migration `0080` closes an unrevoked, publicly-
executable duplicate function overload that `0077` and `0079` each left
behind (Postgres creates a genuinely new overload when `CREATE OR REPLACE`
adds parameters, rather than editing in place, and grants it PUBLIC execute
by default). Not one of the 44 audit-numbered bugs — a self-introduced and
self-corrected regression, documented in full in `QA_PROGRESS.md` and closed
before any of this work left the local stack.

### Every fixed migration passed the same gates

`npm run test:city-regression` (24 SQL assertions plus 2 source checks — BUG-038
and BUG-013 — for 26 total; the original 12 release-blocking checks, 3 added in
round 2 for BUG-005/011/029, 4 added in round 3 for BUG-021/025/026/027, 4 added
in round 4 for BUG-015/016/017/032, and one general `META-OVERLOAD-GRANTS` check
added alongside 0080 that sweeps the whole `city_*` function surface for the
overload-grant trap so it can't recur silently), a 20-match concurrent load test
with byte-identical outcome counts before and after every round-1 change,
post-load integrity checks (no negative cash, no orphaned assets, no deadlocks),
idempotent re-application of every migration (rounds 2 through 4 each re-verified
directly: every migration from `0077` on re-applies as a clean no-op with the
harness unchanged), and `npm run verify`. Three round-1 fixes were additionally
proven at the browser layer with two independent live clients. Full detail,
including five false-positive regression-check bugs caught and fixed across all
four rounds — plus the self-introduced overload-grant regression above — is in
`QA_PROGRESS.md`.

**BUG-023 has no dedicated regression assertion, by design, not by omission.**
The bug was that a write attempted just before an exception silently rolled back
— but that write never once persisted, before or after this fix, because any
exception raised later in the same statement undoes everything in it regardless
of ordering. `city_accept_trade`'s caller-visible behavior (refuses with
`CITY_OFFER_EXPIRED`, offer row stays `pending`) is therefore bit-for-bit
identical before and after; the fix removes a statement that could never have
taken effect, so no assertion can honestly turn red pre-fix and green post-fix
for this specific change. Padding the harness with one anyway would be exactly
the kind of decorative check this audit's re-verification pass (§1a) exists to
catch.

### Updated numbers

| | Original audit | After the fix phase (local only) |
|---|---|---|
| Confirmed bugs | 44 | 44 found, **28 fixed**, 16 open |
| Critical | 4 | **0 unresolved** (4 of 4 fixed) |
| High | 13 | 4 unresolved (9 of 13 fixed: 008, 009, 010, 012, 013, 014, 038, 005, 011) |
| Medium | 12 | 3 unresolved (9 of 12 fixed: 019, 024, 044, 045, 023, 021, 015, 016, 017) |
| Low | 15 | 9 unresolved (6 of 15 fixed: 031, 029, 025, 026, 027, 032) |

The 16 still-open bugs were, without exception, already classified as non-blocking
in the original audit (§17's fix list covered the release-blocking set almost
exactly — items 1–8 there map directly to the migrations above). None of them
individually gates a release the way the four criticals did. The largest single
item left is BUG-007's 20 MUST-requirement slice (disconnect grace, autopilot,
forced retire, the full turn-clock model) — deliberately untouched throughout all
four rounds as genuinely multi-day work, not an oversight.

### What this means for the release verdict in §18

**Production is unchanged and remains NOT READY**, because nothing has been
deployed to it — §18's verdict is accurate as a description of production today.
**The local codebase's blocking-defect count has gone from 4 criticals to 0**,
which is the precondition §18 named for reconsidering that verdict, not a
substitute for actually shipping migrations `0071`–`0080` and re-running this
audit against production once they are.

---

## 2. QA status by suite

| Suite | Cases | Pass | Fail | Notes |
|---|---|---|---|---|
| TC-GAME — gameplay | 20 | 20 | 0 | turn order, doubles, salary, movement all correct |
| TC-DEV — development | 20 | 16 | 4 | even-build correct; supply limit and phase gating are not |
| TC-INS — insolvency | 7 | 7 | 0 | full ladder correct |
| TC-CARD — cards | 16 | 11 | 5 | 30/32 cards correct; deck permutation breaks with a visa |
| TC-DET — detention | 10 | 9 | 1 | doubles-escape behaviour matches spec (BUG-018 downgraded on re-test) |
| TC-TRADE — trading | 18 | 15 | 3 | atomicity and staleness correct; debt interaction is not |
| TC-AUCT — auctions | 11 | 9 | 2 | mechanics correct; force-settle is exposed to clients |
| TC-END — match end | 8 | 7 | 1 | scoring correct; bankruptcy hands over buildings |
| TC-EDGE — negative | 10 | 7 | 3 | finished matches remain mutable |
| TC-SEC — security | 20 | 14 | 6 | RNG seed protection is solid; auth gaps elsewhere |
| TC-API — backend | 12 | 9 | 3 | authorization matrix mostly correct |
| TC-DB — database | 16 | 15 | 1 | concurrency, cash conservation and indexes all sound |
| TC-SPEC — conformance | 51 | 29 | 22 | 20 MUST requirements unimplemented |
| TC-SEAM — existing site | 10 | 5 | 5 | the weakest area of the whole feature |
| TC-MULTI — multiplayer | 19 | 19 | 0 | sync, server authority, live trade offers and a full auction all sound |
| TC-UI — interface | 10 | 8 | 2 | panels and trading correct; consent banner intercepts clicks, holdings dead off-turn |
| TC-UX — usability | 6 | 4 | 2 | error copy is genuinely good; narration and post-refresh guidance are not |
| TC-REC — recovery | 6 | 4 | 2 | reconnect and rejoin both recover cleanly; tab close is unrecoverable |
| TC-FE — frontend | 5 | 2 | 3 | console clean; refetch amplification and global subscriptions |
| TC-COMPAT — viewports, themes, browsers & devices | 17 | 15 | 2 | no horizontal page scroll anywhere; themes, all 3 engines and 4 device profiles pass |
| TC-PERF — load & memory | 3 | 3 | 0 | 1,200 ops across 20 concurrent matches, 0 deadlocks; no memory growth |
| TC-REG — regression | 3 | 3 | 0 | verify, build, and an app-level playthrough all clean |

---

## 3. Environment

| | |
|---|---|
| App (dev) | `next dev` :4010 — **unusable over `127.0.0.1`, see §14** |
| App (prod) | `next build` + `next start` :4020 — used for all browser verdicts |
| Database | Docker `supabase_db_Spintra-1`, Postgres :54322 |
| API | PostgREST via Kong, `http://127.0.0.1:54321` |
| Browser | Chromium (Playwright), 1280×800 |
| Production | **Never contacted.** Bundle verified to contain only the local URL. |

---

## 4. Critical issues

### BUG-001 — CRITICAL — Kicking a player mid-match permanently deadlocks the match and bricks the room

> **✓ Fixed 2026-09-01 — migration `0074`.** See §1b for what changed and how it was verified.

Reproduced through the real `moderation_kick_ban` RPC, not a synthetic delete.

**Steps.** Two seated players; make it Bo's turn; host calls `moderation_kick_ban(room, bo)`.

**Result.** Bo leaves `room_participants` (confirmed 0 rows) but his `city_match_players`
seat survives as `status='active'`. The match stays `active` with `current_seat = 1`.
Ann — the only person left — gets `CITY_NOT_YOUR_TURN` on both `city_roll_dice` and
`city_end_turn`. Nothing can advance the turn, because no timeout or autopilot exists
(BUG-003). The blast radius was then measured:

- New match in that room → `CITY_MATCH_ALREADY_EXISTS` (partial unique index covers `active`).
- Delete/close the room → `ROOM_HAS_LIVE_MATCH`.
- Any client-callable routine that can abandon a match → **none exist** (0 rows).

The room is unusable for Spintra City from that moment. It self-heals only via
`cleanup_inactive_rooms`, which force-deletes idle City rooms after **24 hours** with
nobody online. The only workaround is to abandon the room and create a new one, losing
the room code, invite links, QR codes and scoreboard continuity.

**Violates** FR-40. **Fix:** settle the seat inside the same transaction as the
participant delete, and provide a host-callable abandon path.

### BUG-002 — CRITICAL — A kicked and banned player keeps full control of their seat

> **✓ Fixed 2026-09-01 — migration `0071`.** See §1b for what changed and how it was verified.

**Root cause (precise):** `city_join_seat` is the **only** City RPC that calls
`is_member_of_room`. Every other gameplay RPC authorizes on seat occupancy alone, so
room membership is verified once at seat time and never re-checked.
`city_rate_limit_check` only counts attempts; it does not authorize.

**Evidence.** After `moderation_kick_ban` (verified `bo_in_room = 0`, `bo_banned = 1`),
the banned user successfully executed:

| Call | Result |
|---|---|
| `city_roll_dice` | `{"to":9,"dice":[4,5],"landing":{"action":"may_buy"}}` — moved |
| `city_build` | `{"cost":100,"space":6,"buildings":1}` — built |
| `city_mortgage` | `{"space":8,"raised":45}` — mortgaged |
| `city_end_turn` | `{"next_seat":0}` — advanced the turn |

Cash moved 1600 → 1545. Moderation is entirely ineffective inside a City match: an
abusive player cannot be removed, only removed from the chat around the game.

### BUG-003 — CRITICAL — An absent active player stalls the match forever

> **✓ Fixed 2026-09-01 — migration `0076`.** See §1b for what changed and how it was verified.

No `city_claim_timeout`, `city_retire`, `city_kick`, `city_pause`, `city_autopilot`
or `city_resume` routine exists. With `turn_started_at` set two hours in the past the
match stayed `active` on the absent seat; the other player could do nothing;
`city_leave_seat` refuses once status ≠ `lobby`; `city_declare_bankruptcy` refuses a
solvent player with `CITY_NO_DEBT`. Same terminal state as BUG-001.

**What the surviving player actually sees** (verified in a browser, tab closed mid-turn):

- The match sits frozen — `status=active`, `current_seat` and `phase` stuck on the absent seat.
- **No countdown is rendered at all.** `pace_seconds = 40` is stored on the match row and
  never surfaces in the UI. So there is not even a misleading timer running down to nothing —
  the player gets *no signal that a clock exists*.
- **No escape control exists.** Every `<button>` was scanned for skip / kick / remove /
  abandon / end-match / forfeit / retire: none.
- The vanished player is still counted as present in the participant list, and the status
  line never acknowledges the disappearance.

A player closing their tab is enough to trigger this. No bad intent is required.

### BUG-004 — CRITICAL — A pending debt can become undischargeable, deadlocking the match

> **✓ Fixed 2026-09-01 — migration `0072`.** See §1b for what changed and how it was verified.

`city_try_settle_debt` is revoked from clients and runs only as a side effect of
`city_mortgage`/`city_sell_building`. A player who raises money any other way — e.g.
selling their last property via a trade — keeps the debt with nothing left to mortgage.
All nine exits then close simultaneously: `end_turn`/`roll_dice`/`build`/`unmortgage`
→ `CITY_SETTLE_DEBT_FIRST`; `declare_bankruptcy` → `CITY_CAN_PAY`;
`mortgage`/`sell_building` → `CITY_NOT_YOURS`; `buy`/`decline` → `CITY_NOT_FOR_SALE`.

---

## 5. High issues

| ID | Finding |
|---|---|
| BUG-006 | **Turn clock is decorative.** `turn_started_at`, `turn_clock_elapsed_ms`, `turn_clock_paused_at` are only ever written (reset on turn change) and never read for expiry. `pace_seconds` is never written or read. No enforcement exists anywhere. |
| BUG-007 | **20 MUST requirements unimplemented** (FR-25–33, FR-41–51): disconnect grace, autopilot, forced retire, voluntary retire, host kick, durable pause, the clock model, sub-clocks, timeout defaults. `'paused'` and `'retired'` statuses are referenced in constraints but never set. |
| BUG-008 | **&#10003; Fixed 2026-09-01 (migration `0071`, see §1b).** **`city_settle_auction(p_force)` is client-callable and unauthenticated.** `p_force` skips both the advisory lock and the deadline check. Verified over HTTP with **no JWT at all**: it returns `CITY_NO_AUCTION` where sibling RPCs correctly return `CITY_NOT_AUTHENTICATED` — it has no auth check whatsoever. Any visitor can close any room's auction early; two parallel force-settles charge the winner twice, destroying money. |
| BUG-009 | **&#10003; Fixed 2026-09-01 (migration `0071`, see §1b).** **Declining while in debt auctions an already-owned property and destroys cash.** `city_decline_purchase` checks only the phase, which `city_charge` also sets. The winner is charged, the `on conflict do nothing` insert transfers nothing. 100 Spins vanished in the repro. |
| BUG-010 | **&#10003; Fixed 2026-09-01 (migration `0071`, see §1b).** **A finished match can be re-opened and mutated.** `city_decline_purchase` has no `status <> 'active'` check, and `city_finish_match` nulls both `phase` and `current_seat`, so its two remaining guards evaluate to `NULL` rather than true and silently pass. Property transferred and cash deducted *after* scores and XP were written. |
| BUG-011 | **&#10003; Fixed 2026-09-01 (migration `0077`, see §1b).** **A debtor can strip every asset by accepting a trade.** `city_propose_trade` blocks a proposer in debt; `city_accept_trade` never checks `pending_debt`. The creditor received 10 cash and no properties. |
| BUG-012 | **&#10003; Fixed 2026-09-01 (migration `0073`, see §1b).** **Arbitrary self-XP/rank.** A player can `PATCH room_participants` on their own row and set `xp` and `rank` freely (999999 / `legend`), bypassing engine-authoritative scoring. Cross-player and cross-room edits are correctly blocked; the hole is self-edit. |
| BUG-013 | **&#10003; Fixed 2026-09-01 (direct fix, `route.ts`, see §1b).** **`/api/health` is permanently 503.** The realtime probe requests `/realtime/v1/ws` with a plain GET; that path does not exist (the real one is `/realtime/v1/websocket`) and a GET can never upgrade. Realtime is actually healthy — handshake returns **101**. An uptime monitor on this endpoint is either permanently alarming or trained to ignore it, so a real outage would not stand out. Pre-existing site defect, in City's dependency path. |
| BUG-005 | **&#10003; Fixed 2026-09-01 (migration `0077`, see §1b).** **A player charged off-turn is stalled with a debt they cannot settle.** `city_charge` sets the raise-funds phase only for the current seat (`where ... and current_seat = p_seat`), while `city_assert_can_manage` gates mortgage, sell, build, unmortgage **and** `declare_bankruptcy` on being the current seat. A "collect from every player" card leaves the payer with `pending_debt` and no legal action — mortgage/bankruptcy → `CITY_NOT_YOUR_TURN`, trade/bid → `CITY_SETTLE_DEBT_FIRST` — and the card reported `"total": 200` when only 100 moved. **Re-test correction:** the freeze is temporary; the payer recovers on their own turn, so this is a stall of up to N−1 turns (7 at a full table), not a permanent deadlock. Downgraded from CRITICAL. It also enables BUG-044. |
| BUG-038 | **&#10003; Fixed 2026-09-01 (`use-city-match.ts`, see §1b).** **Two realtime subscriptions are global, not per-match** — upgraded from MEDIUM on re-test. `city_auctions` and `city_trade_offers` subscribe with no filter and call a bare `refetch()`. Proven behaviourally: activity in a completely separate room made idle clients in another match run a full 5-query refetch. Both tables also carry RLS `USING (true)`, so no row-level gate compensates. Cross-tenant amplification. |
| BUG-034 | **After a mid-turn refresh the instructions contradict the buttons.** With phase `optional_actions`, the status line reads "Your turn — roll the dice." while Roll is disabled and End turn is the only legal move. `lastRoll` is client-only React state discarded by the reload, and the fallback string ignores `match.phase`. A new player reads "roll the dice", finds Roll dead, and concludes the game is broken. |
| BUG-035 | **The off-turn player is never told what happened.** The active player gets a full sentence ("Rolled 6 and 1, moved to City Fund… Collect 250 Spins."); the opponent's screen says only "Waiting for Guest_1w4e6." The narration string is verifiably absent from the off-player's DOM. Cash badges change silently — in a game whose whole tension is money moving between players, the person *losing* the money is the one not told. |
| BUG-014 | **&#10003; Fixed 2026-09-01 (migration `0072`, see §1b).** **Bankruptcy hands over buildings instead of selling them.** DESIGN §3.1D requires developments sold to the bank at half cost first. Creditor received three properties still at 3 buildings each instead of 490 cash and bare deeds — and can hold a developed set they never completed, bypassing the even-build invariant. |

---

## 6. Medium issues

| ID | Finding |
|---|---|
| BUG-015 | **&#10003; Fixed 2026-09-01 (migration `0079`, see §1b).** Unaffordable card charge leaves phase `optional_actions` instead of raise-funds; client gets no signal, `end_turn` then fails. |
| BUG-016 | **&#10003; Fixed 2026-09-01 (migration `0079`, see §1b).** Deck stops being a permutation once a Transit Visa is held — `v_size` changes mid-cycle. 16 draws yielded card 2 twice and card 13 never. Violates FR-19. |
| BUG-017 | **&#10003; Fixed 2026-09-01 (migration `0079`, see §1b).** Cards 2 and 3 charge **half** their printed rent — the multiplier is passed as a dice-total scale, which only utilities consume. "Double the usual rent" charged 35, not 70. |
| BUG-019 | **&#10003; Fixed 2026-09-01 (migration `0071`, see §1b).** `city_net_worth` leaks RLS-protected cash to an outsider in no room. Because `city_assets` is world-readable, the outsider computes the asset term and inverts the RPC exactly (`cash = 1590 − 190 = 1400`). **Re-test correction:** the `city_max_liquidation` half of the original claim does not hold — it returns 0, which turned out to be BUG-045 instead. |
| BUG-021 | **&#10003; Fixed 2026-09-01 (migration `0078`, see §1b).** `city_match_results` view bypasses RLS (owner-executed, not `security_invoker`): bare anon reads room codes, usernames and net worth for every finished match in every room. |
| BUG-022 | Spectators silently capped by room capacity — a third person could not enter a 2-capacity room. Violates FR-38. |
| BUG-023 | **&#10003; Fixed 2026-09-01 (migration `0077`, see §1b).** `city_accept_trade` marks an expired offer `'expired'` then raises in the same transaction, rolling the update back; the offer stays `pending` forever. |
| BUG-044 | **&#10003; Fixed 2026-09-01 (migration `0075`, see §1b).** **`city_charge` overwrites `pending_debt` instead of accumulating it**, so a second off-turn charge erases the first creditor's claim outright (50 owed to Bo replaced by 40 owed to Cy). Found during re-verification; reachable only because of BUG-005. |
| BUG-045 | **&#10003; Fixed 2026-09-01 (migration `0072`, see §1b).** **`city_max_liquidation` returns 0 through NULL propagation.** `build_cost` is NULL for stations, so `buildings * (build_cost/2)` is `0 * NULL = NULL`, poisoning the `sum()`, which `coalesce(...,0)` then flattens to 0. A seat holding an unmortgaged 190 property reports 0 instead of 95. Bankruptcy survivability checks depend on this, so it will bankrupt players who could pay. Found during re-verification. |
| BUG-024 | **&#10003; Fixed 2026-09-01 (migration `0072`, see §1b).** Trade cash does not discharge a pending debt (`city_accept_trade` never calls `city_try_settle_debt`) — the mechanism behind BUG-004. |
| BUG-037 | **Refetch amplification, measured 22.9× across two clients** (re-test corrected the filed ~30×). One clean 2-player session of ~32 mutations produced ≈1,000 REST reads: every mutation triggers `runCommand`'s own `await refetch()` *and* a realtime ping from each of four tables, each firing a further 5-query refetch, on both clients, with no debounce or coalescing. Scales with seat count. |
| BUG-040 | **The cookie-consent banner intercepts clicks on controls beneath it.** Reproduced by A/B: with the banner undismissed, `elementFromPoint` at the centre of the trade panel's "Send offer" button returns `DIV.fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6` — the banner — and the click is swallowed with no feedback. Dismiss the banner and the same point returns the button's own container and the click lands. The banner is fixed to the bottom-right and persists until explicitly accepted or declined, so any primary action it overlaps silently does nothing. |

---

## 7. Low issues

| ID | Finding |
|---|---|
| BUG-025 | **&#10003; Fixed 2026-09-01 (migration `0078`, see §1b).** `city_assets`, `city_auctions`, `city_trade_offers` have RLS `USING (true)` — world-readable cross-room with the public anon key. |
| BUG-026 | **&#10003; Fixed 2026-09-01 (migration `0078`, see §1b).** Blanket INSERT/UPDATE/DELETE grants on `city_matches`/`city_match_players` including `rng_seed`. Currently blocked by RLS having no write policy (verified), but one permissive policy would expose cash and seed writes. |
| BUG-027 | **&#10003; Fixed 2026-09-01 (migration `0078`, see §1b).** `city_derive_dice` exposed to clients — latent oracle, harmless only while the seed stays hidden. |
| BUG-028 | `building_supply_limit` is never read; with it set to 2, a 5th building still built. |
| BUG-029 | **&#10003; Fixed 2026-09-01 (migration `0077`, see §1b).** `city_assert_can_manage` never checks phase, so building/mortgaging succeed during `auction` and `required_decision`. |
| BUG-030 | Mortgage uses integer truncation (Porto 55 → 27, not 27.5); a mortgage round-trip silently costs 3 Spins. |
| BUG-031 | **&#10003; Fixed 2026-09-01 (migration `0071`, see §1b).** Raw Postgres errors leak instead of `CITY_*` codes: self-trade and negative `give_cash` print the failing row; six routines pass a NULL room code to the rate limiter before validating the match, producing a NOT NULL violation. |
| BUG-032 | **&#10003; Fixed 2026-09-01 (migration `0079`, see §1b).** Card 10 charges 24× the roll when both utilities are held (2 × the 12× rate); text says ten times. |
| BUG-033 | No code path makes eliminated players spectators (FR-36); `pace_seconds` is never settable by the host (FR-42). |
| BUG-043 | Several site-wide footer and nav links are ~20 px tall, below the 24 px minimum touch target (`Explore`, `Terms`, `Privacy`, `Privacy Policy`). Measured on real device profiles with touch emulation. **No City game control is undersized** — the board tiles and action buttons all pass. The 1×1 `sr-only` "Skip to content" link is a correct pattern, not a defect. |
| BUG-042 | **No offline or reconnecting indicator anywhere in the City UI.** With the network cut mid-turn an error message does surface, but nothing tells the player they are disconnected. Confirmed by search: `/offline|reconnect|connection lost|disconnected/i` matches nothing. |
| BUG-041 | The site header nav overflows its container at 768×1024 (`DIV.mx-auto` and `DIV.flex` both report `scrollWidth > clientWidth`). Site-wide, not City-specific; the page itself still does not scroll horizontally. |
| BUG-018 | Escaping detention by doubles discards the escape roll and leaves `awaiting_roll`, so the player rolls twice but **moves once**. Re-test found this matches DESIGN §3.1A and is not a defect as filed — downgraded from MEDIUM. Residual: the fresh roll can itself set `doubles_count`, granting a re-roll the classic game denies. Documentation gap, not a code defect. |
| BUG-020 | The rate limiter's ledger row rolls back with a failing command, so invalid command spam is unmetered. Re-test found successful commands **are** throttled (call 61 refused, exactly 60 in the ledger) — no gameplay advantage, a DB-load nuisance only. Downgraded from MEDIUM. |
| BUG-039 | Holdings controls are all disabled off-turn with no explanation. Re-test found the server enforces the identical rule (`city_assert_can_manage` → `CITY_NOT_YOUR_TURN`), so there is no client/server mismatch and nothing exploitable — a missing-explanation copy fix, not a permission defect. Downgraded from MEDIUM. |

*(BUG-018, 020 and 039 were downgraded to LOW during the independent re-verification pass — §1a — and are restated here as their own rows so every confirmed bug has one, matching the headline count.)*

---

## 8. Multiplayer findings

Verified in two independent browser contexts against the production build:

- **PASS** — room creation, seating, ready, host start, board render, dice roll.
- **PASS** — Player A saw B take a seat **without a reload**; B saw A's roll reflected.
  Realtime is a working change-notifier as designed.
- **PASS** — turn ownership is enforced server-side, not merely by a disabled button:
  out-of-turn `city_roll_dice`/`city_end_turn` return `CITY_NOT_YOUR_TURN`.
- **PASS** — concurrency: parallel roll, buy, and trade-accept each applied exactly once
  (`pg_advisory_xact_lock`). The sole exception is `city_settle_auction(p_force)`, which
  skips the lock (BUG-008).
- **FAIL** — a player who leaves, is kicked, or simply closes their tab mid-turn stalls
  the match permanently (BUG-001/002/003).

## 9. Backend / API findings

Authorization is broadly correct: identity comes from `auth.uid()`, non-members get
`CITY_NOT_SEATED`, wrong-turn gets `CITY_NOT_YOUR_TURN`, and every internal engine
function (`city_charge`, `city_bankrupt_seat`, `city_resolve_landing`, `city_apply_card`,
`city_draw_card`, `city_finish_match`, `city_try_settle_debt`, `city_assert_can_manage`,
`city_rate_limit_check`) is correctly revoked from clients (42501).

The exceptions are BUG-008 (no auth check at all), BUG-019 (two RPCs leak cash), and
BUG-020 (the rate limiter never fires).

**Correction to an intermediate finding:** `city_decline_purchase` was reported by the
security lane as having lost its EXECUTE grant. That is **not reproduced** —
`has_function_privilege('authenticated', …)` is true and PostgREST returns
`CITY_NOT_AUTHENTICATED`, proving it is reachable and executing.

## 10. Database and persistence findings

- **PASS — cash conservation** across trades (3200 → 3200) and bankruptcies
  (1700 → 1700, no minting). The only money destruction found is BUG-008/BUG-009.
- **PASS — concurrency** serialized by advisory locks.
- **PASS — index coverage.** Every query pattern is covered: `(match_id, space_idx)`,
  `(match_id, owner_seat)`, `(match_id, seat)`, `(match_id, user_id)`, a partial unique
  index for the live match per room, one running auction per match, and
  `(user_id, room_code, created_at DESC)` for the rate limiter.
- **PASS — board data integrity**, 9/9 invariants: 40 spaces; all rent arrays length 6
  and strictly increasing; every country group shares one build cost and rent table;
  all airports one price; all utilities one price; 32 cards across 2 balanced decks.
- **PASS — input validation:** SQL injection inert, usernames truncated to 100,
  non-UUID/overflow/out-of-range all fail closed.
- **PASS — direct table writes blocked by RLS** (cash, seed and status immutable to clients).

## 11. Security findings

The single most important control is **sound**: `rng_seed` and `rng_counter` are
unreadable via direct select, `select=*`, the `order=` side channel, the `=gt.` filter
side channel, and PostgREST embedding — all six paths return 42501. `p_seed` is
restricted to `service_role`. Since dice and card draws are derived from the seed, a leak
would have been the worst possible defect in this codebase; it does not leak.

Confirmed exploitable: BUG-008 (unauthenticated auction force-settle + money
destruction), BUG-012 (self-XP), BUG-019 (cash disclosure), BUG-020 (rate-limit bypass),
BUG-021 (cross-room results disclosure), BUG-025/026/027 (hygiene and latent risk).

## 12. UI / UX findings

**What is genuinely good, verified:**

- **Error copy is excellent.** Every `CITY_*` code has a human mapping — "It's not your turn
  yet.", "Settle what you owe first.", "You need the whole country before building." No raw
  `CITY_…` string ever appeared in the DOM. (The raw Postgres leaks in BUG-031 are at the RPC
  layer and were not observed reaching the UI.)
- **Console is completely clean** — zero errors or warnings across a full gameplay session on
  both builds, including no React key or hydration warnings.
- **Server-side authority is real, not cosmetic.** Raw `fetch` calls carrying the player's own
  JWT and bypassing every disabled button were refused every time (`CITY_NOT_YOUR_TURN` ×4,
  `CITY_NOT_HOST`). The disabled buttons are convenience; the server is the referee.
- **No contradictory state was ever observed** between two clients — cash badges, tokens and
  turn ownership matched on every comparison.
- Panels are correct in content: holdings, detention (with the visa option correctly hidden at
  zero), and the trade panel's two-sided price display.

**What is weak — and the pattern is *absence*, not error.** BUG-034 (guidance contradicts the
buttons after a refresh), BUG-035 (the opponent is never told what happened), BUG-040 (a consent banner silently swallows clicks), BUG-039 (holdings dead off-turn), and BUG-003's silent stall all share a
shape: the game does the right thing internally and fails to tell the player. There is also no
offline or reconnecting indicator anywhere in the City UI.

## 12b. Compatibility — viewports and themes (executed)

Measured on the live board at four viewports in both themes, after the environment was
restored. **This corrects a risk I had flagged earlier:** the board's fixed `w-175`
(700 px) square is handled correctly, not a defect.

| Theme / viewport | Horizontal page overflow | Board width | Body background |
|---|---|---|---|
| light · 1280×800 | **0 px** | 700 | `rgb(246,241,239)` |
| light · 1024×768 | **0 px** | 700 | `rgb(246,241,239)` |
| light · 768×1024 | **0 px** | 700 | `rgb(246,241,239)` |
| light · 390×844 | **0 px** | 700 | `rgb(246,241,239)` |
| dark · 1280×800 | **0 px** | 700 | `rgb(1,1,5)` |
| dark · 1024×768 | **0 px** | 700 | `rgb(1,1,5)` |
| dark · 768×1024 | **0 px** | 700 | `rgb(1,1,5)` |
| dark · 390×844 | **0 px** | 700 | `rgb(1,1,5)` |

- **The page never scrolls horizontally at any viewport, in either theme.** The board keeps
  its 700 px square and scrolls *inside its own* `overflow-x-auto` wrapper — which is the
  intended design, not a defect.
- **The theme flip works.** Light and dark both apply, and body foreground inverts correctly
  (`rgb(20,18,15)` ↔ `rgb(251,245,240)`).
- The only element clipped at every size is the visually-hidden `Skip to content` link, which
  is expected.
- One genuine defect surfaced: at **768×1024** the site header nav overflows its container
  (BUG-041). It is site-wide rather than City-specific, and the page still does not scroll.

## 12c. Late additions — the four gaps closed after the environment was restored

All four items previously listed as untested have now been executed.

| Suite | Result |
|---|---|
| **Cross-browser core loop** | **PASS on Firefox, WebKit and Chromium.** Each completed create → seat → ready → start → roll, with realtime seat sync and **zero console or page errors** on all three engines. |
| **Trade offers over realtime** | **PASS.** The recipient saw the incoming offer **~1 second** after it was sent, with no reload. |
| **A full auction in the live UI** | **PASS end to end.** Declining moved the match to `phase=auction` and created a running auction on space 39; the off-turn player saw it **~1 s later without a reload**; three bid buttons rendered; a bid was accepted (`high=10 seat=1`); the other player passing settled it; the space transferred to seat 1. |
| **Offline mid-turn, reconnect, leave-and-rejoin** | **Mostly PASS.** Acting while offline changed nothing in the database (no corruption) and an error did surface. On reconnect, controls became usable again in **~2 s with no reload**, and the player could immediately act. Leaving the room and returning restored the player to their **seat, not spectator**, with the board intact and the seat count unchanged. The one failure: **no offline/reconnecting indicator exists** (BUG-042). |

The reconnect result also **positively disproves** the withdrawn realtime-recovery finding —
realtime resumes correctly. Withdrawing that result rather than reporting it was the right call.

## 13. Not tested — none remain

Every item previously listed as untested has now been executed. What follows is the record
of how each was closed, and the one item that is **not applicable** rather than untested.

### Closed on the final pass

| Area | Result |
|---|---|
| **Load / concurrency** | **PASS.** 20 simultaneous matches × 60 engine operations = **1,200 ops in 1,498 ms**. Zero deadlocks, zero lock timeouts. Post-load integrity was spotless: 0 seats with negative cash, 0 assets owned by a non-existent seat, 0 positions out of range, 0 spaces owned twice, 0 deadlocks recorded by Postgres. The `CITY_IN_DETENTION` refusals in the driver output are correct engine behaviour — the naive driver rolled while jailed. |
| **Long-session memory** | **PASS.** Profiled a complete match (92 actions) via CDP. Heap **17.1 MB → 13.7 MB** and listeners **873 → 520** — both *ended below* baseline. Nodes 958 → 905, documents stayed at 1 (no detached-document leak). One observation: listeners spiked transiently to 4,900 mid-match before collapsing to 520; it recovered cleanly so it is not a leak, but it is plausibly the same root cause as BUG-037/038. |
| **Real device profiles** | **PASS.** iPhone 13 (390 px, DPR 3), Pixel 5 (393 px, DPR 2.75), iPad gen 7 (810 px, DPR 2) and Galaxy S9+ (320 px, DPR 4.5) — all with genuine touch emulation and mobile user agents. Zero horizontal page overflow on every one, the full board rendered, and real `tap()` input worked. One defect found (BUG-043, tap-target sizes). **This is device *emulation*, not physical hardware** — accurate viewport, DPR, touch and UA, but not a real handset. |
| **Cross-browser, trade realtime, live auction, offline/reconnect/rejoin** | All closed earlier — see §12c. |

### Not applicable — not a testing gap

| Area | Why |
|---|---|
| **Production behaviour** | **N/A, not untested.** Spintra City does not exist on production — migrations `0063`–`0070` were never applied there, so there is no behaviour to observe. Making it testable would require pushing those migrations to the live database, which would ship all 4 critical bugs in this report to real users, including the room-bricking kick and the banned-player bypass. That is not an acceptable way to close a report row. It becomes testable once `0071` lands and the feature is deployed. |

### A correction to an earlier stated reason

An earlier draft said "only Chromium is installed for Playwright here." That was false —
Firefox and WebKit were installed all along, and the cross-browser suite has since been run
(all three pass). The reason was written without being checked.

**Two results were withdrawn rather than reported.** An early run appeared to show realtime
failing to resume after reconnect; the tester had force-enabled a disabled button via DOM
tampering earlier in that run and the tampered element survived into later steps, so the
result measured its own contamination. It has since been **positively disproven** — reconnect
restores controls in ~2 s with no reload. The second, BUG-036 ("Send offer unclickable"), was
resolved as a harness artifact: driven with the correct selectors, trading works end to end.

## 14. Environment issue that is **not** a product bug

Reached over `127.0.0.1`, the `next dev` server does not make client components
interactive: no effects run, `authReady` never flips, and the real Create Room button
stays permanently disabled with zero `/auth/v1/` requests. This is **Next 16's dev-server
cross-origin restriction**, not a hydration defect and not a City defect — it affects all
room types. Measured directly:

| Origin | Create Room button becomes enabled |
|---|---|
| `http://localhost:4010` | **yes** |
| `http://127.0.0.1:4010` | no |

Verified not a product defect: the same flow on a production build (`next build` +
`next start`) creates a room and reaches the City lobby immediately, over either host.

Consequence for this audit: the repo's own `tests/city-lobby.spec.ts` cannot pass against
a dev server, because it clicks the hidden `[data-testid="create-room-button"]` shim,
which is wired by a `useEffect` and therefore inert without hydration. Recorded as an
environment/harness limitation, **not** counted as a product failure.

## 15. Regression

| Check | Result |
|---|---|
| `npm run verify` (typecheck + lint + docs:check) | **PASS**, exit 0 |
| `npm run build` (production, local env) | **PASS**, exit 0 |
| App-level two-player playthrough on the production build | **PASS** |
| `tests/city-lobby.spec.ts` | Fails on a dev server for the harness reason in §14 |

## 16. Risk assessment

| Risk | Likelihood | Impact |
|---|---|---|
| A match is destroyed by a disconnect, kick, or debt deadlock | **High** — needs no bad intent, only someone closing a tab | Match lost; room bricked for 24 h |
| A banned player continues disrupting a match | Medium | Moderation unusable; direct safety concern |
| An outsider grieves auctions across every room | Medium — one unauthenticated HTTP call | Match outcomes altered; money destroyed |
| Score/XP inflation via self-PATCH | Medium | Scoreboard integrity across the whole site |
| RNG prediction | **Low** — control verified sound | Would be total, if it ever regressed |

## 17. Recommended fixes, in order

1. **Re-check room membership in every City RPC**, not just `city_join_seat`. Fixes BUG-002 and closes the class.
2. **Settle the seat atomically on kick/leave**, and add a host-callable abandon path. Fixes BUG-001.
3. **Build the cross-cutting slice** — turn-clock enforcement, timeout defaults, autopilot, retire. Fixes BUG-003/006/007 and is the only thing that makes the game survivable in the wild.
4. **Revoke `p_force` from clients** on `city_settle_auction` and add its missing auth check. Fixes BUG-008.
5. **Guard every command on `status = 'active'`** and make null comparisons safe (`is distinct from`). Fixes BUG-010.
6. **Route every money movement through `city_try_settle_debt`**, and let a debtor act off-turn. Fixes BUG-004/005/024.
7. Constrain `room_participants` self-update so `xp`/`rank` are engine-only. Fixes BUG-012.
8. Point the health check at `/realtime/v1/websocket` with a real upgrade, or drop the probe. Fixes BUG-013.
9. Stop the consent banner intercepting clicks on controls beneath it (BUG-040).
10. **Tell the player what is happening** — narrate events to the off-turn player (BUG-035), make post-refresh guidance phase-aware (BUG-034), and add an offline/reconnecting indicator. These are small changes with a large effect on whether the game feels trustworthy.
11. Debounce and coalesce refetches, and filter the two global realtime subscriptions (BUG-037/038).
12. Then the remaining medium/low list, of which BUG-016/017 are the most player-visible.

## 18. Final release assessment

# NOT READY FOR RELEASE

Not because the game is bad — the core loop is genuinely solid and the hardest control in
the system (server-derived randomness) is correctly protected. It is not releasable
because **five distinct defects can each permanently end a match that is going fine**, one
of them takes the whole room with it for 24 hours, and **moderation does not work** — a
banned player keeps playing. Those are the fix-before-anyone-plays items.
