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

## Fix phase running total (all three rounds)

24 of 44 bugs fixed: 4 Critical, 9 of 13 High, 6 of 12 Medium, 5 of 15 Low.
20 remain open, headlined by BUG-007 (the 20 MUST-requirement disconnect/
autopilot/turn-clock slice — explicitly out of scope as multi-day work, not
an oversight) plus the card/deck logic bugs (015/016/017/032), the economy
correctness bugs (028/030), the room/spectator gaps (022/033), and the
client-side polish items (034/035/037/039/040/041/042/043). Regression
harness: 21/21. `npm run verify`: green. Nothing has touched production.
