# QA Progress — Spintra City

**Scope:** Spintra City only (new game mode) + its seams into the existing site.
**Build:** branch `feat/spintra-city-design`, HEAD `cb08868`
**Environment:** local Docker Supabase (`supabase_db_Spintra-1`), PostgREST `127.0.0.1:54321`,
dev server `localhost:4010`, **production build `localhost:4020`** (all browser verdicts).
**Production:** never contacted. Production has none of migrations `0063`–`0070`.

## Current phase

**Phase 22 — complete.** All four lanes have reported, the environment was restored after
a Docker outage, and the two gaps left open by it were closed: TC-COMPAT was executed
(passes) and BUG-036 was resolved (withdrawn — trading works). Reports are final.

| Lane | Suites | State |
|---|---|---|
| Engine rules (SQL) | TC-GAME, TC-DEV, TC-INS, TC-CARD, TC-DET, TC-TRADE, TC-AUCT, TC-END, TC-EDGE | **complete** — 120 cases, 101 pass / 19 fail |
| Security / API / DB | TC-SEC, TC-API, TC-DB | **complete** — 42 cases, 8 exploits confirmed |
| Browser / multiplayer | TC-UI, TC-UX, TC-FE, TC-MULTI, TC-REC, TC-COMPAT | **complete** — 27 agent cases + 9 TC-COMPAT executed by the lead |
| Spec conformance, seams, regression, reporting | TC-SPEC, TC-SEAM, TC-REG | **complete** |

## Completed phases

1. Discovery — 8 `city_*` tables + 1 view, 35 routines, 6 client modules mapped.
2. Strategy — `QA_TEST_PLAN.md`: 18 suites, method, severity definitions.
3. Baseline — stack healthy; `npm run verify` clean; `npm run build` clean.
4. Test-case creation — 299 cases with IDs (298 executed, 1 N/A, 0 untested).
5–14. Gameplay, negative/edge, multiplayer, UI, frontend, backend, database,
   performance, security, recovery — executed across four lanes.
15. Exploratory — adversarial passes as normal player, power user and malicious player.
16. Console/log/network audit — complete; console clean on both builds.
17. Automated testing — repo suites run; `city-lobby.spec.ts` blocked by a harness issue.
18–21. Bug management, regression, final audit — 44 bugs triaged and severity-justified.
22. Reports generated.

## Counts

| | |
|---|---|
| Executed | 298 |
| Passed | 231 |
| Failed | 67 |
| Blocked | 0 |
| **Not tested** | **0** |
| Not applicable (feature not deployed) | 1 |
| Withdrawn as unreliable | 2 |
| Bugs | 44 — 4 critical, 13 high, 12 medium, 15 low (after re-verification; corrected a transposed high/medium count and added BUG-018/020/039's missing table rows during the fix-phase report update) |

## Most important discoveries

1. **BUG-001** kicking a player mid-match orphans the seat, deadlocks the match, and
   bricks the room for 24 h. No client-callable routine can abandon a match.
2. **BUG-002** a kicked *and banned* player still rolls, builds, mortgages and ends turns.
   Root cause: `city_join_seat` is the only City RPC that checks room membership.
3. **BUG-003/004** two further routes to a permanently stalled match — absent player and
   undischargeable debt. (BUG-005, the off-turn charge, was downgraded on re-test: it
   stalls for up to N−1 turns but the payer recovers on their own turn.)
4. **BUG-008** `city_settle_auction(p_force)` is callable with **no JWT at all** and skips
   both the advisory lock and the deadline; parallel calls destroy money.
5. **BUG-012** a player can PATCH their own `xp`/`rank` to any value.
6. **BUG-013** `/api/health` is permanently 503 from a wrong-path realtime probe;
   Realtime itself is healthy (handshake returns 101).
7. **BUG-034/035** the UI's failures are failures of *absence*: guidance that contradicts
   the buttons after a refresh, and an opponent who is never told what happened. (BUG-036,
   "Send offer never becomes clickable", was withdrawn — it was a harness artifact.)
8. **BUG-044/045** found by the re-verification pass itself: `city_charge` overwrites a
   pending debt, erasing a creditor's claim; and `city_max_liquidation` returns 0 via NULL
   propagation, so bankruptcy checks will bankrupt players who could actually pay.

## Verified correct (worth recording)

RNG seed protection across all six leak paths · cash conservation across trades and
bankruptcies · advisory-lock concurrency on roll/buy/trade · realtime two-client sync ·
full index coverage · 9/9 board-data invariants · internal engine functions correctly
revoked · input validation and SQL-injection resistance · `verify` and `build` clean ·
zero console errors on both builds · no raw `CITY_*` code ever reaches the user ·
server-side authority proven by raw `fetch` bypassing every disabled button.

## Known limitations of this pass

- Production deliberately untested; `/api/health` behaviour there unverified. (See the N/A
  note at the end — production has none of these migrations, so there is nothing to observe.)
- Device coverage is high-fidelity **emulation** (viewport, DPR, touch, UA), not physical
  hardware. Real-device quirks remain unverified.
- Memory was profiled over one complete match (~92 actions), not a multi-hour soak. A leak
  that only appears across many sequential matches would not show up at this scale.
- The `next dev` server is unusable over `127.0.0.1` (Next 16 cross-origin restriction);
  `localhost` works. Not a product defect — the production build is unaffected.

## Closed after the environment was restored

- **TC-COMPAT — executed, passes.** Zero horizontal page overflow at 1280×800, 1024×768,
  768×1024 and 390×844 in both themes; the theme flip applies correctly. The board keeps
  its 700 px square and scrolls inside its own wrapper, which is the intended design — this
  corrects a risk the report had flagged. One real defect surfaced: the site header nav
  overflows its container at 768 px (BUG-041, LOW).
- **BUG-036 — withdrawn.** Driven with the correct selectors (`trade-panel`,
  `trade-partner`, `aria-pressed` toggles) the whole flow works: Send offer enables and a
  row is created (`0->1 give={1,3} status=pending`). The original failure was a harness
  artifact. It did leave one real residue: BUG-040, the consent banner intercepting clicks.

## Also closed on the second pass

- **Cross-browser** — Firefox, WebKit and Chromium all complete the core loop with realtime
  sync and zero console errors. An earlier stated reason ("only Chromium is installed") was
  wrong; the browsers were there all along.
- **Trade offers over realtime** — recipient sees the offer in ~1 s, no reload.
- **A full auction in the live UI** — decline → running auction → off-turn player sees it in
  ~1 s → bid accepted → settled → space transferred.
- **Offline / reconnect / rejoin** — nothing corrupted while offline; controls usable ~2 s
  after reconnect with no reload; rejoining restores the seat, not spectator. This also
  positively disproves the withdrawn realtime-recovery finding. One defect found: no
  offline indicator (BUG-042).

## Final pass — every remaining gap closed

- **Load / concurrency — PASS.** 20 simultaneous matches × 60 ops = 1,200 operations in
  1,498 ms, zero deadlocks. Post-load integrity spotless (no negative cash, orphaned
  assets, duplicate ownership or out-of-range positions).
- **Long-session memory — PASS.** A full match profiled: heap 17.1 MB → 13.7 MB and
  listeners 873 → 520, both ending below baseline. A transient 4,900-listener spike
  recovered cleanly; plausibly the same root cause as BUG-037/038.
- **Real device profiles — PASS.** iPhone 13, Pixel 5, iPad gen 7 and Galaxy S9+ with
  genuine touch emulation. Zero overflow on all four. Found BUG-043 (footer/nav links
  ~20 px, under the 24 px minimum — no City control is undersized). This is emulation,
  not physical hardware.

## The one item that is N/A rather than untested

**Production behaviour.** Spintra City is not deployed to production — migrations
0063–0070 were never applied there, so there is no behaviour to observe. Testing it would
require pushing those migrations live, shipping all 4 critical bugs to real users. It
becomes testable once 0071 lands and the feature ships.

## Independent re-verification pass

Every filed bug was re-tested by testers instructed to **falsify** it. Results:

- **3 findings did not survive as filed** — BUG-018 (matches DESIGN §3.1A; the player rolls
  twice but moves once), BUG-027 (premise false: `city_derive_dice`'s algorithm is published
  in the migration, so revoking its grant gives zero benefit — re-filed against seed entropy),
  and half of BUG-019 (`city_max_liquidation` does not leak).
- **5 severity corrections** — BUG-005 CRITICAL→HIGH, BUG-020 and BUG-039 →LOW,
  BUG-034 →MEDIUM, BUG-038 MEDIUM→HIGH.
- **2 understatements** — BUG-008 is worse than filed (six concurrent unauthenticated
  force-settles charged the winner six times, destroying 1,000); BUG-038 is cross-tenant.
- **1 magnitude correction** — BUG-037 measured at 22.9× per mutation, not the filed ~30×.
- **2 new bugs found by the re-verification** — BUG-044 (`city_charge` overwrites
  `pending_debt`, erasing a creditor's claim) and BUG-045 (`city_max_liquidation` returns 0
  via NULL propagation, so bankruptcy checks will bankrupt players who could pay).
- Everything else held, including all four remaining criticals and BUG-010, which was
  proven at runtime rather than by code reading alone.

No fixes have been made — this was a find-and-document pass, per the brief.


---

# FIX PHASE — in progress (resume here)

A regression harness now encodes the release blockers, and three migrations have
landed against the **local** stack only. Nothing has been pushed to production.

## Where the harness stands

    npm run test:city-regression      ->  12 passed, 1 failed, 13 total

| Fixed | By |
|---|---|
| BUG-002 kicked/banned player cannot act | `0071` |
| BUG-008 force-settle not client-reachable | `0071` |
| BUG-009 decline never auctions an owned space | `0071` |
| BUG-010 finished match rejects commands | `0071` |
| BUG-019 net worth / liquidation revoked from clients | `0071` (no harness row) |
| BUG-031 NULL room_code no longer leaks a raw row dump | `0071` (no harness row) |
| BUG-004 a solvent debtor is never deadlocked | `0072` |
| BUG-024 trade cash discharges a debt | `0072` (no harness row) |
| BUG-014 bankruptcy sells developments first | `0072` |
| BUG-045 max liquidation counts a station | `0072` |
| BUG-012 a player cannot inflate their own xp | `0073` |
| BUG-013 health check probes the real realtime endpoint | `src/app/api/health/route.ts` |
| BUG-001 kick strands the match on the departed seat | `0074` |
| BUG-038 two realtime subscriptions are unfiltered | `use-city-match.ts` — extended the existing `matchIdRef` client-side guard to all three tables |
| BUG-044 a second charge erases the first creditor's claim | `0075` — additive `city_debt_queue`, `pending_debt` unchanged for the common case |

## Still red — the next work

| Bug | Where it belongs |
|---|---|
| BUG-003 no client-callable way to resolve a stalled turn | the actual timeout/autopilot cross-cutting slice, not conflated with BUG-001 — this is genuinely a multi-day feature (FR-25 through FR-51), left as its own project |

Also still open and not in the harness: BUG-015/016/017/032 (cards), BUG-020,
025, 026, 027, 028, 029, 030, 033, 034, 035, 037, 039, 040, 041, 042, 043.

## Verification gates used after every migration

1. `npm run test:city-regression` — exactly one row should flip, nothing else.
2. Load: 20 concurrent matches x 60 ops. Baseline ~1500ms with byte-identical
   ok/err counts per match. After `0072`'s cash trigger: 1276ms, counts identical,
   and `debts left payable = 0` across 1,200 operations.
3. Post-load integrity: no negative cash, orphaned assets, or deadlocks.
4. Browser: `npx playwright test --config=playwright.qa.config.ts qa-x3-auction`
   (decline -> auction -> bid -> settle -> transfer).
5. `npm run verify` — note `docs:check` requires every new migration to have a
   row in `ARCHITECTURE.md` §4 and every npm script documented in README too.

## Traps worth remembering

- A trigger `WHEN` clause is evaluated **before** the trigger is entered, so it
  sees `pg_trigger_depth() = 0`, not 1. Guarding with `= 1` silently never fires.
- `check_room_creation_rate_limit` allows 8 rooms per host per 10 minutes. The
  harness creates 8, so each test room now gets its own throwaway host.
- A harness block that raises records no row, which shows up as a smaller total
  rather than a failure. The runner now hard-fails on a short assertion count.
- `CREATE OR REPLACE` cannot remove a parameter default; drop the function first.


## BUG-001 fix (0074) — kick/leave retires the seat

Root cause: nothing reacted to a `room_participants` row disappearing. Fixed
with a trigger on the table itself (not inside `moderation_kick_ban`, so it
covers kicks, bans, and any future leave flow without City-specific logic
leaking into shared moderation code): `city_retire_seat` releases assets to
the bank exactly as `city_bankrupt_seat`'s bank branch already does, marks the
seat `retired`, and — only if it held `current_seat` — hands the turn onward.

**Caught a false green while building this.** `city_retire_seat` matched the
BUG-003 harness regex (`retire`) and Postgres grants new functions PUBLIC
execute by default, so BUG-003 flipped green the moment the function existed
— before any real recovery mechanism was built. Verified it wasn't actually
exploitable (`select city_retire_seat_on_departure()` -> "trigger functions
can only be called as triggers"), then fixed both: revoked the unearned grant,
AND hardened the harness check itself (excluded trigger-returning functions)
so a future `retire`-named trigger can't cause the same false positive again.

## BUG-038 fix — client-side realtime scoping

Did NOT add Realtime's `filter:` option to `city_auctions`/`city_trade_offers`
— a baked-in `match_id=eq.<id>` goes stale the moment a post-match flow opens
a new match in the same room without remounting the hook. Instead extended
the client-side `matchIdRef` guard `city_match_players` already used to all
three tables (extracted as a shared `refetchIfCurrentMatch` callback).

The harness's static check originally grepped for the string `filter:`, which
tested the WRONG property (a proxy, not the actual bug) and would have
false-passed the real fix. Rewrote it to check "is this table's handler still
the bare unguarded `refetch()`" instead, then validated the check both ways
against the actual git history: FAIL on the real pre-fix committed source,
PASS on the fixed source, via a temporary file-swap through the real harness
script (not a reimplementation) to close the loop with certainty.

**Runtime proof, not just source inspection:** two independent live matches in
two different rooms. A trade in match 2 produced 0 REST requests on an idle
match-1 client over a 6s window; that same client's own roll produced 20
requests in the same window. The zero-vs-nonzero pair is the actual proof —
without the "own activity still works" control, a 0 could just as easily mean
the listener broke, not that it's correctly scoped.


## BUG-044 fix (0075) — additive debt queue, not a `pending_debt` rewrite

Mapped the blast radius before touching anything: `pending_debt` /
`pending_creditor_seat` are read or written in 15+ places across eight
migration files, plus four client references. Replacing that column with a
full multi-creditor ledger would have meant recreating nearly all of that
surface in one migration — exactly the unreviewable-mega-migration risk
avoided all session (the same tradeoff already written into 0071's own
header for `city_join_seat`).

Instead: `pending_debt` keeps meaning exactly what it always meant — the one
claim currently due — so all 15+ existing call sites, every
`CITY_SETTLE_DEBT_FIRST` guard, the UI, and 0072's auto-settle-on-cash
trigger keep working completely unmodified. A new `city_debt_queue` table
(server-internal only, RLS on with zero policies/grants, matching
`city_command_attempts`' precedent — no client code reads it) holds any
claim that arrives while one is already outstanding. `city_try_settle_debt`
promotes the oldest queued claim the instant the current one clears, using
`city_charge`'s own current-seat phase rule. `city_bankrupt_seat` and 0074's
`city_retire_seat` both gained a queue cleanup so a terminal seat's stacked
claims are forgiven exactly like its current one.

**Verified the check has genuine discriminating power, not just a fix that
happens to pass.** Rewrote the harness assertion first — the original
version checked `pending_debt >= 90`, which was testing the wrong property
(pending_debt was never designed to hold a sum) and would have been
satisfiable by a design that still lost the second claim. The rewritten
version proves the full loop: both creditors are actually PAID (cash moves),
not merely that a number was recorded somewhere. Then reverted just
`city_charge` to its exact pre-fix body in the live DB, confirmed the new
check correctly FAILs with the precise original defect ("got 40/2" instead
of "50/1", "seat 1 was not paid"), then re-applied 0075 to restore.

Debts three or more deep resolve one settlement event at a time, serially —
narrower than a full ledger, but sufficient to guarantee no claim is ever
silently lost, which is the actual defect BUG-044 named.

## Fix phase status: 13 of 13 blockers closed

    npm run test:city-regression      ->  14 passed, 0 failed, 14 total

## BUG-003 fix (0076) — a scoped escape hatch, not the full FR-25-51 slice

The full turn-clock/autopilot/reconnect-grace mechanism (FR-25 through FR-51)
remains unbuilt, deliberately — per-phase autopilot intelligence, a reconnect
grace period distinct from a stalled clock, bounded sub-clocks per paused
context, and host-selected pace presets are a genuinely multi-day feature and
were never in scope for a "continue" instruction.

What shipped instead is the specific thing the audit's finding named: no
client-callable route existed to resolve a match stalled on a player who is
still in the room but silent (0074 already covers a player who has left the
room entirely). FR-41 names three valid neutral defaults for a clock expiry —
"auto-roll, decline-to-auction, end-turn." `city_claim_timeout` implements
exactly one of them, **end-turn**, uniformly across every phase:

- Re-derives expiry server-side (`turn_started_at + pace_seconds`), never
  trusting the caller (FR-45).
- No debt outstanding: advances to the next active seat, resets the clock —
  identical seat-search to 0074's `city_retire_seat`.
- Debt outstanding: `city_end_turn` already refuses to end a turn while
  `pending_debt > 0`, and there is no "skip a debt" mechanism to invent one
  here, so it routes through the same bankruptcy path
  `city_declare_bankruptcy` already uses.
- Auction phase or an explicit pause: refused outright
  (`CITY_TURN_CLOCK_PAUSED`) — auctions already have their own clock and
  settle path.
- A non-member is refused for free, by the same `city_rate_limit_check`
  chokepoint 0071 already put in front of every command — zero new code
  needed for that guard.

Deliberately NOT built: auto-rolling dice on the stalled player's behalf
(deriving RNG and resolving landing/cards/rent under someone else's identity
is materially riskier than end-turn), and force-opening an auction for a
lapsed purchase decision (the space just stays unowned for the next visitor).
Both are honest, disclosed scope reductions — not oversights — and FR-41's
own wording treats end-turn as an equally valid default, not a fallback.

**Verification.** The static harness check (does a client-callable
timeout/retire/abandon routine exist) only proves the function exists and is
granted — for the riskiest fix of the whole session, that alone wasn't
enough. Ran five hand-written behavioral proofs covering all four branches:
premature claim (refused, `CITY_TURN_CLOCK_STILL_RUNNING`), genuine no-debt
expiry (turn advanced correctly, new seat could immediately act), genuine
debt-triggered expiry (routed to bankruptcy, creditor paid exactly what the
debtor actually had — confirming `city_bankrupt_seat`'s existing payout
semantics, not something this fix changed), the auction/pause guard, and a
non-member. Then promoted the two most safety-critical properties (never
fires early; resolves correctly once genuinely expired) into the permanent
harness as a new behavioral assertion — and, matching the discipline applied
to every fix this session, deliberately broke the deadline check in a
throwaway copy of the function first and confirmed the new assertion
genuinely failed against it before trusting it passing the real fix.

**The gap that mattered most: nobody's client called the new RPC.** After
0076 shipped and every SQL-layer proof passed, a check of the client source
turned up zero references to `city_claim_timeout` anywhere in
`src/app/room/[code]/city/`. The server-side fix was complete and verified,
but a real player would have seen exactly the same broken experience the
audit described — no button, no way to trigger it — because nothing in the
UI ever called it. A correct RPC nobody can reach fixes nothing for an actual
player.

Closed by mirroring `city-auction.tsx`'s own established pattern exactly
(auto-settle: any client, once its local clock says the deadline has passed,
fires the RPC itself; the server re-derives authority, so an early or
duplicate attempt is just a harmless refusal): a `useEffect` in
`city-match-shell.tsx` computes `turn_started_at + pace_seconds` from the
match row and calls `claimTimeout()` once it has genuinely elapsed — for
every client watching the match, including the stalled player's own tab, if
merely idle. `turn_clock_paused_at` and `turn_number` had to be added to the
client's `CityMatch` type and select list (both were already grant-selectable
server-side, just never fetched) so the effect can tell an auction pause from
a genuine stall, and de-duplicate per turn.

This also required regenerating `src/lib/supabase/database.types.ts` (the
old file predates all six migrations, so `city_claim_timeout` didn't
type-check) — diffed against git first to confirm the regeneration touched
only the new/changed schema and nothing else.

**Verified as an actual player would experience it**, not just at the RPC
layer: two live browser contexts, a real match, seat 1 forced to stall
(`current_seat=1`, clock backdated past `pace_seconds`) — and then genuinely
nobody clicks anything on either page for the rest of the test. Six seconds
later the match had recovered on its own (`current_seat` back to 0,
`turn_number` incremented), with zero manual action from anyone. That is the
actual proof BUG-003 is fixed, not the SQL-layer one.

## All fixes, final state

Migrations 0071-0076 plus two direct source fixes (health route probe path,
realtime subscription scoping) are all local-only, each individually verified
against the 20-match concurrent load gate, post-load integrity, and (where
relevant) a live two-browser proof. Every migration re-applies idempotently.
`npm run verify` is green. Nothing has touched production.

## ROUND 2 — closing BUG-005, 011, 023, 029 (migration 0077)

With all 13 release blockers closed and committed, moved on to the 28 open
non-blocking bugs rather than stopping. Read the actual current SQL for every
function involved before writing anything (`city_assert_can_manage`,
`city_charge`, `city_accept_trade`, `city_propose_trade`) and cross-checked
each proposed fix against `docs/SPINTRA_CITY_DESIGN.md` §3.1D/E before touching
code — this caught two things that would have been wrong fixes:

- **city_charge does not need to change for BUG-005.** It already sets
  `pending_debt` unconditionally regardless of whose turn it is; only the
  *phase* forcing is (correctly) gated on `current_seat = p_seat`, because
  phase is a single match-wide column and forcing it for an off-turn charge
  would corrupt whoever's turn it actually is. The real root cause is entirely
  in `city_assert_can_manage`, the shared gate behind build/sell/mortgage/
  unmortgage/bankruptcy, which required `current_seat` unconditionally.
- **`city_build` and `city_unmortgage` must NOT get the off-turn debt bypass.**
  Both already have their own `CITY_SETTLE_DEBT_FIRST` guards blocking a
  debtor outright — building is not a raise-funds action (DESIGN §3.1D lists
  only sell/mortgage/trade), and unmortgaging *costs* cash, the opposite of
  raising it. Giving all five gated actions the same bypass would have been
  over-broad; only `city_sell_building`, `city_mortgage` and
  `city_declare_bankruptcy` get `p_allow_off_turn_debt => true`.
- **BUG-029's `required_decision` block applies to `city_build` only.**
  `required_decision` is *how* a debtor resolves a debt (buy/decline,
  raise-funds, detention-exit are its three legal occupants per DESIGN §3.1A)
  — blocking sell/mortgage/bankruptcy there would have silently reintroduced
  BUG-005. Only `city_build` (not a raise-funds action) gets
  `p_block_required_decision => true`. The auction-phase block, by contrast,
  applies unconditionally to all five — DESIGN §3.1E calls auction "a global
  match phase," and the audit's own finding named auction explicitly.
- **BUG-011's fix is a threshold, not a ban.** DESIGN §3.1D lists trade
  alongside sell/mortgage as a legitimate raise-funds path, so refusing every
  trade while in debt would reintroduce BUG-005 for that one path. Instead
  `city_accept_trade` now refuses an accepting debtor unless
  `cash + give_cash - get_cash >= pending_debt` — the trade must actually
  clear the debt, not just move some cash. A trade differs from sell/mortgage
  in one way that matters: it can hand property equity to an unrelated third
  party rather than keeping it with the debtor, which is what makes a
  *partial* debt-trade dangerous in a way partial mortgaging isn't.
- **BUG-023 has no fix to verify behaviorally.** `city_accept_trade` tried to
  mark a lapsed offer `'expired'` then `raise exception 'CITY_OFFER_EXPIRED'`
  in the same statement. Any exception anywhere later in a single top-level
  call rolls back *everything* in that call, regardless of statement order —
  there is no partial-commit-then-continue in a plain SQL function without a
  procedure/dblink/background-worker, which would be wildly disproportionate
  here. That means the update was *never once going to persist*, before this
  fix or after it. The fix removes the doomed statement; the caller-visible
  behavior (refused with `CITY_OFFER_EXPIRED`, offer stays `pending`) is
  bit-for-bit identical either way. Recognized this before writing a
  regression check for it, rather than after — writing one anyway just to
  have a number would have been exactly the kind of decorative check §1a's
  re-verification pass exists to catch, so it's documented as verified by
  code reading instead.

**First `db reset` attempt hit an unrelated, pre-existing local-stack issue,**
not a regression from this work: the local Postgres role `postgres` lacked
membership in `supabase_realtime_admin`, so migration `0036` (from long before
this session, `alter table realtime.messages enable row level security`)
failed with `must be owner of table messages` — `postgres` isn't superuser
here, only `supabase_admin` is. A backup snapshot `supabase start` restored
from turned out to be stale (only through migration 0035), so `db reset` was
replaying the entire chain from scratch and hit this on the way. Rather than
patch the role setup (wiped on every `db reset` anyway, since that reseeds
`roles.sql` fresh), applied migrations 0036-0077 directly via
`psql -U supabase_admin` (genuinely superuser, sidesteps the ownership issue)
against the already-running container, then backfilled
`supabase_migrations.schema_migrations` so the CLI's own bookkeeping matches
reality. All 42 files applied clean, in order, no errors.

**Verification:** wrote 3 new regression-harness blocks (BUG-005, BUG-011,
BUG-029 — not BUG-023, per above). First draft of the BUG-005 check asserted
"cash increased after mortgaging," which was itself wrong and caught
immediately: the existing 0072 auto-settle-on-cash trigger fires inside the
same call once the raised cash covers the debt, so cash goes 10 -> 37 (raised)
-> 2 (37 minus the 35 debt just paid) in one atomic sequence — a real
decrease from the starting 10, not an increase, even though the fix worked
correctly. Rewrote the assertion to check the actual invariant that matters
(`pending_debt` reaches 0, creditor is paid the full 35) rather than an
intermediate cash figure, which is a stronger and more honest proof anyway —
it demonstrates BUG-005's fix and BUG-024's trigger composing correctly in
one sequence, not just that the RPC call stopped raising an error. Full suite:
17/17 (14 pre-existing + 3 new). `0077` re-applied a second time is a clean
no-op with the harness still 17/17. `npm run verify` (typecheck, lint,
docs:check) is green; `docs/ARCHITECTURE.md` §4 gained a 0077 row and the
`0063–0076` → `0063–0077` status-line update `docs:check` requires whenever a
new migration file lands.

No client-side or public RPC signatures changed (`city_build`,
`city_sell_building`, `city_mortgage`, `city_declare_bankruptcy`,
`city_accept_trade` all keep their exact original argument lists — only their
internal call into `city_assert_can_manage` gained new named arguments, and
that function is `revoke`d from clients already), so `database.types.ts` did
not need regenerating this round.

Nothing has touched production. `supabase/migrations/0077_*.sql` is local-only,
same as 0063-0076.

## ROUND 3 — closing BUG-021, 025, 026, 027 (migration 0078)

Continued straight on to the RLS/grants hardening group with the user's
standing "keep going, be careful" instruction. This session's Docker Desktop
issue recurred mid-round (the daemon stopped between rounds 2 and 3); restarted
it via PowerShell, waited for `supabase_db_Spintra-1` to report healthy, then
resumed — same recovery pattern used earlier in this session.

Read the actual current RLS policies and grants before writing anything,
rather than assuming the audit's description was still accurate:

- **city_matches and city_match_players (0063) already do this correctly.**
  `city_matches_select` uses `is_member_of_room(room_code, auth.uid()::text)`;
  `city_match_players_select` joins through `city_matches` to reach the same
  check. BUG-025's three tables (`city_assets`, `city_auctions`,
  `city_trade_offers`) were simply never brought in line with a pattern that
  already existed twice in the same codebase — copied the exact shape, not
  redesigned. `city_assets`' own 0064 comment even states the intended rule
  ("public *within a match*") that the `using (true)` policy failed to
  implement.
- **Found the root cause of BUG-026 by reading migration 0031**, not by
  guessing: `alter default privileges in schema public grant select, insert,
  update, delete on tables to anon, authenticated` — added there to fix a
  real CI failure (a from-scratch `db reset` rejected every insert with
  "permission denied", because Supabase's hosted dashboard applies default
  grants automatically that a from-scratch local replay never captures).
  Every table created after 0031 inherits full DML grants automatically
  unless something later explicitly revokes them. `city_assets`/
  `city_board_spaces` (0064) and `city_auctions` (0069) did; `city_matches`/
  `city_match_players` never did. Confirmed today's actual exploitability
  first (`\d` showing zero write policies on either table, meaning RLS
  currently denies every write regardless of the grant) before writing the
  fix, so the migration comment doesn't overstate a currently-inert gap as
  live-exploitable.
- **BUG-021 fix is one line** (`alter view ... set (security_invoker =
  true)`, Postgres 15+) precisely because BUG-025's fix already put correct
  RLS on the underlying tables the view joins — the view had nothing of its
  own to get wrong, it just needed to stop bypassing what's underneath it.
- **BUG-027's actual fix target changed during re-verification**, and the
  report already documented this (§1a): the original claim was that
  `city_derive_dice`'s EXECUTE grant was the risk; re-verification found that
  false (the algorithm is published verbatim in migration 0064's own source,
  reimplemented byte-for-byte in 6 lines of Node with identical output —
  revoking the grant gives zero benefit) and re-filed the bug against seed
  entropy instead. Confirmed `pgcrypto` was already enabled locally before
  committing to `gen_random_bytes` as the fix (`select extname from
  pg_extension` — it was), then confirmed the hex-to-`bit(64)`-to-`bigint`
  cast idiom actually produces well-formed bigints by running it directly
  against the live DB first, and separately confirmed `gen_random_bytes`
  needed schema-qualifying as `extensions.gen_random_bytes` (its actual
  schema — `select nspname from pg_proc/pg_namespace` — since
  `city_create_match` runs `set search_path = public`, which excludes it) by
  testing the unqualified call first and watching it fail exactly as
  predicted, then confirming the qualified version succeeds.

**Verification:** wrote 4 new regression-harness blocks (BUG-021, 025, 026,
027), reusing the exact `set_config('role', 'authenticated', true)` +
`request.jwt.claims` GUC technique the existing BUG-012 check already used —
this is genuinely how PostgREST enforces RLS per request (`SET LOCAL ROLE` +
`SET LOCAL request.jwt.claims`), not an approximation. Caught a third
false-positive-in-waiting before trusting the suite: BUG-025's first draft
checked that a genuine room member could still read `city_assets` for their
own match as a positive control, but a freshly-started match via `rg_match`
owns no properties yet — `city_assets` was empty for the member AND the
outsider alike, so the "member still sees it" check would have trivially
"passed" for the wrong reason regardless of whether the RLS fix worked at
all. Fixed by seeding a real owned asset (and a running auction, and a
pending trade offer, inserted directly as postgres) before asserting
visibility, so all three tables have a genuine row to hide. Full suite:
21/21 (17 pre-existing + 4 new). `0078` re-applied a second time is a clean
no-op with the harness still 21/21. `npm run verify` is green; caught and
fixed a stray blank line in `docs/ARCHITECTURE.md`'s migrations table (it
split the table into two chunks for `check-docs-drift.mjs`'s regex, which
only scans up to the first blank line) before it would have masked a real
future drift.

No client-facing signature changed here either — `city_create_match` keeps
its exact original parameter list, and RLS policies/grants/view storage
parameters aren't part of `database.types.ts` at all — so no regeneration
needed this round.

Nothing has touched production. `supabase/migrations/0078_*.sql` is
local-only, same as every migration before it.

## ROUND 4 — closing BUG-015, 016, 017, 032 (migration 0079), plus a
## self-introduced-and-self-caught regression (migration 0080)

Picked the card/deck logic group next — the audit's own §17 named BUG-016/017
"the most player-visible" of what remained, and it's self-contained in
`city_draw_card`/`city_apply_card`/`city_resolve_landing`/`city_roll_dice`,
all in one migration (0068) — matching the same read-first discipline as
every prior round.

**Root-cause tracing, before writing anything:**
- BUG-017/032 share one cause. `city_apply_card`'s advance_to/advance_nearest
  branch pre-scaled the *dice total* fed into `city_resolve_landing` by the
  card's `rent_multiplier`. Property rent reads `city_board_spaces.rent[]`;
  airport rent is a fixed 30/60/120/240 table — neither ever looks at the
  dice total, only utilities do (`dice_total * 5-or-12`). So cards 2/3
  ("double rent" landing on a property/airport) silently multiplied a number
  nothing downstream reads, while card 10 ("ten times your roll" landing on
  a utility) multiplied the ONE thing that *is* read, compounding with
  utility rent's own 5x/12x into 10x or 24x depending on holdings — never
  the flat 10x CONTENT.md §7 states outright with no qualifier.
- BUG-015: `city_roll_dice` decides the next phase by inspecting the shape
  of its own `v_landing` value, but its two checks
  (`v_landing->>'action'` for a direct landing, `v_landing->'result'->
  'landing'->>'action'` for a card that itself triggers a nested landing)
  never covered a card that charges the drawing player *directly* — 'pay'
  and 'per_building', which return `city_charge`'s own result merged in at
  `result.action`. `city_charge` had already correctly set
  `phase='required_decision'` moments earlier as a side effect of computing
  that same `v_landing`; `city_roll_dice`'s own later, unconditional phase
  UPDATE then silently overwrote it back to `optional_actions`.
- BUG-016: `city_draw_card`'s per-round permutation excluded the held Transit
  Visa from its own size count, so the round boundary and draw position both
  drifted the moment the visa's held status changed mid-round.

**Two real mistakes caught in my own draft before it ever ran**, both from
actually verifying rather than trusting the design on paper:

1. Transcribing `city_roll_dice`'s full body by hand for the CREATE OR
   REPLACE, the return statement's field names got typo'd
   (`passed_departure` → `passed_start`) and the `salary` field was dropped
   entirely — caught by re-reading the *original* function's tail (which the
   first read had stopped short of) side by side with the draft before
   applying anything. Would have silently broken the client's salary/passed-
   Departure display had it shipped.
2. First implementation attempt for BUG-016 kept the round size fixed but
   re-derived draw position via `(draw % size) % eligible_count` against a
   filtered card list. Worked through a concrete example by hand (seed with
   the visa's permutation slot at position 5, held starting at draw 9) before
   trusting it: the shrinking modulo denominator reindexes *every* position
   after the excluded one, not just the excluded one itself, and that
   reindexing walked straight past position 6, never drawing it across the
   whole round. Discarded before it was ever applied. Replaced with a
   different approach — compute the round's full fixed-size permutation once
   regardless of visa status, and only substitute the *next* slot in that
   same order if the drawn slot itself is the currently-held visa. Hand-
   traced this one too, across three sub-cases (visa's slot already passed
   this round / visa held coming into a fresh round, substitution mid-chain)
   before trusting it: guarantees no card is ever skipped, with the sole
   disclosed residual being one card drawn twice in the rare case the visa
   was already held before the round started.

**A third mistake, caught by the regression harness itself, not by review:**
BUG-015's first test picked seat 0's starting position (38) so a known dice
roll would land on a card space at idx 2 — but 38+4 wraps past Departure,
paying a 200-Spin salary *as part of the same roll*, before the card's 75-
Spin charge is even evaluated, silently making it affordable and producing
`phase=optional_actions, pending_debt=0` — a result that looks like "nothing
happened" rather than "the test's own setup was wrong." Read the actual
`city_roll_dice` return payload (`"salary": 200, "passed_departure": true`)
instead of just re-checking the phase column, found the real cause in under
a minute, and re-picked a landing position (18 → 22, +4, no wrap) that
isolates the property under test.

**A fourth, more serious issue — found by literally the next thing checked,
not by luck:** after applying 0079, ran the same overload-privilege query
this session had already used once (for BUG-003's grant-hygiene false
positive in round 1) as a sanity habit, and it caught something real:
`city_resolve_landing` now had *two* `pg_proc` entries — the original 4-arg
one (correctly revoked, from 0065) and a new 6-arg one (from 0079's own
`CREATE OR REPLACE ... p_rent_multiplier ..., p_flat_rent_multiplier ...`),
and the new one was executable by `authenticated`. Postgres does not edit a
function in place when `CREATE OR REPLACE` adds parameters, even trailing
defaulted ones — it creates a genuinely new, separately-OID'd overload,
because overload identity is the full declared parameter list, not just the
required prefix. The new function is then a function Postgres just created
from scratch, and Postgres grants EXECUTE to PUBLIC on function creation by
default. Immediately checked whether round 2's `city_assert_can_manage`
extension (0077, same technique — two new defaulted params) had the exact
same problem: it did. Confirmed both were genuinely reachable-and-dangerous,
not theoretical — `city_resolve_landing` performs no `auth.uid()` check of
its own (by design; it trusts an already-authenticated, already-locked
caller like `city_roll_dice`), so a client reaching its new 6-arg overload
directly could charge or credit any amount to any seat via an attacker-
chosen rent multiplier, with none of `city_roll_dice`'s turn/lock/rate-limit
checks in the way. Fixed immediately in a dedicated migration (0080): drop
both now-dead old-signature overloads outright, explicitly revoke both new
ones. Ran a full sweep (`select proname, count(*) ... group by proname
having count(*) > 1`) across every `city_*` function to confirm these were
the only two instances of the pattern — `city_settle_auction`'s own two
overloads are a different, already-correct shape from round 1 (0071): the
*shorter* wrapper is the deliberately client-callable one, the *longer*
`p_force` form is deliberately revoked, the opposite of the bug's shape.
Added a general regression-harness assertion (`META-OVERLOAD-GRANTS`, not
tied to a single audit bug number) that sweeps the whole `city_*` surface
for this exact shape going forward, specifically so any *future* migration
that extends a helper's parameter list the same way fails the suite
immediately instead of shipping quietly a third time.

This is the one genuinely self-introduced regression across all four
rounds — worth being direct about rather than folding quietly into "0080
also does some cleanup": migration 0077's own commit message and
`ARCHITECTURE.md` entry describe it as fully closing BUG-005/011/023/029,
which was true for those bugs' own behavior, but did not mention the
overload it silently left behind, because that gap wasn't found until this
round. `QA_REPORT.md`/`.html` now call this out explicitly in §1b rather
than leaving it implicit in a migration's own commit history.

**Verification:** wrote 4 new regression-harness blocks (BUG-015, 016, 017,
032) plus the general `META-OVERLOAD-GRANTS` check. Did a live discriminating
check for BUG-015 specifically (temporarily reverted just `city_roll_dice`'s
phase-decision `case` expression to the pre-fix two-branch version, confirmed
the harness goes red with the exact `pending_debt=75, phase=optional_actions`
signature the audit described, then restored the fix and confirmed green
again) — the same discipline round 1 established for BUG-003/044. Full
suite: 26/26 (21 pre-existing + 4 new + 1 meta). `0079` and `0080` both
re-apply a second time as clean no-ops with the harness unchanged.
`npm run verify` is green; caught the exact same stray-blank-line
`ARCHITECTURE.md` mistake from round 3 a second time before it could mask
future drift — the check is regex-based (`### Migrations Applied\n
([\s\S]*?)\n\n`) and stops at the first blank line, so a table split across
two chunks silently loses everything after the break.

No client-facing signature changed — `city_apply_card`/`city_resolve_landing`
were already revoked from clients before this round (only their *internal*
call shape changed) and no public RPC's argument list changed, so no
`database.types.ts` regeneration needed.

Nothing has touched production. `supabase/migrations/0079_*.sql` and
`0080_*.sql` are both local-only, same as every migration before them.

## Fix phase running total (rounds 1-4)

28 of 44 bugs fixed: 4 Critical, 9 of 13 High, 9 of 12 Medium, 6 of 15 Low.
16 remain open, headlined by BUG-007 (the 20 MUST-requirement disconnect/
autopilot/turn-clock slice — explicitly out of scope as multi-day work, not
an oversight) plus the economy correctness bugs (028/030), the room/
spectator gaps (022/033), and the client-side polish items
(034/035/037/039/040/041/042/043). Regression harness: 26/26 (including one
general, non-audit-numbered check — `META-OVERLOAD-GRANTS` — added after
this round's own self-introduced-and-self-caught overload-grant regression).
`npm run verify`: green. Nothing has touched production.

## ROUND 5 — closing BUG-035 (migration 0081), and a second self-introduced
## grant gap caught live

User confirmed "yes" to continuing into the client-side polish group. Started
with BUG-035 since it required a small server-side change (persisting the
roll outcome) before any client work could show it off-turn.

Read `use-city-match.ts` and `city-match-shell.tsx` in full via a research
agent before deciding an approach, rather than guessing at the client
architecture. Confirmed: `lastRoll` is pure client React state, set directly
from `city_roll_dice`'s own RPC return value, never read from
`city_matches.last_roll` (which only ever held the bare two-die array) and
never broadcast — so nobody but the roller's own tab, in the same turn,
before their next refresh, ever saw the narration sentence. Considered two
fixes: (a) client-side realtime broadcast of the roll result to other
clients, or (b) persist the full result server-side and let it ride the
existing `city_matches` postgres_changes subscription every client already
has. Chose (b): it also fixes a second problem the research surfaced that
wasn't in the audit at all — the roller's own narration vanishing on their
*own* refresh mid-turn — and needs no new realtime channel or broadcast
authorization pattern. Staleness is derived by comparing a new
`last_roll_turn` column to `turn_number`, the same pattern
`city_trade_offers.created_turn` already uses — confirmed every turn-
advancing path (`city_end_turn`, `city_retire_seat`, `city_claim_timeout`)
increments `turn_number`, so no explicit clearing was needed.

**Caught live, not in review, the second instance of a grant-hygiene mistake
this fix phase has now made:** applied 0081, then ran the actual app in a
browser to open a match — got `42501 permission denied for table
city_matches` the instant the client's select list included the new column.
`city_matches` has been column-grant-restricted since migration 0063 (an
explicit allowlist, not a blanket table grant, precisely so
`rng_seed`/`rng_counter` stay unreachable via PostgREST) — a newly added
column is invisible to `anon`/`authenticated` until it's explicitly added to
that allowlist too, and PostgREST denies the *entire* query if even one
requested column lacks a grant. Unlike round 4's overload-grant regression
(caught by habitually re-running a privilege-audit query, not by symptom),
this one was caught by literally trying to use the feature and reading the
actual error — a reminder that "did I remember the grant" needs checking for
*every* kind of schema change this session has made (new function overloads,
and now new columns), not just the one shape already burned once. Fixed
directly in 0081 (not yet committed at the time this was found), rather than
a follow-up migration, since editing an in-progress uncommitted file is not
the same thing as editing history.

Verified end-to-end in a real two-browser Playwright run against a real
production build of the app (not just the SQL regression harness, which
doesn't exercise column-grant enforcement the way PostgREST does): the
off-turn guest's status line read the full narration ("Rolled 3 and 1, moved
to Sydney. It's unclaimed — buy it for 235, or pass."), not "Waiting for
Host". `npm run verify` green.

## ROUND 6 — the client-side polish group (BUG-034, 037, 039, 040, 041, 042,
## 043; plus a client-side gap in round 2's own BUG-005 fix)

Continued straight through into the remaining client-side items, using a
research agent first to locate every relevant file (the cookie-consent
banner, the site header nav, the footer, any existing offline/reconnect
pattern, the status-line logic, the narration gating, every `refetch()` call
site, and the holdings buttons' disabled logic) before touching anything —
the same read-first discipline as every SQL round, just aimed at React/CSS
instead.

**BUG-034** (status text ignoring server phase): extended the same status-
line ternary already touched for BUG-035's `effectiveRoll` fallback with two
more phase-aware branches — an explicit `isMyTurn && inDebt` message (there
wasn't one at all before, a related gap the research surfaced: a debtor on
their own turn saw "your turn — roll the dice" with no mention of the debt
blocking that exact roll) and a `match.phase === 'awaiting_roll'` check
before falling back to the "roll the dice" text, so a post-roll refresh
correctly shows "you've rolled — build, trade, or end your turn" instead.

**BUG-037** (no refetch debounce): added a coalescing wrapper around the
hook's `refetch` — concurrent calls within an 80ms window share one
in-flight fetch, with every caller's own `await` resolving once it actually
completes. Deliberately not a leading-edge throttle (which would risk
dropping a solo action's own update) or a long window (which would make
every single action feel laggy) — 80ms is comfortably longer than same-
transaction realtime events arrive apart, comfortably shorter than
perceptible latency.

**BUG-040** (cookie banner overlap): root-caused to the banner having *no*
max-width below the `sm:` (640px) breakpoint at all — `left-4 right-4` alone
gives a ~700px+ box at tablet-ish widths, while `sm:`+ already had a compact
`max-w-md` corner-card treatment. Extended the same compact treatment
downward (`max-w-sm` + `ml-auto` to hug the right edge) rather than
redesigning the banner. First test draft checked a 390px phone viewport and
failed — worked out by hand that 390px was never actually the problem width
(edge-to-edge on a real phone is close to unavoidable and not what the audit
reproduced); re-scoped the check to 600px, just below `sm:`, where the fix
actually changes anything (736px-equivalent arithmetic → 384px, confirmed
live).

**BUG-041** (nav overflow at 768×1024): traced to the desktop pill nav (logo
+ 4 center buttons + right icons) not fitting inside its own
`overflow-hidden` panel at exactly the `md:` breakpoint (768px) where it
first turns on. Raised every toggle controlling that reveal (4 occurrences
in `navbar.tsx`) from `md:` to `lg:` (1024px) rather than trying to squeeze
the existing spacing into 768px — the mobile hamburger menu was already
correct at every width per the research, so it now simply covers the gap.

**BUG-042** (no offline indicator): found `ConnectionBanner` already fully
built and exported but never imported anywhere in the codebase — reused it
rather than building a new one. Added the missing `.subscribe((status) =>
...)` status callback to City's own realtime channel (it had none at all),
mirroring `use-room-subscription.ts`'s proven SUBSCRIBED/else handling and
20s reconnecting→offline escalation, since City's channel is genuinely
separate from the room's base chat/participants channel and can drop
independently.

**BUG-043** (footer tap targets): `inline-flex items-center py-2` on each of
the 5 footer links in `page.tsx` — no shared `<Footer>` component exists in
this codebase, confirmed via the research pass, so this is the only place
it needed fixing.

**BUG-039 plus a related gap it wasn't originally about:** while wiring up
the disabled-reason tooltips (`city-holdings.tsx`), noticed the Sell and
Mortgage buttons still had `disabled={!isMyTurn}` with no debt exception —
but round 2's BUG-005 fix (0077) specifically gave the *server* an
off-turn-debt bypass for exactly these two actions. The client was never
updated to match, meaning BUG-005's fix was real but practically invisible:
an off-turn debtor still couldn't click anything to raise funds, even though
the RPC would now accept it. Fixed the disabled conditions to
`!isMyTurn && !inDebt` for Sell/Mortgage specifically (Build and Unmortgage
correctly stay `!isMyTurn`-only, matching that they never got the server-
side bypass either), and added the explanatory tooltips BUG-039 actually
asked for. This is not itself one of the 44 audit-numbered bugs — it's a
client-side completion of an already-"fixed" bug — documented as such rather
than folded silently into BUG-039's own entry.

### A testing-infrastructure incident during this round's live verification

Building the app for browser verification (`npm run build`, bare, no env
override) and starting it revealed `type=city` room creation failing with
`rooms_type_check` violated — but a direct SQL insert of the identical value
succeeded immediately. Spent real effort chasing this as if it were a
caching bug: restarted PostgREST, restarted Kong, restarted Postgres itself,
enabled full statement logging, checked for duplicate constraints/tables,
checked column-level grants, checked `pg_stat_statements` for the literal
query PostgREST sent — all consistent with the constraint being correct and
the request being well-formed. The actual cause, found by capturing the
browser's real request headers instead of continuing to guess: the
Authorization JWT and API key were both issued by the **real, hosted
production Supabase project** (`qjxaehxwuqntyqrdmihs.supabase.co`), not the
local Docker stack. `.env.local` has pointed at production the entire time
(unmodified since July, for normal day-to-day local development against
live data) — `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are inlined into the
client bundle at *build* time, not read at runtime, so an env-var override
has to be supplied to `npm run build` itself, not to `next start`. Every
earlier round's browser verification this session supplied that override
(matching this repo's own documented CI pattern: extract
`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` from `npx supabase status -o env` and
pass them to the build) — this round's first rebuild, after the client-side
edits, was issued as a bare `npm run build` and silently baked in the
production URL instead.

**Impact, assessed directly rather than assumed:** every room-creation
attempt during the confused debugging window failed at the database level,
because production's `rooms_type_check` constraint predates the City
feature entirely and has no `'city'` value — the same protection this whole
session has relied on to guarantee production stays untouched held here too,
just from an unexpected angle. No room, match, or City game data of any kind
reached production. The one real, if minor, consequence: each attempt's
anonymous-sign-in step very likely succeeded against production's real Auth
service before the room insert failed, so a handful of throwaway anonymous
Supabase Auth sessions were probably created there — harmless, no PII, no
associated data, but a genuine unintended write to a live system this
session is explicitly never supposed to touch.

**Corrected immediately:** rebuilt with `NEXT_PUBLIC_SUPABASE_URL=http://
127.0.0.1:54321` and the local anon key (from `npx supabase status -o env`)
explicitly set, confirmed via `grep -rl "127.0.0.1:54321" .next/static/
chunks/*.js` (present) and `grep -rl "qjxaehxwuqntyqrdmihs" .next/static/
chunks/*.js` (zero matches) *before* resuming any further browser testing.
All subsequent live verification this round (the full `qa-x9-client-polish
.spec.ts` suite, the tooltip/off-turn-debt check) ran against the correctly-
scoped local build. Did not attempt any cleanup on production — deciding
whether a handful of orphaned anonymous accounts are worth acting on is the
user's call, not something to unilaterally act on. Reported in full in
`QA_REPORT.md`/`.html` and directly to the user, rather than treated as a
solved problem to move past quietly.

**Verification for this round overall:** typecheck/lint green after every
edit. Live browser verification via `tests/qa-x9-client-polish.spec.ts`
(kept in the repo): nav non-overflow at 768×1024, footer tap-target heights,
cookie-banner width at 600px, and a full two-browser match (status text
through `awaiting_roll` → rolled → refreshed, off-turn narration) — all
against the correctly-rebuilt local-stack build. A separate throwaway script
confirmed the off-turn-debt Mortgage button is genuinely clickable (not just
visually different) and that an enabled button correctly carries no
tooltip. `npm run test:city-regression`: 26/26 (unchanged — none of this
round's fixes are SQL-testable; round 5's BUG-035 fix is the last one that
touched the database). `npm run verify`: green throughout. Nothing has
touched production, aside from the incident above, which involved no
deliberate action and no code or migration of any kind.

## Fix phase running total (rounds 1-6) — CORRECTION, see round 7 below

36 of 44 bugs fixed: 4 Critical, 11 of 13 High, ~~12 of 12 Medium (all
closed)~~, 10 of 15 Low. This Medium figure was wrong the moment it was
written — BUG-022 (Medium) was not touched in round 6 at all, so the true
state at the end of round 6 was **11 of 12 Medium fixed, 1 unresolved**.
Caught while computing round 7's own numbers (below), not at the time.
8 remained open: BUG-007 (still explicitly out of scope as multi-day work),
BUG-006 (partially addressed as a side effect of BUG-003, no visible
countdown), the economy correctness pair BUG-028/030, the spectator gaps
BUG-022/033, and BUG-018/020 (re-verification concluded neither is an
actual defect — no code change was ever warranted for either). Regression
harness: 26/26. `npm run verify`: green. Nothing has touched production.

## ROUND 7 — closing BUG-022, 030 and the pace_seconds half of BUG-033
## (migration 0082), plus correcting BUG-028 and round 6's own Medium count

User said "what next?" a third time; recommended and proceeded directly
into the last batch of real, actionable bugs: BUG-028 (building supply
never enforced), BUG-030 (mortgage rounding), BUG-022 (spectator capacity),
BUG-033 (spectator conversion + host-settable pace). That leaves only
BUG-007 (still out of scope) and the two confirmed non-defects (018/020)
once this round lands.

**BUG-028 turned out not to need a fix at all — checked DESIGN.md before
writing any code, not after.** §3.2B states, in so many words, "Decision:
unlimited buildings in v1," with the nullable `building_supply_limit`
column explicitly disclosed as schema-only groundwork for a *future*,
deliberate scarcity decision ("needs a deliberate call, not a default").
Grepped the whole client tree for the column name: zero references outside
the auto-generated types file — no path, anywhere, ever sets it away from
`NULL`. The audit's own repro required manually writing a non-null value
directly into the database, a state no real game reaches. This is the exact
shape of correction §1a's independent re-verification pass already made for
BUG-018/020/027 — a real, reproducible behavior, but not a defect relative
to what the project actually decided to ship. Recorded as a report
correction; no migration written for it.

**BUG-030:** read CONTENT.md's own wording ("mortgage value is 50% of the
listed price") before picking a rounding rule — it states no direction, so
`round()` (nearest) was the least-biased choice for the mortgage payout.
Checking `city_unmortgage` for consistency surfaced a second, compounding
instance of the *same* bug the audit only named for mortgage: its own
`ceil((price / 2) * 1.1)` computed `price / 2` as integer division too, so
the 10% interest was already being calculated on a truncated base (Porto:
`ceil(27 * 1.1)` = 30, not the mathematically correct `ceil(27.5 * 1.1)` =
31). Both now divide as `numeric` before their respective rounding step.

**BUG-022 — a real design mistake caught by hand-tracing before it was ever
applied, not by symptom.** First instinct: change the room-capacity trigger
to count only already-*seated* existing participants against the cap,
reasoning that spectators shouldn't count. Traced through a concrete
scenario by hand before running it: the trigger fires when someone joins
the *room*, before they've taken a city seat at all (seating is a separate,
later RPC) — so it can only ever inspect *existing* members' seated status,
never the joining person's own future intent. A room already holding "2
seated players" at a 2-capacity limit would still reject a 3rd, purely-
spectating joiner exactly as before the fix — the exact bug FR-38 exists to
close, reproduced by my own first draft. Re-read FR-38's actual wording
("spectators need to bypass the capacity check") and realized the fix isn't
narrower counting at all: for `type = 'city'` rooms, room-level capacity
has no remaining job to do, full stop — match seats already carry their
own, independent 8-seat cap. Simplified to that before ever applying
anything.

**BUG-033, pace half:** `city_create_match` already had three defaulted
trailing parameters (`p_mode`, `p_time_limit_minutes`, `p_seed`) — adding a
4th `p_pace_seconds` hits the exact overload-duplication trap 0080 already
documented and fixed twice this fix phase. This time, planned for it up
front instead of finding it after the fact: `drop function if exists
(text, text, integer, bigint)` before the `create or replace` of the new
5-arg signature, and an explicit `grant execute ... to anon, authenticated`
on the new signature (rather than relying on the implicit PUBLIC-by-default
grant a fresh overload gets) so the intent is stated, not assumed. First
apply attempt still failed once — used a plain `create function` for the
new signature (matching 0080's drop-then-create pattern exactly), which
isn't idempotent for a *second* re-application within the same session
(the migration's own standard re-apply check). Switched to
`create or replace` for the new signature; `drop function if exists` on the
old one stays correctly idempotent (a NOTICE + skip once it's already gone).

**BUG-033, spectator half (FR-36):** re-read `city-match-shell.tsx`'s status
logic and found `iAmOut` only covered `mySeat?.status === 'bankrupt' ||
'retired'` — a player who was *never seated at all* (a genuine spectator,
a late arrival to an already-active match) fell through every other branch
to "Waiting for X", the same generic text an actively-playing off-turn
player sees. Extended `iAmOut` to `!mySeat || ...`, with distinct copy for
each case ("watching from here" for an eliminated player who was in the
game; "spectating this match" for someone who never was).

**Verification:** wrote 3 new regression-harness blocks (BUG-022, 030,
033-pace). Did a live discriminating check for BUG-022 specifically —
reverted just `check_room_limit_before_join` to its pre-fix body, confirmed
the harness goes red with the exact "reached its maximum participant limit"
message the audit described, restored the fix, confirmed green again — same
discipline as every prior round's discriminating checks. Full SQL suite:
29/29 (26 pre-existing + 3 new). `0082` re-applies a second time as a clean
no-op with the harness unchanged; confirmed via the overload-count query
that `city_create_match` has exactly one live signature both before and
after re-application. Regenerated `database.types.ts` (`city_matches`
gained `last_roll_result`/`last_roll_turn` from round 5, `city_create_match`
gained `p_pace_seconds`, and two internal-function signature changes from
earlier rounds — 0077's `city_assert_can_manage`, 0079's
`city_resolve_landing` — had never actually been regenerated into this file
before now; diffed against the previous committed version to confirm the
only changes were these exact, expected ones).

All three client-visible pieces (pace preset selection, mortgage rounding,
spectator status text) were additionally proven live: rebuilt the app with
the local Supabase URL/key explicitly overriding `.env.local` (learned from
round 6's incident — verified via the same bundle-grep check before running
anything), then a fresh two-browser Playwright suite
(`tests/qa-x10-pace-mortgage-spectator.spec.ts`, kept in the repo)
confirmed: selecting "Slow · 60s" in the lobby persists `pace_seconds=60` to
the match row; mortgaging Porto live raises cash by exactly 28; a genuine
onlooker (joins the room, never takes a seat) reads "You're spectating this
match." First run of the pace-preset test itself failed — `getByRole
('button', ...)` couldn't find the preset controls, because they're
rendered with `role="radio"`/`aria-checked` (a real, correctly-recognized
accessible radiogroup, confirmed via the same failure's own accessibility
snapshot) — fixed by querying `getByRole('radio', ...)` instead; not a
product bug, a test using the wrong role selector. Re-ran the full round-6
spec (`qa-x9-client-polish.spec.ts`) afterward too, to confirm this round's
`iAmOut` change didn't regress anything from round 6 — still 4/4.

No client-facing signature changed in a way that broke existing callers —
`city_create_match`'s new parameter is trailing and defaulted, and every
existing call site (including the SQL harness's own `rg_match` helper,
which calls it with exactly 4 positional arguments) continues to resolve
correctly against the new 5-arg signature.

Nothing has touched production. `supabase/migrations/0082_*.sql` is
local-only, same as every migration before it.

## ROUND 8

**Scope: closing BUG-006's one remaining gap.** Round 3 (`city_claim_timeout`,
migration `0076`) had already given the turn clock a real server-side
consequence — an unresponsive current player's turn is auto-claimed once
`turn_started_at + pace_seconds` passes. What was still missing, confirmed by
re-reading `city-match-shell.tsx` in full: nothing anywhere rendered that
deadline to a player. A player facing a ticking clock with real stakes (an
auto-claim that can cost them the turn) had no way to see how much time was
left — the exact "decorative clock" complaint the original audit filed,
narrowed down to its last surviving piece.

**Design:** a purely client-side fix — the server already has full authority
over the actual timeout (0076's `city_claim_timeout` re-derives the deadline
itself and does not trust anything the client displays), so this is a
read-only rendering problem, not a new authority surface. Added a
`TurnCountdown({ deadline })` component to `city-match-shell.tsx`: computes
`Math.max(0, Math.round((deadline - now) / 1000))` on a `setInterval` tick
every 1000ms, renders `mm:ss` inside a `Badge` with `role="timer"` and
`aria-live="off"` (an actively-ticking number read aloud every second would
be disruptive noise for screen-reader users, not useful information — silent
is the correct choice here, not an oversight). `deadline` is derived from the
same fields `city_claim_timeout` itself reads: `turn_started_at +
pace_seconds`. Rendered in the seat-badges row, gated on the identical
conditions already guarding the existing auto-claim effect
(`match.status === 'active' && match.phase !== 'auction' &&
!match.turn_clock_paused_at && match.turn_started_at`) — the countdown only
ever appears when a real, live deadline exists to show, and disappears
exactly when the server-side enforcement it mirrors stops applying (auction
phase, a paused clock, a finished match).

**No new migration.** `pace_seconds` and `turn_started_at` were already
columns on `city_matches`, already selected by the client (`MATCH_COLUMNS`),
and already covered by that table's existing SELECT grant allowlist — this
round needed nothing from the database layer at all, only a new client
component reading data the hook already fetched.

**Verification:** live two-browser proof via a new
`tests/qa-x11-turn-countdown.spec.ts` (kept in the repo). Backdated
`turn_started_at` to 35 seconds in the past against a 40-second pace (5
seconds of the deadline left), reloaded, and read the on-screen timer:
`0:04` on first read, confirmed the ticking is real (not a frozen render) by
reading it again ~2 seconds later and asserting the numeric value strictly
decreased. Full SQL regression suite unaffected — still 29/29, since this
round touched no SQL. `npm run verify`: green.

Nothing has touched production. This round shipped no migration, so
production's migration gap versus local remains exactly `0071`–`0082`,
unchanged from round 7.

## Fix phase running total (all eight rounds)

40 of 44 bugs fixed: 4 Critical, **12 of 13 High (all but BUG-007)**, 12 of
12 Medium, 12 of 15 Low. 4 remain open: BUG-007 (still explicitly out of
scope as multi-day work — disconnect grace, autopilot, forced retire, the
full turn-clock model), and BUG-018/020/028 (re-verification concluded none
of the three is an actual defect — no code change was ever warranted for any
of them). Regression harness: 29/29. `npm run verify`: green. Nothing has
touched production.

## BUG-007 (in progress) — disconnect grace, autopilot, forced retire, the
## full turn-clock model

The one remaining open bug is being built as its own sequence of rounds
(E, A, B, C, D, F, G — lettered rather than numbered to keep them distinct
from the audit's own round 1-8 numbering), planned in detail before any code
was written: a first-pass Explore agent mapped schema/RPC/client state, then
every RPC the plan actually touches or calls into was read in full by hand
(not summarized) across two further passes, specifically because this
session had already been burned twice by acting on an incomplete read of
existing code. That read-everything-first pass paid for itself directly —
it found three places where this project's own docs described a gap that
the code had already closed (kick-awareness via `0074`, `city_end_turn`'s
existing timed-mode wall-clock logic, and `cleanup_inactive_rooms()`'s
already-differentiated 24h City threshold), one live pre-existing bug
(auction settle never shifts `turn_started_at` forward by the pause
duration — queued for round B), and one pre-existing rounding
inconsistency between `city_mortgage` and `city_sell_building` explicitly
left alone as out of scope. Full detail lives in the approved plan at
`C:\Users\tejas\.claude\plans\cozy-gliding-moore.md`.

**Round E (migration `0083`) — the voluntary half of FR-29.** Kicking
already routed through the correct liquidation sequence (`0074`), but
`city_retire_seat` itself was internal-only — no client-callable "I retire"
existed. `city_retire_self` is a thin public shell delegating to the
existing internal function, deliberately with no debt gate (DESIGN.md
§3.1D treats retire/kick/forced-retire as one sequence, always to the
bank). New "Retire" button + confirm dialog in `city-match-shell.tsx`.

**Round A (migration `0084`) — disconnect detection (FR-25, hardens
FR-30).** New `city_match_players.disconnected_at` column, set/cleared by a
trigger bridging the site-wide `room_participants.is_online` presence
system into City's own state — no new client heartbeat. On reconnect, also
resets `consecutive_autopilot_turns` (a column that has existed since
`0063` and was never once read or written until this migration) — readying
it for round C. Deliberately does not yet touch "resume a paused match" —
`status='paused'` isn't reachable until round C/D exist.

**A real infrastructure gap found and fixed the same round, unrelated to
either migration's own logic:** `scripts/city-regression.sql`'s `rg_match`
helper reuses 3 fixed synthetic player UUIDs across every call in the
suite; `check_room_join_rate_limit` (`0025`) allows 20 joins per user per
10 minutes, counted globally, and the suite's own teardown only runs once
at the very end — so by the time this round's two new blocks pushed the
suite to 21 `rg_match` calls in one run, the 3 shared synthetic users
legitimately tripped their own rate limit mid-suite. Fixed by deleting
their `room_participants` rows globally at the top of `rg_match`, mirroring
the per-room-unique-host pattern the same function already used for the
sibling room-creation limit. Not a defect in this round's own code — a
scaling ceiling in shared test infrastructure this round's growth was the
first to actually cross; every future round adds more blocks, so this
needed a real fix, not a one-off workaround.

**A second real gap, this time in how this session runs Playwright tests,
found and fixed before it could cause harm:** `playwright.config.ts`
defines its own global `webServer` (port 4000, `npm run build && npx next
start`) as a precondition for every test run, entirely independent of
whatever server a test's own `BASE` constant points at. The first live run
of this round's new spec used a manually-started server on port 4020
without also giving Playwright's *own* auto-spawned port-4000 server the
local-stack env override — meaning that parallel build almost certainly
baked in `.env.local`'s production URL, the exact class of mistake round 6
was burned by. Confirmed no actual harm this time (the test's own browser
never navigated to port 4000; Playwright's readiness probe is a bare page
load of `/create`, which makes no Supabase calls on its own) before doing
anything else. Fixed properly, not just patched around: started the
manual server on port 4000 itself (with the correct local env) so
`reuseExistingServer` detects it and skips the redundant parallel build
entirely — which also incidentally fixed an apparent 150s test "stall" that
was actually CPU contention from that concurrent production build, not a
real bug. A second server instance on port 4020 was started alongside it
(same build) so earlier rounds' already-committed test files, which
hardcode that port, didn't need to be touched. Re-ran `qa-x9-client-polish`
and `qa-x11-turn-countdown` afterward to confirm zero regression: 5/5.

Live verification (`tests/qa-x12-voluntary-retire.spec.ts`) caught one more
real thing before it shipped: the confirm dialog's action button was
originally labelled "Retire", identical to the trigger button that opens
it — genuinely ambiguous for a screen reader, not just for Playwright's
strict-mode locator matching, which is what actually surfaced it. Fixed by
labelling the confirm action "Yes, retire".

SQL regression harness: 31/31 (29 pre-existing + BUG-007-E + BUG-007-A),
confirmed re-runnable back-to-back after the rate-limit fix. `npm run
verify`: clean. `database.types.ts` regenerated and diffed — only the
expected additions (`city_retire_self`'s signature, `disconnected_at` on
`city_match_players`). Nothing has touched production; migrations `0083`
and `0084` are local-only, same as every migration before them.

Next: round B (per-phase `city_claim_timeout` defaults, the `_core`
extraction of `city_roll_dice`/`city_decline_purchase`/
`city_leave_detention`'s roll-attempt path, and the auction
`turn_started_at`-shift bugfix).
