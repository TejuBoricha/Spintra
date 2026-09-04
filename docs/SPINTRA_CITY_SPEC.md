# SPINTRA_CITY_SPEC.md — Engineering Specification

> **The single wired-up view of the Spintra City feature.** Requirements → design → technology →
> integration with the existing system → implementation → verification, with a traceability matrix
> so every requirement can be followed to the thing that implements it and the thing that proves it.
>
> **Status (2026-09-03): implemented, QA-hardened, code-reviewed, and its database is now live on
> production — not yet merged/deployed to the app itself.** All 7 slices (§7) are built; a 298-case
> QA audit found 44 bugs, all closed across 8+ fix rounds; a 2-round/20-agent code review against
> PR #43 found 2 critical bugs (both live-verified fixed) plus 10 more (11/12 fixed); a 57-case
> regression harness (`npm run test:city-regression`) passes. **Migrations `0063`–`0092` are applied
> to the production Supabase project** (`supabase db push --linked`, independently confirmed via
> `verify:migration` and `supabase migration list` — zero drift, local=remote through `0092`).
> **What's still outstanding before launch:** PR #43 (open, pushed, not yet merged) needs a human
> review; the app itself hasn't been deployed with this feature (merging to `main` triggers that);
> the economy has never been playtested by real users. §12 is the authoritative current checklist.
>
> **The other two documents remain the source of truth for their own areas** and are not duplicated
> here: `SPINTRA_CITY_DESIGN.md` = decisions and their rationale/provenance;
> `SPINTRA_CITY_CONTENT.md` = board content (spaces, economy, cards, tokens). This file references
> both rather than restating them, so there is exactly one place to change any given fact.
>
> Every code reference below was verified against the actual repository, not inferred from
> documentation — `ARCHITECTURE.md` has at least one known drift (see §5.4).

---

## 1. Purpose and scope

### 1.1 What this feature is
A Monopoly-style property-trading board game ("Spintra City", themed **The Wheelworks**) played by
2–8 real people inside an existing Spintra room. Players move around a 40-space board, buy and
develop properties, charge rent, trade with each other, and are eliminated by bankruptcy until one
player remains (Classic) or a time limit is reached (Timed).

### 1.2 In scope
Multiplayer match play inside a room; a server-authoritative rules engine; board, trading,
auction and recap UI; integration with Spintra's existing room infrastructure.

### 1.3 Explicitly out of scope
- **AI/bot opponents** of any kind (approved decision — `DESIGN.md` §2.1). A future solo-vs-AI mode
  is a separate product, not this one.
- **Accounts, friends lists, or persistent player profiles.** Spintra's identity model is anonymous
  sessions; the genre-standard friends-list invite flow does not apply here.
- **Monetisation** of any kind. Spintra has no store, payments, or ads for this feature.
- **Localisation.** English only, consistent with the rest of the site.

### 1.4 Governing constraint (non-negotiable)
Generic game *mechanics and structure* are retained deliberately. Every *expressive* element —
space names, currency name, card text, deck names, token names, artwork — must be original.
See `DESIGN.md` §0 and `CONTENT.md` §2.

---

## 2. Requirements

Numbered for traceability (§10). **MUST** = required for launch; **SHOULD** = strongly wanted,
may slip a slice; **MAY** = optional.

### 2.1 Functional — lobby and match lifecycle

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A host can create a Spintra City room from `/create`, the same way as any other game type. | MUST |
| FR-02 | Players join via the existing room code / invite link / QR flow. | MUST |
| FR-03 | A lobby shows seated players and ready state; the host starts the match. | MUST |
| FR-04 | A match requires **2–8 seated players**; it cannot start with fewer than 2. | MUST |
| FR-05 | The roster **locks at match start**. Late arrivals become spectators, never players. | MUST |
| FR-06 | The host selects **Classic** or **Timed** mode before starting. | MUST |
| FR-07 | Classic ends when one non-bankrupt player remains; Timed ends at the limit, ranked by net worth per `DESIGN.md` §3.1H. | MUST |
| FR-08 | On match end, results are shown and awarded into the existing Scoreboard/XP system. | SHOULD |
| FR-09 | A room supports starting a further match after one ends (post-match flow). | SHOULD |

### 2.2 Functional — core gameplay

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | On their turn a player rolls two dice, generated **server-side**, and their token moves. | MUST |
| FR-11 | Landing on an unowned property offers buy-or-decline; declining triggers an auction. | MUST |
| FR-12 | Landing on an owned, unmortgaged property charges rent automatically. Mortgaged properties charge no rent. | MUST |
| FR-13 | Owning a complete colour group enables building, subject to the even-build rule. | MUST |
| FR-14 | Properties can be mortgaged and unmortgaged at the rates in `CONTENT.md` §4. | MUST |
| FR-15 | Tax spaces, both card decks, and the detention/free-rest corners resolve per `CONTENT.md` §3. | MUST |
| FR-16 | Rolling doubles grants another turn; three consecutive doubles sends the player to detention. | MUST |
| FR-17 | Auctions run per `DESIGN.md` §3.1E (ascending, 10-Spin floor, anti-snipe countdown, no credit). | MUST |
| FR-18 | Insolvency and bankruptcy resolve per `DESIGN.md` §3.1D. | MUST |
| FR-19 | Card decks reshuffle when exhausted; a held Release Papers card is held out of the deck. | MUST |

### 2.3 Functional — trading

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | A player can propose a trade of cash and/or properties to another player. | MUST |
| FR-21 | The recipient can accept, reject, or counter. | MUST |
| FR-22 | A trade is applied **atomically** — both sides transfer or neither does. | MUST |
| FR-23 | Offers are re-validated at accept time and never trusted from the stored row (`DESIGN.md` §3.1F). | MUST |
| FR-24 | Offers expire per `DESIGN.md` §3.1F and are marked superseded when their terms become stale. | SHOULD |

### 2.4 Functional — reliability and fairness

| ID | Requirement | Priority |
|---|---|---|
| FR-25 | A disconnected player keeps their seat and is not retired for a 60-second grace period. The turn clock still runs during it — see `DESIGN.md` §3. | MUST |
| FR-26 | After grace, a seat becomes autopilot-eligible and acts only when its turn arrives. | MUST |
| FR-27 | Autopilot takes only safe defaults, and resolves the turn **immediately** on arrival rather than waiting out the turn clock. | MUST |
| FR-28 | Two consecutive fully-autopiloted turns forces retire/liquidation. | MUST |
| FR-29 | A player can voluntarily retire; a host can kick mid-match. Both route through the same liquidation sequence. | MUST |
| FR-30 | Reconnecting restores the player's own seat and full authoritative state — never spectator-only. | MUST |
| FR-31 | If all players disconnect, the match pauses durably and is not destroyed by the standard room-cleanup cron. | MUST |
| FR-32 | The turn clock runs only while the game is waiting on the active player alone; it pauses while waiting on another player or on an engine-imposed sequence. Phase table in `DESIGN.md` §3. | MUST |
| FR-33 | Every paused context has its own bounded sub-clock (trade 45s, liquidation 90s/3-min phase cap, auction per §3.1E), **and total trade-pause per turn is capped at 90s**. No context is unbounded. | MUST |
| FR-41 | Every turn-clock expiry resolves to a defined neutral default (auto-roll, decline-to-auction, end-turn) so a match can never reach an undefined state. | MUST |
| FR-42 | The host selects a pace preset in the City match lobby at match creation — **not** in `RoomSettingsPanel` — and it locks at match start alongside the roster. Forced liquidation's 90s window is fixed and not host-tunable. | SHOULD |
| FR-43 | A trade offer arriving while the recipient is the active player is queued and surfaced when their turn ends, so it can neither consume nor freeze their turn clock. | MUST |
| FR-44 | The turn clock resets on each doubles re-roll granted by FR-16. | MUST |
| FR-45 | Clock expiry is enforced server-side: every command RPC resolves an expired clock first, and `city_claim_timeout` is independently re-validated (never trusted) and rate-limited like every other command RPC. | MUST |
| FR-46 | The engine-animation pause resumes on the client's ready signal or a 3-second server ceiling, whichever comes first, so a slow or modified client cannot stall the table. | MUST |
| FR-47 | A seat change mid-turn (kick, retire, bankruptcy) discards the departing player's clock and starts the next player on a fresh one; a clock is never inherited across seats. | MUST |
| FR-48 | Resuming an all-players-paused match grants the active player a fresh full turn clock, not the stored remainder. | MUST |
| FR-49 | Disconnected seats auto-pass in auctions, so an auction never waits out its cap on an absent player. | MUST |
| FR-50 | In timed mode the match clock is wall-clock and never pauses for turn-clock pauses; on expiry the current round completes before the match ends. | MUST |
| FR-51 | Eliminated, bankrupt, and spectating players hold no clocks and cannot pause or consume another player's. | MUST |

### 2.5 Functional — social and spectating

| ID | Requirement | Priority |
|---|---|---|
| FR-34 | Room chat works throughout, for players and spectators, using existing chat infrastructure. | MUST |
| FR-35 | Spectators see all public match state; they cannot take match actions. | MUST |
| FR-36 | Eliminated/retired players become spectators. | MUST |
| FR-37 | A live match cannot be destroyed by an ordinary room action without an explicit, match-aware confirmation. See §5.6 — Close Room currently hard-deletes the room row. | MUST |
| FR-38 | Spectators can enter a City room even when every match seat is taken (room capacity must not silently cap spectators). See §5.6. | MUST |
| FR-39 | Match completion awards score/XP through a path that actually works — `award_score` silently no-ops for unknown activity types, and any City branch must re-verify the winner server-side. See §5.7. | SHOULD |
| FR-40 | Kicking a player settles their match seat atomically with the participant-row deletion, leaving no orphaned seat. See §5.7. | MUST |

### 2.6 Non-functional

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | **All match state is server-authoritative.** No client may determine dice, cards, money, or ownership. | MUST |
| NFR-02 | Every command derives the acting player from `auth.uid()` server-side; a client-supplied identity is never trusted. | MUST |
| NFR-03 | **The undrawn deck order is the only server-side secret**; no client may read it ahead of reveal. All other state is public to room members. | MUST |
| NFR-04 | Concurrent commands against one match are serialised (advisory lock), with no lost updates or double-spends. | MUST |
| NFR-05 | Command RPCs are rate-limited following the existing `*_attempts` trigger convention. | MUST |
| NFR-06 | Match authority is independent of `rooms.host_id` — room host election cannot alter match state. | MUST |
| NFR-07 | The board is operable by keyboard and comprehensible to a screen reader; colour is never the sole signal for a property group. | MUST |
| NFR-08 | Animation respects `useReducedMotion`. | MUST |
| NFR-09 | Full mobile parity — the board and trade UI are usable on a phone. | MUST |
| NFR-10 | Randomness is injectable/seedable for deterministic automated tests, without exposing the seed to clients. | MUST |
| NFR-11 | `city_action_log` growth is bounded (cap/snapshot strategy), and reconnect does not require replaying an unbounded log. | SHOULD |
| NFR-12 | The feature degrades gracefully when Supabase is unconfigured (demo mode), consistent with the rest of the app. | SHOULD |
| NFR-13 | No new runtime dependencies are added (see §4.2). | SHOULD |

---

## 3. Design summary (decisions live in `DESIGN.md`)

| Area | Decision | Where |
|---|---|---|
| Architecture | Server-authoritative Postgres match engine; realtime is a **notifier**, not a state carrier | `DESIGN.md` §2.2, §5 |
| Data model | 5 tables: `city_matches`, `city_match_players`, `city_assets`, `city_trade_offers`, `city_action_log` | `DESIGN.md` §2.3 |
| Turn model | 40s turn clock that pauses while waiting on others; 3 mandatory decisions only; defined neutral default per timeout | `DESIGN.md` §3, §3.1A |
| Disconnects | 60s grace → autopilot on own turn only → forced retire after 2 | `DESIGN.md` §3, §3.1B |
| Information model | Deck order is the only secret; everything else public | `DESIGN.md` §3.1C |
| Bankruptcy | One sequence for insolvency/retire/forced-retire/kick | `DESIGN.md` §3.1D |
| Auctions | Ascending, anti-snipe countdown, clock paused | `DESIGN.md` §3.1E |
| Trades | Re-validate inside the accepting transaction | `DESIGN.md` §3.1F |
| Denormalisation | No stored property summary; derive at read time | `DESIGN.md` §3.1G |
| Concurrency | `pg_advisory_xact_lock` per match; **no revision column** | `DESIGN.md` §5, §7 |
| Board content | The Wheelworks, currency Spins, 40 spaces | `CONTENT.md` |

---

## 4. Technology

### 4.1 Stack (all existing — verified in `package.json` / `ARCHITECTURE.md` §1)
Next.js App Router · React · TypeScript · Supabase (Postgres + RLS + Realtime + anonymous auth) ·
Tailwind CSS v4 · Framer Motion · shadcn/ui (Radix) · lucide-react · Playwright.

### 4.2 New dependencies: none planned
The board can be built from existing primitives (§5.3). Three.js is already present for the Lucky
Wheel but is **not** needed here — a CSS/SVG board avoids pulling a WebGL dependency into a
mobile-critical screen (NFR-09). Any proposal to add a dependency should be justified against
NFR-13 first.

### 4.3 What is genuinely new
Only two things: the five `city_*` tables with their RLS and command RPCs, and the
`CityMatchShell` component tree. Everything else is reuse.

---

## 5. Existing system support

The central question of this spec: what already exists, what bends, and what is new.

### 5.1 Reused unchanged

| Subsystem | Where | Note |
|---|---|---|
| Room creation flow | `src/app/create/create-client.tsx` | City is one more game type in the grid |
| Room shell (header, sidebar, layout) | `src/app/room/[code]/` | Chrome around the board |
| Chat | `use-room-chat.ts`, `room-sidebar.tsx` | Satisfies FR-34 with no changes |
| Invite link / QR | `room-header.tsx` | Client-side, keyed on room code only |
| Presence & participant list | `use-room-subscription.ts` | Drives lobby and away-state UI |
| Room host election | migrations `0046`/`0056`/`0061` | Moderation only — must not touch match state (NFR-06) |
| Bans / kick / moderation dashboard | `moderation_kick_ban`, `src/lib/moderation.ts` | Room-level; match consequence added separately (FR-29) |
| Public room discovery | `/explore`, `rooms.is_public` | City rooms list here (decided, `DESIGN.md` §4) |
| Scoreboard / XP / RankBadge | `room_scores`, `award_score` | FR-08 |
| Sound | `src/lib/audio.ts` + room sound toggle | Dice, purchase, bankruptcy cues |
| Dialog / Sheet / Tabs / Badge / Avatar / Tooltip / ScrollArea / Progress | `src/components/ui/` | Trade, auction, and recap UI |
| Sitemap | `src/app/sitemap.ts` | **Verified:** filters to `href.startsWith("/tools/")`, so a non-tool game is excluded automatically — no change needed |

### 5.2 Adapted (small, additive changes)

| # | Change | File / migration | Reason |
|---|---|---|---|
| A1 | Add `"city"` to the `RoomType` union | `src/lib/types.ts:3` | New room type |
| A2 | Add `"city"` to the `rooms_type_check` CHECK constraint | new migration | **Verified:** constraint enumerates all 16 current types (migration `0039`). Without this, creation fails at the DB layer even if the client believes the type is valid. **Must land before any UI change is testable.** |
| A3 | Add a `GAMES` entry — **`createOnly: true` and an explicit `classroomSafe` value are both mandatory, see §5.5** | `src/lib/games.ts` | **Verified pattern:** `createOnly: true` + `href: "/create?type=city"`, exactly as `party` (`:195-205`) and `classroom` (`:206-216`) already do. This is why "no `/tools` page" is *not* a broken pattern — precedent exists, and §5.1's sitemap filter handles it. |
| A4 | Add `"city"` to `RAW_ROOM_TYPES` | `create-client.tsx` | Query-param validation duplicates the union |
| A5 | Third branch in `RoomGameArea` | `room-client.tsx:79`, `:109-111`, `:128` | **Verified:** the file *already* excludes `party`/`classroom` from the `ACTIVITY_REGISTRY` lookup and renders a different component for them. City follows the same shape — an established pattern, not a special case. |
| A6 | City-specific inactivity threshold | `cleanup_inactive_rooms()`, migration `0020` | FR-31 — the standard 2h reap would destroy a paused match |
| A7 | Extend `AnalyticsEventName` | `src/lib/analytics.ts:10` | **Verified:** deliberately narrow 3-event union. Any addition should be a conscious exception to that scoping decision, not a casual expansion. |
| A8 | Mid-match kick consequence | `src/lib/moderation.ts` call path | FR-29 — kicking currently has no match awareness |

### 5.3 New

- Five `city_*` tables + RLS + `is_seated_in_match()` helper + command RPCs (migrations `0063`+).
- `CityMatchShell` component tree, e.g. `src/app/room/[code]/city/`, with a `use-city-match.ts`
  hook calling the RPCs directly. **Deliberately does not use** `sendActivityEvent` /
  `registerEventListener` / `flushActivityState` / `ACTIVITY_REGISTRY` — that pattern was
  evaluated and rejected (`DESIGN.md` §2.2).
- Board, trade, auction, and recap UI built from existing primitives.
- Board artwork and the 8-group visual system (must satisfy NFR-07).

### 5.4 Known drift found while verifying (unrelated, not fixed)
`ARCHITECTURE.md` documents `.glass` / `.glass-card` Tailwind utility classes that **do not
exist**. The real convention is CSS custom properties consumed via Tailwind v4 arbitrary-value
syntax, e.g. `bg-(--surface-glass-strong)`. Build City's UI against the real pattern. Worth fixing
separately.

### 5.5 Impact register — every consumer of `GAMES` / `RoomType`

Adding one entry to the `GAMES` array ripples further than the room page. Below is a full sweep of
every consumer found by searching `src/`, with the actual behaviour verified at each call site.
**Two of these are footguns that will silently do the wrong thing if the new entry's flags aren't
set deliberately.**

| Call site | What it does | Effect of adding City | Action |
|---|---|---|---|
| **`create-client.tsx:254`** | `isClassroom ? GAMES.filter(g => g.classroomSafe !== false) : GAMES` | ⚠️ **FOOTGUN — inverted default.** `undefined !== false` is **true**, so leaving `classroomSafe` unset makes City appear in **Classroom mode**. | **Must set `classroomSafe` explicitly**, whichever way the product call goes. Never leave it undefined. |
| **`activity-picker-dialog.tsx:29`** | `if (g.createOnly) return false` | ⚠️ **Load-bearing.** Without `createOnly: true`, City becomes selectable as an activity *inside a Party room* — and since it is deliberately **not** in `ACTIVITY_REGISTRY`, that renders a blank screen. | **Must set `createOnly: true`.** This single flag is what prevents the broken state. |
| `tools/page.tsx:24` | `GAMES.filter(g => !g.createOnly)` | Excluded from the `/tools` index automatically. Correct — City has no tool page. | None (follows from `createOnly`) |
| `sitemap.ts:9` | filters `href.startsWith("/tools/")` | Excluded automatically. | None |
| `page.tsx:33` | `GAMES.filter(g => !g.createOnly).slice(0,4)` | Excluded from homepage social proof. | None |
| `page.tsx:355` | `{GAMES.filter(g => !g.createOnly).length} games to play` | ⚠️ Count stays at 14 — City is a real game but won't be counted. Same treatment `party`/`classroom` already get. | Minor product call: accept, or change the count's basis |
| `page.tsx:24` | `heroFeatures = GAMES.map(...)` | **Includes** City (no `createOnly` filter) — appears in homepage hero features, linking to `/create?type=city`. Same as `party`/`classroom` today. | Verify it reads well; likely desired |
| `explore/page.tsx:54` | `featuredTemplates = GAMES.map(...)`, rendered at `:543` | **Includes** City, links to `/create?type=city`. Works — same as `party`/`classroom`. | Verify copy |
| `explore/page.tsx:197`, `page.tsx:259` | `GAMES.find(g => g.type === r.type)` | ✅ City rooms render with the correct icon/label on both Explore and the homepage live-rooms feed. | None — confirms City rooms display properly |
| `for-teachers/page.tsx:72` | `GAMES.filter(g => g.classroomSafe)` | Truthy-only, so excluded unless `classroomSafe: true`. Safer default than the create page's. | Follows from the `classroomSafe` call |
| `og-image.tsx:113`, `tool-metadata.ts`, `tool-seo-content.ts`, `tool-seo-section.tsx:19` | Keyed on `href` matching a `/tools/` route | No match, no OG-image route, no SEO entry. No breakage. | None |
| `use-room-subscription.ts:919` | `if (roomType !== "party" && roomType !== "classroom")` auto-sets `activeActivity` | ✅ City auto-activates on room load, like `trivia` does — no picker step needed. | None |
| `use-room-subscription.ts:908` | Restores persisted `room_activity_state` when `persisted.type === roomType` | City doesn't use that table; the lookup simply finds nothing. Harmless, but confirm it's a clean no-op rather than an error path. | Verify in Slice 1 |

**Net conclusion:** the integration is well-behaved *provided both flags are set deliberately* —
`createOnly: true` (prevents a genuinely broken state) and an explicit `classroomSafe` value
(prevents silently appearing in Classroom mode). Neither is optional.

### 5.6 Mid-match room operations — verified against real code

The existing room controls all assume a **stateless activity that can be interrupted safely**.
That assumption does not hold for a match with an economy. Three findings, all verified:

#### 🔴 Close Room hard-deletes the room row — and would take the match with it
`use-room-subscription.ts:465` performs a literal
`supabase.from("rooms").delete().eq("code", roomCode)`.

If `city_matches` carries a foreign key to `rooms` with `ON DELETE CASCADE`, **one host click
destroys a live match instantly** — every seat, asset, trade, and log row — with only the existing
generic "close the room for everyone" confirmation, which says nothing about a match in progress.
This is *distinct from* the cleanup-cron issue (A6): that one is a 2-hour inactivity timer, this is
an immediate, deliberate action available at any moment.

**→ New requirement FR-37.** Options: block Close Room while a match is active, escalate the
confirmation copy to name the consequence, or make the match's lifetime independent of the room
row. Must be decided in Phase 1, since it is a foreign-key design question, not UI polish.

#### 🟠 Room capacity gates spectator entry
`room-join-check.ts:112` returns `full` when
`online participants >= room.max_participants`. Spectators are ordinary room participants, so an
8-seat match in a 10-capacity room admits only **2 spectators** before nobody else can get in — and
`ROOM_DEFAULT_CAPACITY` is 10.

§5.7 deliberately keeps match seats independent of room capacity, but room capacity still gates
entry *to the room at all*. **→ New requirement FR-38:** City rooms need a capacity default that
accounts for spectators, or spectators need to bypass the capacity check.

#### ✅ Reconnect is genuinely safe — no change needed
`room-join-check.ts:79` returns `ok` for the host and for any **existing participant row**, before
the ban, lock, and capacity checks run. A disconnected player's row is retained with
`is_online = false` (never deleted), so a returning player bypasses all three gates. Migration
`0015`'s DB-level lock enforcement fires on `room_participants` INSERT, and a reconnect is an
UPDATE — so it doesn't block either.

**FR-30 (reconnect restores the seat) is achievable with the existing infrastructure**, including
into a room that has since become locked or full. This also means richup's known
reconnect-to-spectator bug (`DESIGN.md` §1c) is structurally unlikely here.

#### ✅ Capacity cannot be shrunk out from under a match
`room-settings-panel.tsx:80` floors the capacity slider at
`Math.max(ROOM_MIN_CAPACITY, onlineCount)`, and temporarily-disconnected players return via the
bypass above. A host cannot strand seated players by lowering capacity.

### 5.7 Database-layer interactions — deeper sweep

Four more findings from reading the migrations themselves rather than the client code.

#### 🔴 `award_score` silently rejects unknown activity types — FR-08 does not work as assumed
Migration `0052` implements `award_score` as an explicit chain:
`if p_activity_type = 'trivia' … elsif 'rps' … elsif 'bingo' … else return query select false …`.

A call with `'city'` hits that final `else` and returns **`false` with no exception raised**. It
does not error, log, or warn — it simply awards nothing. A naive integration would look completely
healthy in testing while never awarding a single point or XP.

**→ New requirement FR-39.** Match completion needs either a deliberate extension of `award_score`
with a City branch, or its own award path. Note that the existing branches all *re-verify* the win
server-side (`award_score`'s whole purpose is never trusting a client's "I won" claim) — a City
branch must do the same against `city_matches`, not accept a reported winner.

#### 🔴 Cascade-from-`rooms` is the established convention — so the "consistent" choice is the dangerous one
`room_participants`, `chat_messages`, `room_activity_state`, `room_bans`, and others are all
declared `references public.rooms(code) on delete cascade`.

This sharpens FR-37 considerably. Writing `city_matches` the same way as every neighbouring table
is the *natural, consistent, convention-following* thing to do — and it is exactly what makes a
single Close Room click erase a live match. **The safe choice here is the inconsistent one**, which
is precisely why it needs to be a deliberate, documented decision rather than a default.

#### 🟠 `moderation_kick_ban` hard-deletes the participant row — orphaning the match seat
Migration `0055` performs `delete from public.room_participants` (`:61`). A kicked player's
`city_match_players` row would survive, referencing a user who is no longer a room participant —
leaving a seat that still owns property and owes rent but whose occupant cannot return.

**→ New requirement FR-40:** kicking must settle the match seat (per FR-29's liquidation path)
atomically with the participant-row deletion, not as a separate best-effort follow-up.

#### 🟡 `participant_count` counts spectators
Migration `0044`'s `sync_room_participant_count` trigger increments on every `room_participants`
insert. Since spectators are ordinary participants, Explore would advertise an 8-player match with
2 spectators as "10". Cosmetic, but it misrepresents match size on the discovery surface that
FR-01/FR-02 depend on for matchmaking.

### 5.8 Still unverified — check during the relevant slice

- **DB backup weight** — `city_action_log` growth against the daily `pg_dump` workflow.
- **CI `db-integration`** — new migrations must apply cleanly on a fresh ephemeral stack.
- **Bundle size** — a new component tree on a mobile-critical screen.
- **Realtime volume** — 8 players plus spectators on one channel across a long match.
- **Demo mode** — `handleCloseRoom` falls back to `postLocalMessage("ROOM_CLOSED")` when Supabase
  is absent; City's demo-mode behaviour generally is undefined (NFR-12).

### 5.8 Deliberate non-integrations

### 5.7 Deliberate non-integrations
- **Room capacity (`rooms.max_participants`, 2–50)** is *not* used to enforce the 2–8 seat rule.
  **Verified:** `room-config.ts` exposes a single generic bound shared by every game type, and
  rooms must also accommodate spectators. Match-seat count is enforced in `city_match_players`
  instead, keeping room capacity and match seating genuinely independent (NFR-06).
- **`rooms.activity_state` / `room_activity_state`** are not used for match state.

---

## 6. Data model (shape; DDL lands in Phase 1)

- **`city_matches`** — one row per match: mode, status, current seat/phase, clock state, **seeded
  deck order (the only secret, NFR-03)**, ruleset toggles.
- **`city_match_players`** — one row per seat: seat index, `user_id`, cash, position, detention
  state, doubles count, connection/autopilot state, consecutive-autopilot count (FR-28), result,
  and a `final_net_worth` snapshot written once at completion. **No stored property summary**
  (`DESIGN.md` §3.1G).
- **`city_assets`** — one row per ownable space: space index, owner seat, mortgage flag,
  development level. Authoritative for ownership.
- **`city_trade_offers`** — offered/requested cash and assets, status, expiry, audit fields.
- **`city_action_log`** — append-only ledger; audit trail and reconnect aid, bounded per NFR-11.

Board definition data (names, prices, rents from `CONTENT.md`) is **static seed data**, not
per-match rows — only mutable per-match facts live in `city_assets`.

---

## 7. Implementation plan

Vertical slices, each independently verifiable and committable. Rationale for slicing rather than
building the whole engine at once: this repo's own history shows a consistent pattern of bugs that
only surfaced when code actually ran against a real database.

| Slice | Delivers | Requirements |
|---|---|---|
| 1 | Room type, lobby, seats, ready, match start. **No gameplay.** | FR-01…FR-06, A1–A5 |
| 2 | Server dice, movement, board rendering | FR-10, FR-16, NFR-01, NFR-07…09 |
| 3 | Buy / rent / tax / insolvency / bankruptcy | FR-11, FR-12, FR-18 |
| 4 | Development tiers and mortgaging | FR-13, FR-14 |
| 5 | Trading | FR-20…FR-24 |
| 6 | Auctions, detention, both card decks | FR-15, FR-17, FR-19 |
| 7 | Timed mode, recap, XP, post-match flow | FR-07…FR-09 |
| Cross-cutting | Disconnect/autopilot/retire; clock; rate limits | FR-25…FR-33, FR-41…FR-51, NFR-04, NFR-05 |

**Slice 1 is the architectural proof.** It exercises the room-shell reuse, the RPC pattern, the
identity model, and realtime-as-notifier end to end, while course-correcting is still cheap. It
must not be skipped or merged into a larger first push.

**As-built status (2026-09-03): all 7 slices plus the cross-cutting row are delivered** on
`feat/spintra-city-design` (commits `3fa27bf`…`97415ad` for the slices; the cross-cutting
disconnect/autopilot/retire/clock/rate-limit work landed afterward as "BUG-007" rounds A–H,
commits `fbd56c7`…`597cd7e`, driven by the QA audit below rather than built ahead of it). Migrations
run through `0091`.

---

## 8. Verification

Per slice, not deferred to the end.

| Method | Covers |
|---|---|
| `npm run verify` (lint + typecheck + build) | Every slice |
| Migrations applied to **local Docker Supabase** before production | Every migration |
| Direct SQL/RPC testing (valid, invalid, spoofed-identity, rate-limit) | NFR-01…NFR-06 |
| Playwright multiplayer tests with **seeded randomness** | FR gameplay — depends on NFR-10 |
| **Genuine multi-client concurrency runs** (simultaneous trade accepts, turn races, auction bids) | NFR-04, FR-22 |
| Disconnect/reconnect scenarios with real browser contexts | FR-25…FR-31 |
| Keyboard-only and screen-reader passes; mobile viewport checks | NFR-07…NFR-09 |

**Verification note carried from this repo's history:** past sessions recorded "verified live" for
what were single-client checks, and real concurrency bugs were later found in that same code.
Concurrency here is a first-class test target, not a spot check.

---

## 9. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | **Scope.** Far larger than any existing activity (~5 tables, a dozen RPCs, three UI surfaces). | Slice plan (§7); Slice 1 as an early, cheap architectural test |
| R-2 | **Secret leak via RLS** — the repo has shipped this class 4× (`0045`, `0028`/`0057`, `0048`, `0062`). | Only one secret exists by design (NFR-03); explicit policy review before any push |
| R-3 | **Weak identity** — anonymous, rotatable sessions guarding an in-match economy. | `auth.uid()`-derived identity (NFR-02); accepted limitation consistent with the rest of the site |
| R-4 | **Untestable randomness** blocking the whole verification plan. | NFR-10 designed into the RPCs from Phase 1, not retrofitted |
| R-5 | **Balance** — the economy has never been played. | Numbers are tunable data, not hardcoded logic; playtest before launch |
| R-6 | **Accessibility** — largest visual surface the site has added. | NFR-07/08 treated as build requirements per slice, not a final pass |
| R-7 | **Match/room lifecycle mismatch** destroying paused matches. | A6; explicit FK/cleanup decision before Phase 1 |
| R-8 | **Long matches vs. session model** — a 40-minute match on anonymous sessions with no accounts. | Durable pause (FR-31); reconnect restores the seat (FR-30) — **verified achievable**, §5.6 |
| R-9 | **Existing room controls assume an interruptible, stateless activity.** Close Room hard-deletes the room row (`use-room-subscription.ts:465`); a cascade would erase a live match in one click. | FR-37; settle the `city_matches` → `rooms` FK relationship in Phase 1, before any table is created |
| R-10 | **Spectator lockout** — room capacity gates all entry, so a full match can leave no room for spectators. | FR-38 |
| R-11 | **Silent-failure integrations.** `award_score` returns `false` rather than raising for an unknown activity type — an integration can look healthy while awarding nothing. Other existing RPCs may share this fail-quiet style. | FR-39; assert on RPC *return values* in tests, never just on "no exception thrown" |
| R-12 | **Following convention is the unsafe default here.** Every sibling table cascades from `rooms`; copying that pattern for `city_matches` destroys live matches. | FR-37; make the FK an explicit, reviewed decision in the first migration |

---

## 10. Traceability matrix (requirement → design → build → proof)

| Requirement | Designed in | Built in | Verified by |
|---|---|---|---|
| FR-01…FR-06 | `DESIGN.md` §3, §5 | Slice 1 (A1–A5) | Playwright lobby test; `verify` |
| FR-07…FR-09 | `DESIGN.md` §3, §4 | Slice 7 | Playwright end-of-match test |
| FR-10, FR-16 | `DESIGN.md` §3.1A | Slice 2 | Seeded-dice test (NFR-10) |
| FR-11, FR-12, FR-18 | `DESIGN.md` §3.1A, §3.1D | Slice 3 | SQL + Playwright bankruptcy scenarios |
| FR-13, FR-14 | `CONTENT.md` §4 | Slice 4 | SQL rent/mortgage assertions |
| FR-15, FR-19 | `CONTENT.md` §3, §6, §7 | Slice 6 | Deck exhaustion/reshuffle test |
| FR-17 | `DESIGN.md` §3.1E | Slice 6 | Multi-client auction race test |
| FR-20…FR-24 | `DESIGN.md` §3.1F | Slice 5 | Concurrent double-accept test |
| FR-25…FR-33, FR-41…FR-51 | `DESIGN.md` §3, §3.1B | Cross-cutting | Reconnect/disconnect browser tests; per-phase clock run/pause unit tests (see §3 phase table) |
| FR-34…FR-36 | `DESIGN.md` §3.1C | Slices 1, 7 | Spectator + chat test |
| NFR-01…NFR-06 | `DESIGN.md` §5 | Phase 1 | Direct SQL/RPC probing, spoofed identity |
| NFR-07…NFR-09 | §2.6 (this file) | Every UI slice | Keyboard/SR/mobile passes |
| NFR-10 | §2.6, R-4 | Phase 1 | Existence of passing seeded tests |
| NFR-11…NFR-13 | §2.6, §4.2 | Phase 1 / ongoing | Log-growth check; dependency diff |

---

## 11. Open items blocking Phase 1

**All three original blockers are now decided** — see `DESIGN.md` §3.2:

1. ~~Randomness test seam~~ → **seed + counter derivation**, seed protected by the column-allowlist
   pattern (migration `0045`), test injection gated on `auth.role() = 'service_role'`.
2. ~~Building supply limits~~ → **unlimited in v1**, with a nullable `building_supply_limit` column
   present from the first migration so scarcity is additive later.
3. ~~FR-37 room FK~~ → **`on delete cascade` guarded by a `before delete` trigger** that blocks
   deletion while a match is live, unless `app.force_close_room` is set by a deliberate path.

Nothing now blocks schema work.

Needing the user, not blocking Phase 1:
3. Board content sign-off (names, "Spins") — blocks the **seed-data** migration only.
4. Board art direction — blocks UI slices, not schema.
5. Trademark clearance on "Spintra City" / "The Wheelworks" — a real-world action.

---

## 12. Open items blocking launch (as-built, 2026-09-03)

Phase 1's blockers above are all closed and schema/implementation work is done. What's actually
left, in order:

1. ~~Branch never pushed~~ → **Partially stale as of 2026-09-04.** PR #43 was opened
   (https://github.com/TejuBoricha/Spintra/pull/43) against the branch's 2026-09-03 state, but a
   2026-09-04 launch-readiness audit found the pushed branch is now **8+ commits behind local
   `HEAD`** — the persistent activity feed, board redesign, What's Next feature, the animated dice
   roll, a real site-wide room-join race fix, and the `/spintra-city` SEO page have all landed
   locally since, none of them pushed. The PR still needs: the branch actually pushed, migrations
   `0093`–`0095` applied to production, and only then a human review and merge. See
   `CHANGELOG_AI.md`'s 2026-09-04 audit entry.
1b. **PR #43's own code review — done, fixed, live-verified (as of 2026-09-03; superseded by more
   local work since, per item 1 above).** A 2-round, 20-agent `/code-review
   high` pass found 2 critical bugs (bankruptcy permanently deadlocking the match; a finished match
   being resurrectable with a live turn state — both independently rediscovered by 5+ agents each,
   then personally verified against the actual SQL and live-reproduced end-to-end, not just
   unit-tested) plus 10 more findings. 11 of 12 fixed in migration `0092` and 4 client-side changes;
   one (a 16-file test-helper duplication) deliberately deferred as not worth the regression risk.
   Full detail: `CHANGELOG_AI.md`'s "Session 66 (continued)" entry.
2. ~~Migrations not live~~ → **Done, 2026-09-03.** `supabase db push --linked` applied `0063`–`0092`
   to production cleanly; `npm run verify:migration` independently confirmed all 8 objects from
   `0092` exist live, and `supabase migration list` confirmed local=remote for every migration
   `0001`–`0092`, zero drift. The database side of Spintra City is genuinely live now.
3. **Full CI gate not yet green end-to-end, for reasons unrelated to app correctness.** `npm run
   ci` stops at the `npm audit --audit-level=high` step — 14 vulnerabilities (10 high), confirmed
   pre-existing on `main` (identical `package-lock.json`), not introduced by this feature. Running
   `npm run build` and the full Playwright `test:smoke` suite (93 tests) directly (bypassing the
   blocked audit gate) took 5 iterations to get a trustworthy signal, surfacing and fixing two real
   environment bugs along the way: (a) 12 QA test files hardcoded a stale port (`4020`) that
   `playwright.config.ts`'s actual webServer (`4000`) never listens on — fixed; (b) local
   Supabase's `[auth.rate_limit].anonymous_users` was left at the default 30/hour, far below what
   this suite's 100+ anonymous sign-ins per run need — raised to 1000 in `supabase/config.toml`,
   which is very likely also the fix for this repo's previously-unexplained "residual
   non-deterministic CI flake." After both fixes, remaining failures (a handful, scattered across
   unrelated feature areas, all connection/auth-layer errors, zero assertion mismatches) are
   consistent with auth-burst throttling under this sandbox's specific constraints, not a code
   defect — corroborated by the RPC-level `test:city-regression` harness passing 57/57 twice,
   including after a full fresh migration replay. A literal 93/93 clean run was not obtained in
   this sandbox; see `CHANGELOG_AI.md`'s 2026-09-03 entry for the full run-by-run diagnosis.
4. ~~Never played against production~~ → **Done, 2026-09-03.** Ran the local dev server against
   the branch's own code (not merged/deployed — this was `feat/spintra-city-design` running locally,
   pointed at production Supabase via `.env.local`) and drove 2 real, independent anonymous
   sessions through room creation → City match → seats → ready → start → a real dice roll, all
   against the live, newly-migrated production database. Board rendered correctly (the real
   "Spintra City / World Tour" content), both seats showed correct starting cash, the roll/movement/
   landing-on-unclaimed-property flow worked and synced to both clients via realtime, zero console
   or page errors on either side. Two harmless rooms created (`FWNR8E`, `FD2AZE`) — private,
   unlisted, will be swept by the existing `cleanup_inactive_rooms()` cron same as any abandoned
   room. **Full balance/economy playtesting with real concurrent multi-day play is still open** —
   this was a functional smoke test, not a balance pass.
5. **Docs were stale until this pass.** This file, `DESIGN.md`, and the top-level session docs said
   "design phase, zero code" through 47 implementation commits — fixed 2026-09-03.
6. Board art, and trademark clearance on "Spintra City"/"The Wheelworks" (item 4/5 above) — still
   outstanding, still the user's call, not code. **One related, narrower decision was made and
   shipped 2026-09-04:** the product name itself stays "Spintra City" (unchanged — putting the
   Hasbro-trademarked "Monopoly" name into the product's own branding would be real infringement
   risk), but user-facing copy now uses "Monopoly-style" as comparative description (the `/create`
   card, the What's Next dialog, and a new `/spintra-city` SEO landing page, which also carries an
   explicit non-affiliation disclaimer) — nominative fair use, not a trademark-clearance
   substitute. See `CHANGELOG_AI.md`'s 2026-09-04 entry for the full reasoning.

Everything else in `DESIGN.md` §4.1 can be sequenced alongside the slices.
