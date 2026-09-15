# QA Test Plan — Spintra City

**Scope:** Spintra City only (the new property-trading game mode). The rest of the
site is in scope *only* where City touches it — room membership, the scoreboard,
XP, room settings, theming.

**Author:** QA audit pass, 2026-08-30
**Build under test:** branch `feat/spintra-city-design`, HEAD `cb08868`
**Migrations under test:** `0063` – `0070` (local Docker Supabase only; none are on production)

---

## 1. What Spintra City actually is

A server-authoritative Monopoly-style mode inside the existing Spintra room
system. Understanding the trust boundary is the whole basis of this plan:

| Layer | Technology | Trust |
|---|---|---|
| Client | Next.js App Router, React, `use-city-match.ts` hook | **Untrusted.** Renders state, calls RPCs. |
| Transport | Supabase PostgREST + Realtime | Realtime is a *notifier* only — it carries no authoritative state. |
| Engine | Postgres `SECURITY DEFINER` functions (35 `city_*` routines) | **Authoritative.** Referee. |
| Storage | Postgres tables (8 `city_*` tables + 1 view) + RLS | Authoritative. |
| Identity | Supabase anonymous auth; `auth.uid()` inside every RPC | Server-derived, never client-supplied. |

Consequences that shape the plan:

- **Every rule must be enforced in SQL.** A UI-only guard is a bug, not a control.
  Anything the UI disables must also be refused by the RPC.
- **Randomness is derived, never stored.** Dice come from `city_derive_dice(rng_seed,
  rng_counter)`; card draws from a hash permutation. `rng_seed` and `rng_counter`
  are hidden by column-level grants. If a client can read the seed, it can predict
  every future roll — so seed exposure is a **critical** class of bug.
- **Concurrency is guarded by `pg_advisory_xact_lock` per match.** Every mutating
  RPC must take it, or two simultaneous calls can interleave.
- **Reads are guarded by RLS, not by the client's query.** A table with
  `USING (true)` is world-readable through the public anon key regardless of
  what the app asks for.

## 2. Feature / system inventory

Derived by reading the migrations and components, not assumed.

**Engine (SQL, 35 routines):**
lobby & seating (`city_create_match`, `city_join_seat`, `city_leave_seat`,
`city_set_ready`, `city_start_match`) · dice & movement (`city_derive_dice`,
`city_roll_dice`, `city_resolve_landing`) · property (`city_buy_property`,
`city_decline_purchase`, `city_rent_for`) · development (`city_build`,
`city_sell_building`, `city_mortgage`, `city_unmortgage`) · money & insolvency
(`city_charge`, `city_try_settle_debt`, `city_max_liquidation`,
`city_declare_bankruptcy`, `city_bankrupt_seat`) · trading (`city_propose_trade`,
`city_accept_trade`, `city_resolve_trade`, `city_space_is_tradeable`) · cards &
detention (`city_draw_card`, `city_apply_card`, `city_leave_detention`) ·
auctions (`city_place_bid`, `city_pass_auction`, `city_settle_auction`) ·
end & scoring (`city_net_worth`, `city_finish_match`, `city_end_turn`) ·
plumbing (`city_rate_limit_check`, `city_assert_can_manage`).

**Tables:** `city_matches`, `city_match_players`, `city_assets`, `city_auctions`,
`city_trade_offers`, `city_board_spaces`, `city_cards`, `city_command_attempts`.
**View:** `city_match_results`.

**Client:** `city-match-shell.tsx` (orchestrator), `city-board.tsx` (40-tile grid),
`city-holdings.tsx` (holdings + raise-funds window), `city-trade.tsx`,
`city-auction.tsx`, `use-city-match.ts` (data hook + RPC wrappers).

**Seams into the existing site:** `rooms.type = 'city'` · `is_member_of_room()`
for RLS · `room_participants` (identity, XP) · `room_scores` (+ its
`activity_type` CHECK) · `_record_award` and its participant-update triggers ·
`--city-*` theme tokens in `globals.css` across `.light`/`.dark`.

## 3. Test suites and case ID ranges

| Prefix | Suite | Focus |
|---|---|---|
| `TC-LOBBY` | Lobby & seating | create, join, leave, ready, start, seat limits |
| `TC-GAME` | Core gameplay | roll, move, land, buy, rent, tax, build, mortgage, turn order |
| `TC-CARD` | Cards & detention | deck behaviour, effects, Customs escape, transit visas |
| `TC-TRADE` | Trading | propose, accept, decline, staleness, expiry |
| `TC-AUCT` | Auctions | floor, step, credit, reset clock, settle, no-bid |
| `TC-END` | Match end & scoring | bankruptcy, timed expiry, net worth, XP/score award |
| `TC-EDGE` | Negative & edge cases | invalid input, boundaries, wrong order, spam |
| `TC-MULTI` | Multiplayer | two live clients, sync, race conditions, concurrency |
| `TC-SEC` | Security & exploits | RLS, grants, client trust, RNG exposure, duplication |
| `TC-API` | Backend / RPC surface | authorization, validation, error codes, direct calls |
| `TC-DB` | Database & persistence | constraints, transactions, consistency, reload |
| `TC-UI` | UI | rendering, states, overflow, contrast, assets |
| `TC-UX` | UX | clarity, feedback, discoverability, error communication |
| `TC-FE` | Frontend | console, network, async, stale state, subscriptions |
| `TC-PERF` | Performance | query counts, payload size, render cost, long session |
| `TC-REC` | Error & recovery | refresh, disconnect, tab close, interrupted RPC |
| `TC-COMPAT` | Compatibility | viewports, themes |
| `TC-REG` | Regression | existing suites still green |

## 4. Method per suite

- **Engine suites** (`TC-GAME`, `TC-CARD`, `TC-TRADE`, `TC-AUCT`, `TC-END`,
  `TC-EDGE`, `TC-API`, `TC-DB`, `TC-SEC`): executed as SQL against the local
  Docker Postgres, impersonating real users via `set role authenticated` +
  `request.jwt.claims`, so RLS and `auth.uid()` behave exactly as they do for a
  browser client. Deterministic seeds so every result is reproducible.
- **Exploit suites** (`TC-SEC`): executed through **PostgREST over HTTP with the
  public anon key** — the same surface a real attacker has — not through psql,
  because psql as `postgres` proves nothing about what a client can reach.
- **Client suites** (`TC-UI`, `TC-UX`, `TC-FE`, `TC-MULTI`, `TC-REC`,
  `TC-COMPAT`, `TC-PERF`): Playwright against a real dev server pointed at the
  local stack, with two independent browser contexts for multiplayer.
- **`TC-REG`**: the repo's own `npm run verify` and existing Playwright suites.

## 5. Environment

| | |
|---|---|
| App | `next dev`, local, env overridden to the local Supabase stack |
| Database | Docker `supabase_db_Spintra-1`, Postgres, port 54322 |
| API | PostgREST via Kong, `http://127.0.0.1:54321` |
| Browser | Chromium via Playwright, 1280×800 default |
| **Production** | **Not touched.** Production has none of `0063`–`0070`. |

## 6. Status definitions

- **PASS** — expected behaviour observed in execution. Code that merely *looks*
  correct is not a PASS.
- **FAIL** — reproduced deviation from expected behaviour. Requires a bug ID.
- **BLOCKED** — could not execute; reason recorded.
- **NOT TESTED** — not reached, or out of environment; reason recorded.

Each result also records its evidence class: *code inspection*, *SQL execution*,
*HTTP execution*, *browser verification*, or *two-client verification*.

## 7. Severity definitions

| | |
|---|---|
| **CRITICAL** | Game-breaking, unrecoverable state, data corruption, or an exploit that lets a player win/steal/cheat. |
| **HIGH** | Major function broken or severe player impact; no reasonable workaround. |
| **MEDIUM** | Real defect with a workaround, or a rule deviation that changes outcomes rarely. |
| **LOW** | Cosmetic, polish, or a defect with negligible player impact. |

## 8. Rules for this pass

1. No application behaviour is modified during the audit. Find → reproduce →
   verify → document. Fixes only on explicit request, followed by regression.
2. No production data is touched, read, or migrated.
3. No PASS without execution.
</content>
</invoke>
