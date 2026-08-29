# SPINTRA_CITY_DESIGN.md — "Spintra City" Feature Handoff

> **Status: Design-in-progress. Zero code, migrations, or UI exist yet.** This document has been
> built up across four passes: (1) a design conversation held outside this repo, relayed and
> transcribed here; (2) a correction pass that independently verified the richup.io claims made in
> pass 1; (3) a deep research pass covering player-facing UX genre-wide and a concrete, file-level
> integration plan against this repo's *actual* current code; (4) a decision pass where the user
> explicitly delegated 7 specific open product questions ("pick whatever is best suited") rather
> than deciding them directly. It exists so any AI model/tool can pick up exactly where things
> stand, without replaying prior work or guessing at what was already decided.
>
> Read this file in full before proposing or writing anything for this feature. Three provenance
> tags are used throughout and mean different things — don't collapse them: **APPROVED** = the
> user directly said yes to this; **DECIDED (by delegation)** = the user asked an AI to pick
> whatever's best suited and this is that pick, not the user's own product judgment — surface it
> back to them if it ever seems worth a second look; anything unmarked or called "proposed"/"open"
> is still genuinely undecided.

---

## 0. What is "Spintra City"?

A new large multiplayer game mode for Spintra (see `docs/ARCHITECTURE.md` for the base product) —
a property-trading board game in the vein of Monopoly/richup.io, played by a room of real people.
Players move around a board, buy/develop/mortgage properties, and trade with each other; the game
resolves to bankruptcy (Classic mode) or a time limit + net-worth calculation (Timed mode).

### Critical constraint stated by the user at the very start of this design (do not lose this)

> "We'll retain generic game terms, while every proper name and visual asset stays original."

Concretely:
- Generic mechanic terms are fine to reuse (property, auction, mortgage, trade, bankruptcy, dice,
  turn, deed, rent, etc. — these are genre-standard, not proprietary).
- **Every proper noun and visual asset must be original to Spintra.** No Monopoly board-space
  names, no Monopoly token/piece names or art, no copied card text, no reused iconography or
  color scheme that's identifiably Monopoly's. The board's theme, city name, currency name,
  space names, card-deck names, and all art must be invented fresh as part of design.
- This has **not been designed yet** (see §4, "Not Yet Designed"). Whoever does the board/content
  design pass needs to originate a full city theme (board space names, a currency name, the two
  card decks' names and content, token/avatar concepts) — none of that exists yet, not even a
  placeholder.

---

## 1. Research: richup.io and comparable games

### 1a. Original relay (from the design conversation, unverified at the time)

Asked and answered mid-conversation, twice. Findings, as originally reported by the other AI —
**see 1b below, which corrects one of these:**

- **Confirmed:** richup.io runs its own hosted backend + managed database (on DigitalOcean),
  supports accounts/history/invites, and delivers persistent multiplayer matches. It markets
  itself around playing "real players," supports rooms up to 7–8 players, and centers the
  experience on friends/profiles/live-player reputation.
- ~~**Not found / not confirmed:** any public bot/AI-player feature.~~ **This turned out to be
  wrong — see 1b.**
- **Conclusion drawn for Spintra:** don't copy richup's implementation (unknown/unverifiable) —
  design our own server-authoritative engine that fits Spintra's existing Supabase stack. The
  *outcome* to match is "the backend is the referee, clients only request actions, realtime
  distributes confirmed results" — not any specific richup mechanism. (This conclusion still
  holds regardless of 1b's correction — it was never dependent on richup having or lacking bots.)

### 1b. Independent verification (second pass — corrected the bot claim)

The claim above that richup has no bot feature was never independently checked before landing in
this doc — it was relayed as-is. Checked directly via WebSearch/WebFetch. Direct fetches of
`richup.io` and `blog.richup.io` returned `403 Forbidden` (Cloudflare bot-protection) at the time,
so these findings came from search-result snippets and third-party mirrors — reasonably
well-corroborated (multiple independent sources agree), not first-party confirmed. **Pass 1c below
got first-party access and confirms/extends most of this.**

- **Correction: richup.io does have a bot feature.** Its own marketing describes play "with
  friends, strangers, **or bots**," including a solo-vs-bots mode. The earlier "no bots" claim was
  false, and it had been cited as part of the reasoning for Spintra City's own no-fill-in-bots
  decision (§2.1). See 1c for a resolution — bots don't appear to fill seats in real human
  matches in this genre, which restores most of the original reasoning's practical conclusion even
  though its factual premise was wrong.
- **Richup's real turn-timer is a chess-clock model, not a flat per-turn reset**: free thinking
  time at the start of a turn, then a personal time reserve that carries across turns (per a
  versioned changelog post) — confirmed first-party in 1c.
- **Richup's actual handling of an unresponsive player is a timeout/kick, not indefinite
  autopilot** — confirmed and made precise in 1c (exactly 2 consecutive auto-played turns).
- **A real, user-reported reconnect bug in richup**: reconnecting sometimes drops a player into
  spectator-only instead of restoring their seat — treat as a concrete cautionary precedent for
  Spintra City's own reconnect design (§3) to explicitly test against.
- **Richup's player-count model is tiered** (paid upgrade for larger rooms) — see 1c for how this
  compares to a second product and what it implies for Spintra's already-approved flat 2–8 range.

### 1c. Deep player-UX research (screen-by-screen, third pass)

Goal for this pass: not just game rules, but the actual player journey and UI patterns, so the
integration plan (§5) can match genre expectations where that's actually useful, and deliberately
diverge where Spintra's own product already does something better or different. A read-proxy
(`r.jina.ai`) got past richup's Cloudflare block for several URLs this time, returning real
first-party page text — marked **high confidence** below. Aggregator/mirror-site claims and
generic SEO copy are marked **medium/low**. A second, more openly-documented comparable product,
**Rento Fortune** (`rento.com`, also on Steam/itch.io/mobile), was researched to check whether
findings are richup-specific or genre-wide.

**Lobby & matchmaking.** High confidence (richup homepage, first-party): top-level actions are
**Play**, **Create a private game**, and **All rooms** — a public lobby browser exists alongside
private-room creation. Rento (first-party, high confidence) has an explicit **Online** mode
(public/real players) distinct from **Solo** (vs. AI), **Pass-'N-Play**, and local-WiFi modes.
→ **Spintra already has this pattern**: the existing `/explore` page + `rooms.is_public` flag
already gives Spintra City a "public lobby" for free — no new matchmaking system needs inventing
(see §5's open question on whether City rooms should actually use it).

**Invite mechanics.** High confidence (richup blog v1.15, first-party quote): friends are added
via a profile "Add Friend" (mutual approval), then you can see friends online and invite them
directly into a room — explicitly framed as removing the need for external links. Private rooms
also get a shareable link (medium confidence, several mirrors agree). Rento's friends list
similarly lets you "watch their games, and play with them again" (first-party, high confidence).
**No evidence found of a short alphanumeric room code** in either product — not found, not ruled
out. → **Spintra already has an equivalent, arguably better for its own use case**: room codes +
shareable links + QR codes already exist (`room-header.tsx`). The one thing richup/Rento have that
Spintra genuinely lacks is a persistent friends list — out of scope, since Spintra's identity
model is anonymous/session-based, not accounts.

**In-match layout.** Weakest-documented area for both products — no source describes whether
trade/auction UI is modal, a docked panel, or a full-screen overlay. Confirmed generically:
trading starts by clicking a player's profile or a trade button, proposing cash/properties/a mix;
declining a purchase triggers an auction among remaining players (medium confidence, not a direct
quote). Richup's Teams Mode (v1.16, first-party) adds a **separate team chat channel alongside
global chat**, implying chat is a persistent panel — this already matches Spintra's own existing
room chat sidebar.

**Spectator experience.** Three distinct paths, uneven confidence: (a) a general "watch and learn"
spectator mode is marketed (medium, generic aggregator copy); (b) the **known disconnect-to-
spectator bug** from 1b (medium, search-synthesis only) — now with a concrete production precedent
for the exact failure mode already flagged as Critical in §7; (c) elimination (richup v1.17,
first-party, high confidence): after **exactly two consecutive auto-played/skipped turns**, "the
player is eliminated and their properties revert to the bank" — a concrete number for §7's
"autopilot needs a forfeit ceiling" gap. What a spectator can actually see/do — not found anywhere
for either product.

**End-of-game experience.** Not found for either product: no dedicated results/recap screen,
net-worth breakdown, replay, or rematch button turned up despite targeted searches. What exists
instead is **profile-level persistent stats** (richup: Karma Points, Winning Rate, Games Played, a
browsable match history — first-party, high confidence), not an automatic post-match screen. This
looks like a genuine documentation gap in the genre rather than proof such screens don't exist —
**Spintra City needs to design this from scratch**, and the natural connective option (see §5) is
to reuse Spintra's *existing* Scoreboard/XP infrastructure (`room_scores` ledger, `RankBadge`,
level-up toasts, already built for the other 14 games) rather than inventing a parallel system.

**Mobile experience.** Richup's own copy (first-party, high confidence, appears twice): "Richup is
better on desktop PCs and laptops" — a self-authored hedge suggesting mobile works but is
secondary. This is in real tension with Spintra's own usage pattern: Spintra's invite flow leans
on QR codes for same-room joins, which strongly implies players often join *from a phone*.
**Recommend not defaulting to richup's desktop-first framing** for Spintra City without an
explicit product decision — the two products' actual usage patterns may genuinely differ.

**Notifications/toasts.** Not found for either product — no source describes toast copy or visual
form for "your turn," an incoming trade offer, or a bankruptcy announcement. Richup's turn-timer
post implies *some* on-screen timer/turn indicator exists (it describes what happens when time
runs out) but not its visual form.

**Monetization (brief, for awareness only — Spintra has no accounts/store/payments at all today).**
Richup: "Richup Coins" earned per win or bought via PayPal; cosmetic skins/board reskins/profile
pictures, plus paid **capacity upgrades** (7–8 player rooms) and Teams Mode and ad removal. Rento,
by contrast, supports **2–8 players by default, no paywall** — closer to Spintra City's own
already-approved flat 2–8 range. This explains *why* richup's low default player count (4, paid-
gated to 7–8) isn't a meaningful precedent to follow here — Rento's uncapped 2–8 is the more
relevant comparison, and it validates the range Spintra already settled on in §2.1.

**Bots, revisited.** Neither product mixes bots into a real human multiplayer match to fill empty
seats — richup's bot mode and Rento's "Solo (vs. AI)" are both separate, standalone modes. This
corroborates (though doesn't prove) that §2.1's "no fill-in bots" decision matches how the rest of
the genre actually ships it, even though the original justification for that decision
("richup has no bots at all") was factually wrong per 1b.

**Sources for this pass:** richup.io, /info, /store, /store/board-maps (via r.jina.ai, first-party
content); blog.richup.io index + 6 individual posts — v1.17 "The Turn Clock," v1.16 "Introducing
Teams Mode," v1.15 "Friendships & Blocks," "Getting to Know User Statistics," v1.12, v1.11
"Introducing the Store," and a 2022 tournament recap post (all via r.jina.ai, first-party content);
gamehollow.org, gamevgames.com, rocketgames.io, seeles.ai, an itch.io discussion thread
(aggregator/mirror, medium/low confidence); rento.com and its Steam store page (first-party
content for the comparable-product findings).

---

## 2. Decisions actually confirmed by the user so far

These three got an explicit "ok" in response to a direct approval question. Treat them as settled
unless the user revisits them.

### 2.1 APPROVED — Human-first launch, no AI/bot players in core multiplayer
- No AI competitors fill empty seats in the real multiplayer game. Reasoning given: trading and
  negotiation between people is the core value; a bot sophisticated enough to trade/negotiate
  fairly is a hard, separate problem, not something to bolt onto v1. (See §1c: this matches how
  richup and Rento Fortune both actually ship it — bots are always a separate solo mode, never
  mixed into a real match — even though the original justification for the decision was wrong.)
- Minimum viable match size: **2 human players**. Max: **8** (validated as a reasonable, non-
  idiosyncratic range by Rento Fortune's default — see §1c).
- Empty lobbies are solved by invite links + public matchmaking, not bots.
- **Autopilot exists only for temporary disconnects** — a conservative fallback that plays it safe
  (skips optional actions) until the real player reconnects and resumes their own seat. This is
  not a game-filler bot; it's a disconnect-tolerance mechanism (see §3, and §7 for the still-open
  "needs a forfeit ceiling" gap, now with a concrete precedent number from §1c).
- A genuine solo-vs-AI mode was explicitly named as a **possible separate future product**, not
  in scope now — it would need real economy/trade-strategy AI to feel fair, and was deliberately
  not designed further here.

### 2.2 APPROVED — Server-authoritative match engine (architecture)
Three options were evaluated; the user approved option 3.

1. **Extend Spintra's existing activity event log** (the `activity_state` jsonb replay pattern
   used by the current 14 room games, see `ARCHITECTURE.md` §3's Pub/Sub Event Bus) — **rejected**.
   Reasoning: that pattern is client-owned and replay-capped, and cannot safely settle money,
   trades, bankruptcy, or resolve concurrent player actions. It's the right tool for Coin Flip/RPS,
   wrong tool for a stateful economy game.
2. **Client-authoritative game store** — **rejected**. The active browser tab would become a
   single point of trust; cheating, stale state, reconnects, host migration, and simultaneous
   trade acceptance all become fragile or exploitable.
3. **Server-authoritative match engine — APPROVED.** PostgreSQL owns the match, seats, turn state,
   money, assets, offers, cards, and the action ledger. Clients call narrowly scoped server
   commands (`roll`, `buy`, `bid`, `trade_accept`, `build`, etc.); each command validates current
   state in one DB transaction, updates the board, then broadcasts the resulting confirmed view.
   Realtime (Supabase) is used purely to *deliver* confirmed state — it does not carry
   client-authored game logic the way the existing 14 activities' broadcast events do.

**Important integration note for whoever implements this:** this is a deliberate architectural
departure from every other game currently in the room system. Do not default to wiring Spintra
City through `ACTIVITY_REGISTRY` / `sendActivityEvent` / the jsonb `activity_state` replay log the
way the other 14 games work (`ARCHITECTURE.md` §3) — that pattern was explicitly evaluated and
rejected for this feature. Spintra City needs its own dedicated tables and RPC-style server
commands, more like the existing `award_score`/`elect_room_host`/`check_guess_number`
SECURITY DEFINER RPC patterns already in this codebase (see migrations `0028`, `0046`, `0052`)
than like the generic activity event bus. **§5 below now grounds this in the actual current code.**

### 2.3 APPROVED (schema-level) — Design 1: Match Engine data model
Presented as 5 tables; user confirmed "looks right so far" after a repeated clarifying question.
Treat the *concepts and field lists* below as approved direction, not final column-level DDL —
exact types/constraints/indexes still need real schema design before a migration is written.

- **`city_matches`** — one row per match, independent of the room host. Fields discussed: rules,
  mode (Classic/Timed), status, current turn/phase, turn deadline, seeded deck order, and a
  **revision number** (for optimistic-concurrency-style validation on every command — **§5/§7 now
  recommend replacing this with the repo's existing advisory-lock pattern instead**).
- **`city_match_players`** — one row per seat. Fields discussed: seat number, identity, cash,
  board position, properties summary (**§7 flags a likely drift risk here — see below**),
  detention state (a jail-equivalent — needs an original name per §0), doubles-roll count,
  reconnect/autopilot status, final result.
- **`city_assets`** — the board's ownable spaces. Fields discussed: which space, owner, mortgage
  status, development level (house/hotel-equivalent — needs an original name/concept per §0).
- **`city_trade_offers`** — fields discussed: offered assets/cash, requested assets/cash,
  counter-offers, expiry, status, audit details (who proposed/accepted/rejected/when).
- **`city_action_log`** — append-only ledger of every roll, payment, card draw, auction bid, build,
  mortgage, trade, bankruptcy, and reconnect event. This is the audit trail / replay source for
  reconnecting clients (see §2.3 note below).

**Mechanics stated alongside the schema (approved as direction):**
- The server (not any client) generates dice/card outcomes and processes each action inside a
  locked transaction — validates whose turn it is, funds, ownership, active rule settings, and
  the match's current revision number before applying the next state.
- A room-host change (the existing Spintra host-election system) affects moderation/invitations
  only — it must not be able to alter match state. This means Spintra City's authorization model
  needs to be independent of `rooms.host_id`/the existing host-election RPCs, keyed instead on
  match-seat identity.
- Reconnects load the authoritative snapshot (current `city_matches`/`city_match_players`/
  `city_assets` state) **plus** action history from `city_action_log`, so a reconnecting player
  never loses progress or has to trust a peer's local state.

---

## 3. Proposed but NOT yet confirmed — Design 2: Match Flow & Reliability

**This is the open item.** It was presented as "Design 2" and the conversation ended on the
question *"Does this flow and the 90-second default feel right?"* — **no answer was given before
the user switched to a different AI tool.** Do not treat any of the following as decided. Surface
it back to the user as an open question before building on it; they may confirm it as-is, want
changes, or want to reconsider it entirely — **and now have a real shipped alternative to weigh it
against (richup's chess-clock turn timer, §1c)**.

Proposed content, verbatim intent:

- **Lobby:** 2–8 human seats, ready states, private invite links, spectators. Host picks
  Classic or Timed mode, then starts the match; roster locks immediately at start.
- **Turn state machine (proposed):**
  `awaiting roll → movement → space resolution → required decision → optional actions → end turn`
- **Turn clock — DECIDED (by delegation, 2026-08-29):** adopt richup's chess-clock model instead
  of a flat 90s reset (§1c) — a fixed amount of free thinking time at the start of each turn
  (suggested default: 20s, tunable), after which the player draws down a personal time reserve
  that carries across turns (suggested starting reserve: 3 minutes per match, tunable).
  **Rationale:** trading/negotiation between real people is explicitly the stated core value of
  Spintra City (§2.1) — a flat per-turn timer penalizes a genuine trade negotiation exactly as
  harshly as a simple dice roll, working against that core value. The reserve model self-balances:
  simple turns barely touch it, trade-heavy turns can draw on it. This is a proven, shipped
  mechanic (richup v1.17), not a speculative alternative — exact seconds are a tunable balance
  parameter, not locked in by this decision.
- **Timeout behavior (proposed):** on expiry, the engine only resolves *safe defaults* — e.g.
  skip an optional purchase/build, or trigger a required auction — **never** an arbitrary trade or
  a risky investment on the player's behalf.
- **Disconnect handling (proposed, grace-period length still open):** short reconnect grace
  period; if the player stays away their seat moves to **conservative autopilot** (skips optional
  actions, takes no risks) until they return. Cash/assets/position are left untouched by autopilot.
- **Autopilot forfeit ceiling — DECIDED (by delegation, 2026-08-29):** after exactly **2
  consecutive fully-autopiloted turns**, the seat is forced into the same retire/liquidation
  sequence as a voluntary retire (below). **Rationale:** matches richup's own proven answer to
  this exact problem (§1c) instead of inventing a new number, and closes the "match could hang
  forever" gap flagged in §7.
- **Retire (proposed):** an intentional "I'm leaving" action, distinct from a disconnect — triggers
  a defined liquidation/bankruptcy sequence rather than silently autopiloting forever.
- **Mid-match kick — DECIDED (by delegation, 2026-08-29):** a host kicking a player during an
  active match routes through this exact same retire/liquidation sequence, rather than a separate
  mechanism. **Rationale:** reuses an already-designed flow instead of adding new state; keeps the
  host's existing moderation authority meaningful during a match instead of disabling kicking
  outright or leaving a kicked seat stuck in autopilot forever (which would undermine the forfeit-
  ceiling decision above).
- **Late arrivals (proposed):** join as spectators only, cannot enter a match already in progress
  as a player.
- **Match end conditions (proposed, exact net-worth mortgage adjustment still open):**
  - Classic: ends when exactly one non-bankrupt player remains.
  - Timed: ends at the selected time limit; final ranking computed from net worth = cash + owned
    assets + buildings, adjusted for mortgaged assets.
- **Full-room disconnect (proposed):** if every player disconnects, the match pauses durably
  (not destroyed) and resumes when an eligible seat reconnects.
- **Match lifecycle vs. room-cleanup cron — DECIDED (by delegation, 2026-08-29):** `city_matches`
  (and its child rows) must **not** cascade-delete when the owning room is reaped by
  `cleanup_inactive_rooms()`'s standard 2h-inactivity rule. City-type rooms get their own, longer
  inactivity threshold in that same cron (suggested default: 24h with zero online participants
  across the whole match, tunable) before the room+match are reaped together. **Rationale:** a
  full City match represents far more player investment (time, in-match economy) than the other
  14 quick games the 2h rule was designed for; reusing that short fuse would silently destroy a
  validly "durably paused" match — exactly the class of state-loss bug this codebase has already
  been burned by and fixed elsewhere. This is a parameter change to the existing cron, not a new
  subsystem.

### 3.1 Resolved detail design — DECIDED (by delegation, batch 2, 2026-08-29)

The user delegated a second batch ("close the remaining design gaps") the same way as the 7 in §4.
Same provenance caveat applies: these are reasoned picks, not the user's own product judgment.

#### A. Turn state machine — what's mandatory vs. optional

Phases run `awaiting_roll → movement → space_resolution → required_decision → optional_actions →
end_turn`. Only three situations are ever **mandatory** (blocking); everything else is optional and
skippable:

1. **Detention exit choice** at the start of a turn spent in The Lockworks (pay the fee, spend a
   Release Papers card, or attempt doubles).
2. **Buy-or-decline** when landing on an unowned property. Declining sends it to auction — so this
   is genuinely unskippable, but timing out on it is safe (see below).
3. **Raise funds** when cash is short of a debt owed. Not skippable by definition — you cannot
   decline to pay rent or tax.

`movement` and `space_resolution` take no player input at all — the server computes the landing
square and what it demands (rent charged automatically, tax deducted, card drawn and applied). A
card's effect may itself push the player into one of the three mandatory decisions above.
Landing on Gearfall ends the turn immediately with no optional-actions window.

`optional_actions` covers building, mortgaging/unmortgaging, selling developments, and proposing
trades. Available to the active player each turn, and never blocking.

**Timeout behavior per phase** (consistent with §3's "safe defaults only" rule):
- `awaiting_roll` → auto-roll. Rolling is never a risky choice.
- Buy-or-decline → **decline** (property goes to auction). Never auto-spends a player's money.
- Raise funds → the server runs the mandated liquidation sequence (§D) automatically. This is not
  a "risky choice" — the debt is owed either way, and the sequence is deterministic.
- `optional_actions` → end turn. Skipping optional actions is inherently safe.

#### B. Reconnect grace period, and what autopilot may spend

- Disconnect detected → seat flagged **away** immediately (UI indicator only, no gameplay effect).
- **60-second grace period.** A player who returns inside it never experiences any consequence.
- Still away after 60s → the seat becomes *autopilot-eligible*, but **autopilot only acts when
  that seat's turn actually arrives.** A disconnected player whose turn is three seats away loses
  nothing.
- **Autopilot must not drain the player's personal time reserve** (§3's chess-clock model). It may
  consume only the per-turn free thinking time before acting. Rationale: the reserve is an earned,
  strategic resource — burning it because someone's wifi dropped would compound bad luck with a
  real competitive penalty.
- 2 consecutive fully-autopiloted turns → forced retire (already decided, §3).

#### C. Spectators, hidden information, and late arrivals

**The single most useful decision here: the only server-side secret in the entire match is the
undrawn deck order.** Everything else — every player's cash, every property's owner, mortgage
state, and development level, the full action log — is public to everyone in the room, players and
spectators alike.

Rationale: this is how the physical game already works (money and deeds sit on the table), and it
collapses the §7 Critical RLS-leak risk from "many secrets to protect" down to one narrow, clearly
identified thing. A simple RLS model that's hard to get wrong beats a clever one that leaks — and
this repo has leaked exactly this way three times before.

- **Late arrivals** join as spectators; the roster locks at match start and cannot be joined.
- **Retired/bankrupt players** become spectators too — same state, one code path.
- Spectators can read all public match state and use the existing room chat. They cannot take any
  match action.
- Held **Release Papers** cards are public (consistent with the above; nothing is gained by hiding
  them, and hiding them would reintroduce a second secret).

#### D. Bankruptcy and liquidation sequence

One sequence serves four entry points: insolvency, voluntary retire, forced retire (autopilot
ceiling), and mid-match kick (§3).

**When a debt exceeds available cash**, the player enters the mandatory raise-funds decision. They
may sell developments (returning half the build cost), mortgage properties (50% of price), or
trade. The server computes their **maximum possible liquidation value**; if that still falls short
of the debt, bankruptcy is unavoidable and is declared immediately rather than forcing a pointless
liquidation ritual first.

**Resolution depends on the creditor:**
- **Owed to another player:** all developments are sold to the bank first (half build cost), and
  the resulting cash plus all remaining cash goes to the creditor. All properties transfer to the
  creditor, keeping their mortgaged status; the creditor owes no immediate interest, and may lift
  the mortgages later at the normal cost.
- **Owed to the bank** (tax or card): developments are sold back, and all properties return to the
  bank as **unowned and unmortgaged**, available to be landed on again normally.
  **Deliberate simplification:** the classic game auctions a bank-bankrupted player's properties
  immediately. That's a long cascade of auctions at the least interesting moment of a match, so
  it's dropped here. Flagged explicitly as a knowing divergence, not an oversight — revisit if
  playtesting shows it matters.
- **Retire / forced retire / mid-match kick:** treated exactly as bankruptcy to the bank.

The seat is then marked bankrupt/retired with its final result recorded, and the player becomes a
spectator. Classic mode ends when one non-bankrupt player remains.

#### E. Auction flow

Triggered when a player declines to buy an unowned property they landed on (default-on rule).

- **Everyone still in the match participates, including the player who declined.**
- **Ascending open auction.** Opening bid 10 Spins, minimum increment 10 Spins — a low floor is
  deliberate, so properties can genuinely go cheap.
- **Timing:** a 15-second countdown; every new bid resets it to 10 seconds (anti-snipe). Hard cap
  of 2 minutes total, at which point the standing high bid wins.
- **Pass** is available as a fast path — if all remaining participants pass, the auction resolves
  immediately rather than waiting out the clock. Passing is not binding; a player may bid again
  while the clock runs.
- **No bidding on credit** — a bid above your current cash is rejected.
- **No tie-break needed:** bids are sequential and serialized server-side by the same per-match
  advisory lock as every other command, so two identical winning bids cannot exist.
- **If nobody bids,** the property simply stays unowned and the turn continues.
- An auction is a **global match phase** — the active player's turn clock pauses for its duration,
  since every player needs time to think and none of it is the active player's fault.

#### F. Trade-offer staleness (resolves a §7 Medium finding)

A pending offer references specific assets and cash amounts, either of which can change before it's
accepted. **The authoritative rule: never trust the stored offer row at accept time.** Every
referenced asset's ownership, mortgage state, and development level, plus both parties' cash, are
re-validated inside the same locked transaction that would apply the trade. If anything moved, the
accept fails cleanly rather than executing a trade whose terms no longer exist.

Separately (for UI cleanliness, not correctness), offers are proactively marked `superseded` when:
any referenced asset changes owner, mortgage state, or development level; either party's cash drops
below their side of the offer; or either party goes bankrupt/retires.

**Expiry:** an offer lapses at the end of the proposer's next turn, or after 3 minutes, whichever
comes first — long enough to negotiate, short enough that stale offers don't accumulate.

#### G. `city_match_players` denormalization (resolves a §7 Medium finding)

**Drop the "properties summary" field entirely.** Ownership is derived from `city_assets` at read
time; net worth is computed, never stored. This repo has already been burned by a stored-count
field drifting from its source rows (`rooms.participant_count`, migration `0044`), and a player's
asset list is far more volatile than a participant count.

**One deliberate exception:** a `final_net_worth` snapshot written once when the match completes.
That's a historical record of a finished match, not a cache of live state — it can't drift, because
nothing it summarizes can change afterward.

#### H. Timed-mode net worth formula

Final ranking is by net worth, computed as:

```
cash
+ (unmortgaged properties  × full listed price)
+ (mortgaged properties    × 45% of listed price)
+ (developments            × full build cost paid)
```

The 45% figure is exact, not arbitrary: a mortgaged property is still owned (100%) but carries the
cost to lift it (50% principal + 10% interest = 55%), leaving 45%. This avoids double-counting the
cash the player already received when mortgaging, and is simple enough to explain in the UI.

### 3.2 Phase 1 blockers — DECIDED (by delegation, batch 3, 2026-08-29)

The three schema-shaping decisions from `SPEC.md` §11. Same provenance caveat as batches 1–2.

#### A. Randomness and the test seam (NFR-10, and it strengthens NFR-03)

**Derive randomness from a stored seed rather than storing outcomes.** `city_matches` holds
`rng_seed` plus a monotonically-increasing `rng_counter`; every die roll and card draw is computed
as a pure function of `(seed, counter)`, advancing the counter inside the same locked transaction
as the command. No shuffled deck array is ever materialised.

This is strictly better than the originally-proposed "seeded deck order" column: there is no
pre-computed sequence sitting in a row waiting to leak, and the entire match becomes exactly
reproducible from one value — which is what makes bug reports and tests tractable.

**Protecting the seed** uses the column-allowlist pattern already established by migration `0045`
for trivia's answer key: `revoke select on city_matches from anon, authenticated, public`, then
`grant select (…every column except rng_seed and rng_counter…)`. Clients read match state; the
seed is unreachable through the API rather than merely undocumented.

**The test seam:** the match-creation RPC accepts an optional explicit seed **only when
`auth.role() = 'service_role'`**. Playwright can create a fully deterministic match using the
service key; a browser client cannot, because the service key is never shipped to the browser.
This closes the obvious cheat vector — a player picking a seed whose outcomes they have
pre-computed — without a fragile "are we in test mode?" check. Anonymous clients always get a
server-generated random seed.

#### B. Building supply — unlimited by default, with the schema ready for finite

**Decision: unlimited buildings in v1**, but `city_matches` carries a nullable
`building_supply_limit` (null = unlimited) from the first migration.

Rationale: a finite supply adds a global contention point (who gets the last one), another
concurrency hot spot, and a rule most casual players never consciously exercise — while Spintra's
audience is explicitly casual. Carrying the nullable column from day one means introducing scarcity
later is a data change and a rules branch, not a migration against live matches. Unlimited → finite
is additive; the reverse would be a balance regression.

#### C. `city_matches` → `rooms` foreign key (FR-37) — cascade, but guarded by a trigger

Four options were considered: plain cascade (destroys live matches — the dangerous default),
`on delete restrict` (Close Room fails with an opaque error), `set null` (orphaned matches, and
`cleanup_inactive_rooms` stops reaching them), and no FK at all (silent orphans, and backups/cleanup
no longer reason about the relationship).

**Decision: keep `on delete cascade` — consistent with every sibling table — and add a
`before delete` trigger on `rooms` that raises when a non-finished City match exists, unless the
transaction-local flag `app.force_close_room` is set.**

This gives the best of both: no orphan rows, cascade consistency, natural backup/cleanup
behaviour — and the destructive path becomes impossible to take *by accident*. The two legitimate
paths set the flag explicitly: Close Room (behind match-aware confirmation copy naming the
consequence) and City's longer-threshold cleanup reap (§3). Uses the same transaction-local
`set_config` bypass pattern as migration `0052`'s rate-limit bypass — though note `0052`'s own
comment cautions that this pattern is *less* precedented in this codebase than it first appears, so
it should be commented clearly at the definition site.

---

## 4. Not yet designed at all

Explicitly out of scope of the conversation so far — don't assume any of this has even been
discussed, let alone decided:

- ~~The actual board, currency name, card decks, property groups/pricing/rent, development tiers,
  detention naming~~ — **drafted, see `docs/SPINTRA_CITY_CONTENT.md`.** The user chose the
  "Wheelworks" theme from three concept pitches and confirmed the classic 40-space structure
  should be retained (original names/art only). That file now holds the full board layout, the
  economy tables, both 16-card decks, tokens, and the optional rule toggles. **Still a first
  draft, not approved** — and its numbers are explicitly a starting point for a balance pass,
  not a finished economy.
- Detailed auction mechanics (bidding flow, timing, tie-breaks) — the content doc establishes
  *that* auction-on-decline is a default-on rule, but not the interaction detail.
- Detailed bankruptcy sequence (asset liquidation order, who receives forfeited assets, partial
  payment rules).
- Board **art** — no visual design exists at all: no group colour palette, no token artwork, no
  decision on board render approach (SVG/CSS/canvas). See the content doc's §10.
- Trade/negotiation UI/UX — §1c found the genre's shape (click a player or a trade button, propose
  cash/properties/a mix) but not layout/interaction detail (modal vs. panel) — still an open
  design task, just with more reference material now.
- Spectator UX beyond "late arrivals become spectators" — §1c found richup markets a "watch and
  learn" mode but couldn't confirm what a spectator can actually see/do.
- ~~How a match is entered from Spintra's existing room UI~~ — **resolved, see §5.**
- Exact schema DDL, RLS policies, and SECURITY DEFINER RPC signatures for §2.3's five tables —
  still open, but §5 now documents the concrete conventions to follow.
- Migration numbering: the repo's latest applied migration is **`0062`**
  (`supabase/migrations/0062_rooms_select_privacy_fix.sql`) as of this handoff — new work starts
  at `0063`. Check `supabase/migrations/` again before writing one, in case other work has landed
  since this doc was written.
- Anti-cheat/rate-limiting specifics for the new command RPCs — §5 now documents the exact existing
  pattern to copy (a dedicated `*_attempts` table + `BEFORE INSERT` trigger, used 5 times already).

**Product questions surfaced by the §5 integration research — DECIDED (by delegation, 2026-08-29):**
- **Mid-match kick** → resolved in §3: routes through the same retire/liquidation sequence as a
  voluntary retire.
- **Match lifecycle vs. room-cleanup cron** → resolved in §3: City rooms get their own longer
  inactivity threshold in `cleanup_inactive_rooms()`, not the standard 2h rule.
- **Public `/explore` listing — DECIDED: yes**, list City rooms there when created public, using
  the exact existing `is_public` pattern, no special-casing. **Rationale:** §2.1 already committed
  to "invite links + public matchmaking, not bots" as the fix for empty lobbies — that only
  actually works if City rooms are genuinely visible in public matchmaking. Not listing them would
  quietly contradict a decision already approved by the user.
- **Mobile parity — DECIDED: full mobile parity** with Spintra's other 14 games, not richup's
  "better on desktop" tradeoff. **Rationale:** richup's hedge reflects richup's own constraints,
  not Spintra's — Spintra's invite flow already leans on QR codes for same-room joins (a strong
  signal of phone-based joining), the site has a documented history of dedicated mobile-viewport
  fixes (e.g. `CHANGELOG_AI.md` Session 13's Tournament overflow fix), and the other 14 games are
  all expected to work on mobile today. Copying richup's hedge would be a regression against
  Spintra's own existing bar, not a neutral choice.
- **End-of-game recap — DECIDED:** layer a City-specific final-net-worth summary **on top of** the
  existing Scoreboard/XP system, not instead of it. Match completion awards into the existing
  `room_scores`/XP ledger (consistent with how Trivia/RPS/Bingo already work — see `docs/TASKS.md`
  Session 51) *plus* a small City-only panel showing each player's final net worth breakdown
  (cash + assets — already tracked in `city_match_players`/`city_assets` regardless of this
  decision, since it's needed for the Timed-mode end condition in §3 anyway). **Rationale:**
  reusing the existing XP/leveling system keeps City consistent with the rest of the site instead
  of building a parallel system neither richup nor Rento document publicly (§1c) — but omitting a
  net-worth summary entirely would be a worse experience than either needs to be, given the data
  is already sitting in the schema.

---

### 4.1 Gap audit — things nothing above covers (added 2026-08-29)

A deliberate sweep for what the design *doesn't* address, run after §3.1 closed the known open
items. None of these are decided; several are significant enough to shape the schema, so read this
before Phase 1.

#### Significant

- **Accessibility — entirely uncovered, and the largest a11y surface the site has ever added.**
  A 40-space visual board raises problems none of the existing 14 activities have: screen-reader
  narration of board position and turn events, keyboard operation of the board and trade UI, and
  `useReducedMotion` support for token movement and dice animation. Most urgent specific: the
  content draft's **8 colour-coded property groups** are exactly the colour-only-signal bug class
  this repo already fixed once (Trivia's correct/incorrect feedback, Session 43 — fixed by adding
  redundant icons). Groups need a non-colour identifier from the start, not retrofitted.
- **Testability — server-generated randomness has no test seam.** §8 commits to Playwright
  coverage and genuine multi-client concurrency testing, but dice and card draws are generated
  server-side by design (§2.2), so no test can drive a match to a known board state. A seeding or
  injection mechanism has to be designed *into* the command RPCs and `city_matches`' seeded deck
  order from the start — retrofitting it later means reworking every RPC. **Treat as a Phase 1
  schema decision, not a testing afterthought.** Note the seed is also the one secret in the whole
  match (§3.1C), so the test seam must not become a leak.
- **No `/tools/*` page — breaks a site-wide pattern.** All 14 existing games have a standalone
  single-player tool page feeding `sitemap.ts`, `tool-seo-content.ts`, and a per-tool OG image.
  City has no solo mode by design (§2.1, no bots), so it can't have one. Needs an explicit decision
  and a check that `/tools`, the sitemap, and `/create`'s grid all degrade gracefully for a game
  with no tool page — no existing code has ever had to handle that case.
- **No post-match flow.** §3 defines how a match *ends* but not what the room does next: rematch
  with the same seats, return to idle, promote spectators into seats for a second game, or close.
  A 40-minute match ending in a dead room is a real UX cliff, and it interacts with the already-
  decided XP/Scoreboard integration (§4).
- **Building supply limits.** The classic game's finite house/hotel supply creates a genuine
  strategic squeeze (denying opponents development by holding stock). `SPINTRA_CITY_CONTENT.md`
  never says whether Kiosks/Pavilions/etc. are finite. Materially changes late-game play either
  way — needs a deliberate call, not a default.

#### Smaller, but genuinely unspecified

- **Dice count is never actually stated.** Two is implied by the doubles rule but never written
  down; the utility rent multiplier (§4 of the content doc) depends on it.
- **Card deck mechanics:** reshuffle behaviour when a 16-card deck is exhausted, and the fact that
  a held Release Papers card must be held *out* of the deck until used or traded.
- **Detention detail:** whether a detained player still collects rent, and whether they may build,
  mortgage, or trade while detained (classic rules say yes to all — but it should be written down).
- **Trade contents:** whether Release Papers cards and mortgaged properties can be included in a
  trade offer (both are conventional, both have real consequences — a mortgaged property transfers
  a debt, not just an asset).
- **`city_action_log` growth is unbounded.** A full match could produce thousands of rows and it's
  the reconnect replay source (§2.3). Needs a cap, pagination, or a snapshot+tail strategy —
  compare the existing `activity_state` replay cap and `capMessageHistory()` convention.
- **`classroomSafe` flag.** A real field on `GameDefinition` that drives `/create` filtering and
  the `/for-teachers` grid. Property trading is benign, but a 40-minute match may not suit a class
  period — a product call, not automatic.
- **Analytics events.** The repo tracks `room_created`/`room_joined`/`activity_started` via
  `src/lib/analytics.ts`; City should probably emit match-level events, but the deliberately narrow
  3-event scope was itself a past decision worth respecting rather than casually expanding.
- **Sound integration.** The site has `src/lib/audio.ts` and a room-level sound toggle every
  activity honours. Dice, purchases, and bankruptcies are obvious cues; unaddressed so far.
- **Collusion and griefing.** Trades are atomic so nobody can be scammed mid-trade, but nothing
  prevents two players from colluding via deliberately lopsided trades to eliminate a third, or a
  griefer joining and immediately retiring. Probably acceptable for casual play — but it should be
  an explicit acceptance, in the same spirit as the documented anonymous-identity trade-offs.
- **Trademark clearance on the names.** Nobody has checked whether "Spintra City" or "The
  Wheelworks" collide with existing marks. The §0/§2 IP work covers *copyright* (original names,
  text, art); trademark is a separate question and a genuine user action.

---

## 5. Site integration plan (researched — concrete, file-level)

Researched directly against this repo's actual current code (not just `ARCHITECTURE.md`'s prose,
which turned out to have at least one confirmed drift from reality — see the UI-inventory note
below). This section is the concrete answer to "how does this plug into our website."

### Room creation
`GameDefinition` (`src/lib/games.ts:22-34`) has no player-count field at all, and
`create-client.tsx` renders one generic capacity `Slider` (`src/lib/room-config.ts:10-11`,
hardcoded 2–50) shared by every game type — there is currently no way to express "this game caps
at 8 seats" at the `/create` layer. **Recommendation: don't force the 2–8 rule through
`rooms.max_participants`** (which also has to accommodate spectators) — enforce the 2–8
**match-seat** count independently inside `city_match_players`/match-start logic, keeping room
capacity and match-seat count as the genuinely separate concepts §2.3's authority split already
implies. Separately, `rooms.type` has a server-side CHECK constraint enumerating all 16 current
`RoomType` values (migration `0039`) — adding `"city"` to the TypeScript union alone is **not**
sufficient; a new migration must extend this constraint or room creation fails at the DB layer.
`create-client.tsx` also hand-duplicates the `RoomType` list for query-param validation — a third
place to touch. None of this is architecturally hard, just an exact-order checklist (see below).

### Room shell vs. the match itself
Good news: this codebase already has a working precedent for exactly the kind of exception
Spintra City needs. `room-client.tsx`'s `RoomGameArea` does not purely do
`ACTIVITY_REGISTRY[type]` lookup — it already special-cases two room types (`party`, `classroom`)
to render an entirely different component (`AggregateIdleScreen`) instead of the normal activity.
A third branch for `"city"`, rendering a new `CityMatchShell`, is the *same shape* the codebase
already uses when a room type doesn't map onto one simple activity component — not a special-case
hack. `RoomActivityContext` exposes both generic room-chrome fields (`roomCode`, `isHost`,
`currentUser`, `hostUserId`) and event-bus-specific ones (`sendActivityEvent`,
`registerEventListener`) — a City component can consume the former and simply never call the
latter, since nothing forces their use. **Recommendation: keep Spintra City inside
`/room/[code]`, reusing the existing shell (header, chat sidebar, participant list, invite
link/QR, moderation) — don't carve out a separate top-level route.** The entanglement with the
activity-registry pattern is shallow enough that this reuse is genuinely clean.

### Existing infrastructure — what transfers vs. needs a decision

| Piece | Verdict |
|---|---|
| Invite link/QR (`room-header.tsx`) | Reusable unmodified. |
| Realtime channel auth (migration `0036`) | Reusable, but only as a **notifier** ("state changed, go refetch"), not a state carrier — keep dice/card/turn data out of broadcast payloads and behind RLS-gated table reads, given the deck-order leak risk already flagged in §7. |
| Host election (`0046`/`0056`/`0061`) | Reusable unmodified for moderation/invites only — must stay fully independent of match authority per §2.3, which the existing code's own separation already supports. |
| Moderation (`moderation_kick_ban` RPC) | **Needs a decision, not a clean reuse** — kicking someone from the room today has zero effect on a hypothetical match seat (see §4's new open question). |
| Room lifecycle cleanup (`cleanup_inactive_rooms()`, 2h no-online-participant reap) | **Needs a decision, not automatic inheritance** — if `city_matches` FKs to `rooms` with cascade delete, a room reaped while a match is validly "paused durably" (§3) would silently destroy an active match's economy. |

### UI components already available
Dialog, Sheet, Tabs, Avatar, Badge, Tooltip, ScrollArea, Popover, DropdownMenu, Select, Slider,
Switch, Progress, Skeleton — enough to build a trade-offer dialog, a mobile properties drawer
(Sheet is already reused for the chat sidebar), and board/trade/log tab-switching without
inventing new primitives. **Documentation correction found along the way, unrelated to Spintra
City but worth knowing before styling anything new:** `ARCHITECTURE.md` claims a
`.glass`/`.glass-card` Tailwind utility class exists — it doesn't. The actual pattern is CSS
custom properties (`--surface-glass`, `--surface-panel`, etc.) consumed via Tailwind v4
arbitrary-value syntax (e.g. `bg-(--surface-glass-strong)`). This is a pre-existing, unrelated
doc/code drift — flagged here only so City's UI is built against what's real, not what's
documented; worth a separate fix at some point, not part of this feature.

### Database/RPC conventions to match
So City's new RPCs look like they belong in this codebase, not like a bolted-on system:
- **Identity**: derive the acting player server-side via `auth.uid()` inside the RPC — the
  pattern `award_score` uses (migration `0052`) — never trust a client-supplied user-id parameter,
  the weaker pattern `elect_room_host` uses (migration `0046`). **This is the concrete resolution
  to §7's Critical identity-binding finding.**
- **Concurrency**: use `pg_advisory_xact_lock(hashtextextended(key, 0))` scoped per match — the
  exact pattern migration `0029` already uses to serialize room joins. **This resolves §7's Medium
  "revision number vs. row locking" question in favor of locking; a client-tracked revision
  column on `city_matches` isn't needed on top of it.**
- **Rate limiting**: a dedicated `*_attempts` table plus a `BEFORE INSERT` trigger counting a
  rolling window — the pattern used five times already (migrations `0011`/`0025`/`0030`/`0033`/
  `0038`). **This closes §7's High rate-limiting gap** — apply the same shape to City's command
  RPCs.
- **RLS helpers**: this codebase consistently factors repeated `exists(...)` checks into small
  `SECURITY DEFINER` helpers (`is_member_of_room()`) rather than inlining them — City will need an
  equivalent `is_seated_in_match()` helper once its schema is finalized.
- **Grants**: functions are `SECURITY DEFINER` with an explicit
  `grant execute ... to anon, authenticated` after creation, and internal-only helpers get an
  explicit `revoke` (Postgres grants EXECUTE to PUBLIC by default) — don't skip the revoke step
  for anything City-internal.

### Concrete file-level plan, in dependency order
1. New migration (`0063`+): extend the `rooms_type_check` CHECK constraint to include `'city'`.
2. `src/lib/types.ts` — add `"city"` to the `RoomType` union.
3. `src/lib/games.ts` — new `GAMES` entry; `create-client.tsx`'s `RAW_ROOM_TYPES` — add `"city"`.
4. `activity-registry.ts` — deliberately do **not** add an entry here.
5. `room-client.tsx`'s `RoomGameArea` — add a third branch (alongside the existing party/classroom
   one) rendering a new `CityMatchShell` when `activeActivity?.type === "city"`.
6. New `CityMatchShell` component tree (e.g. `src/app/room/[code]/city/`) with its own hook
   (`use-city-match.ts`) calling the new SECURITY DEFINER RPCs and reading `city_*` tables
   directly — never touching `sendActivityEvent`/`registerEventListener`/`flushActivityState`.
7. New migrations for the five `city_*` tables and their command RPCs, following the conventions
   above.

**Genuinely hard parts to resolve before or during implementation** (not just "different from the
other 14 games," but real open questions): the capacity mismatch (2–8 vs. the generic 2–50
slider) needs the product decision above now that it's clear no code path expresses it today; the
CHECK-constraint dependency means the migration must land before any `/create` UI change is even
testable against real Supabase; `moderation_kick_ban`'s total unawareness of match seats is a real
cross-cutting gap; and `cleanup_inactive_rooms()`'s 2h reap colliding with §3's "pauses durably"
state needs an explicit decision, not silent inheritance.

---

## 6. How to continue this work

1. **§3's two biggest open items are now decided by delegation** (turn clock model, autopilot
   forfeit ceiling) — see §3 for the decisions and rationale. **Still genuinely open, not part of
   that delegated batch:** the exact turn state-machine step behavior, the reconnect grace-period
   length, the late-arrival-spectator rule, and the Timed-mode net-worth formula's exact mortgage
   adjustment — worth a quick confirm (or another delegation) with the user before locking those.
2. **The board/content pass is now drafted** — `docs/SPINTRA_CITY_CONTENT.md` holds the full
   Wheelworks board, economy, both card decks, and tokens. Next step there is user review, then a
   balance pass on the numbers; the schema in §2.3 can now be designed against real content
   (e.g. `city_assets` rows map to that file's 40-space table).
3. Resolve §4's new open product questions (moderation-vs-match-seat, cleanup lifecycle,
   explore-listing, mobile priority, scoreboard integration) — these came out of real code
   research (§5), not speculation, and each has a genuine fork in the road.
4. Follow this repo's own process for everything after that: `AGENTS.md` → `docs/START_HERE.md`
   → `docs/INDEX.md` govern how any AI session (this one or another) should work in this
   codebase, including the mandatory Pre-Implementation Impact Assessment before any actual code/
   migration is written. This feature is large enough (new tables, new RLS, new realtime
   authorization surface, real money-equivalent logic) that it should go through that process
   deliberately, not be rushed into code from this design doc directly.
5. Once real implementation starts, this document should be retired in favor of the repo's normal
   trio: an ADR in `docs/DECISIONS.md` (architecture rationale — §2.2/§2.3 above are ADR-shaped
   already), a new section of `docs/ARCHITECTURE.md` (once the schema is final, using §5's file
   list as the starting point), and normal `docs/TASKS.md`/`docs/CHANGELOG_AI.md` entries as work
   lands. Until then, keep this file as the single source of truth for "what was decided vs.
   proposed vs. undesigned."

---

## 7. Review findings (added by a later review pass over this design)

Reviewed against two things: internal consistency of §§2–3 above, and this repo's own bug
history as documented in `AI_CONTEXT.md`/`TASKS.md` — several bug *classes* have already hit
this codebase more than once, so it's worth checking this design doesn't walk into the same
ones. Nothing here is a code bug (no code exists yet) — these are gaps in the design itself that
would become real bugs if built exactly as scoped so far. **Several are now resolved in direction
by §5's research — marked inline below.**

### Critical
- **No identity-binding for match commands, in a system with weak identity.** §2.3 requires match
  authority to be independent of `rooms.host_id`, but never addresses that every client in this
  app is an anonymous, unverified, trivially-rotatable session (`AI_CONTEXT.md`'s "Current
  Assumptions": "good enough to stop casual abuse, not a secure identity system"). That tradeoff
  is acceptable for RPS/Trivia; it's much riskier for a game with an in-match economy and trading.
  **Resolved direction (§5): derive identity via `auth.uid()` server-side inside every command
  RPC — the `award_score` convention — never a client-supplied identity field, the weaker
  `elect_room_host` convention.**
- **High risk of repeating this repo's most-repeated bug class: a secret exposed via an
  over-permissive RLS `select`.** This exact mistake has shipped and been fixed three times
  already here — the trivia answer key (`0045`), the guess-the-number secret (`0028`/`0057`),
  Bingo win verification (`0048`) — plus `rooms_select` itself was `using (true)` for months
  (`0062`). §2.3's `city_matches` stores a "seeded deck order." If that table (or column) ever
  gets a naive select policy, any player can read upcoming card draws before they happen — worse
  than the past three cases because it corrupts a competitive economy, not a trivia answer.
  **Now substantially resolved by §3.1C's information model: the undrawn deck order is the *only*
  server-side secret in the whole match** — all other state (cash, ownership, mortgages,
  developments, action log) is deliberately public to room members, exactly as it is in the
  physical game. That collapses this from "many secrets to protect via RLS" to one narrow,
  clearly-labelled column, and §5's rule still applies on top (keep card/dice outcomes out of
  broadcast payloads; reveal one draw at a time). **Residual work:** that one column still needs a
  correct policy when the schema is written — it is not automatically safe, just far harder to get
  wrong now.

### High
- **Autopilot has no forced-forfeit ceiling.** §3's "conservative autopilot" never takes risks, so
  a cash-solvent absent player might never go bankrupt — meaning Classic mode's "ends when one
  non-bankrupt player remains" condition (§3) could never actually fire while they sit in
  autopilot. **Now decided (§3): 2 consecutive fully-autopiloted turns → forced retire**, matching
  richup's own proven answer to this exact problem rather than a mechanism invented from scratch.
- **Turn clock doesn't account for trades happening off-turn.** Trades are conventionally
  proposable/answerable at any time, not just during the proposer's own turn, but §3's clock is
  scoped to "the active player's turn." **Now largely resolved by the chess-clock decision (§3)
  plus §3.1E's pause rule**: since time is a per-player reserve rather than a shared per-turn
  window, answering a trade off-turn naturally draws on the responder's own reserve, and global
  phases (auctions) pause the active player's clock. **Residual:** whether a *trade* should also
  pause the active player's clock the way an auction does is still unspecified — decide when
  Slice 5 is built, with real feel to test against.
- **No rate-limiting mentioned for the new command RPCs.** Every other player-triggered write in
  this codebase is rate-limited (five separate migrations: `0011`, `0025`, `0030`, `0033`,
  `0038`). **Resolved direction (§5): apply the same `*_attempts` table + `BEFORE INSERT` trigger
  pattern** to `roll`/`buy`/`bid`/`trade_accept`/`build`.

### Medium
- **Likely denormalization drift**: §2.3's `city_match_players` "properties summary" duplicates
  what `city_assets.owner` already states authoritatively. **Resolved (§3.1G): drop the field
  entirely** — derive ownership at read time, compute net worth rather than storing it, with a
  single deliberate exception for the immutable `final_net_worth` snapshot at match end.
- **Trade offers have no stated staleness rule.** **Resolved (§3.1F): re-validate every referenced
  asset and both parties' cash inside the accepting transaction — never trust the stored offer
  row** — plus proactive `superseded` marking for UI, and a defined expiry.
- **Revision number vs. row locking — two mechanisms proposed for one job.** **Resolved (§5): this
  codebase's actual established answer is `pg_advisory_xact_lock` keyed per match (migration
  `0029`'s pattern) — no client-tracked revision column needed on `city_matches`.**
- **No abandoned-match cleanup policy.** This repo has a strong, consistent existing convention
  for exactly this (`cleanup_inactive_rooms()` pg_cron job, 2h-inactivity threshold, migration
  `0020`). **Now decided (§3): City-type rooms get their own longer inactivity threshold
  (suggested 24h, tunable) in that same cron, and `city_matches` does not cascade-delete on the
  standard 2h rule** — resolves the conflict with §3's "pauses durably" proposal without a new
  subsystem.
- **Unclear whether turn deadlines freeze during a full-disconnect pause.** **Resolved by
  §3.1B's principle**: autopilot may consume only per-turn free thinking time and never the
  player's personal reserve, and a fully-paused match has no active clock to burn — so nobody can
  lose their earned reserve to a disconnection they didn't cause. Implement the pause as a genuine
  clock stop, not a wall-clock deadline that keeps running.

### Low
- Timed mode's net-worth formula. **Resolved (§3.1H):** cash + unmortgaged at full price +
  mortgaged at 45% + developments at full build cost.
- The turn state machine's "required decision" step. **Resolved (§3.1A):** exactly three
  mandatory situations (detention exit, buy-or-decline, raise funds); everything else optional,
  with a defined safe default on each timeout.
- **End-of-game recap screen has no genre precedent** (§1c found none in richup or Rento) — not a
  design flaw exactly, but flagged so nobody assumes a "standard" recap screen exists to copy.
  §5/§4 suggest reusing Spintra's existing Scoreboard/XP system instead of inventing one.

---

## 8. Build plan / TODO

The ordered plan from here. **Owner tags:** `[USER]` = only the user can do or decide this;
`[AI]` = an AI session can do it; `[AI→USER]` = an AI can draft/decide it but the user should
confirm. Nothing below is started — no code, schema, or art exists yet.

### Phase 0 — Design completion (blocks everything else)

- `[USER]` **Review the board content draft** (`SPINTRA_CITY_CONTENT.md`) — especially the space
  names and the "Spins" currency name, since the whole board's tone hangs off them.
  **← the only remaining Phase 0 blocker.**
- `[x]` ~~Close the 4 remaining §3 gaps~~ — **done, §3.1A–C, H** (turn state machine's three
  mandatory decisions + per-phase timeout defaults; 60s reconnect grace with autopilot barred from
  spending the personal reserve; spectator/hidden-information model; net-worth formula).
- `[x]` ~~Design the auction flow~~ — **done, §3.1E** (ascending, 10-Spin floor/increment, 15s
  countdown resetting to 10s per bid, 2-minute cap, no bidding on credit, clock pauses).
- `[x]` ~~Design the bankruptcy/liquidation sequence~~ — **done, §3.1D** (one sequence serving
  insolvency, retire, forced retire, and mid-match kick; creditor-dependent resolution; one
  knowingly-flagged divergence from the classic rules — no auction cascade on bank bankruptcy).
- `[x]` ~~Resolve the 2 still-open §7 findings~~ — **done, §3.1F–G** (re-validate trades inside the
  accepting transaction; drop the denormalized properties summary entirely).
- `[USER]` **Decide the board art direction** — group colour palette (8 groups, must work in both
  light and dark per the site's existing theme-aware convention, **and must carry a non-colour
  identifier too — see §4.1**), token artwork, and the board render approach (SVG / CSS grid /
  canvas). See `SPINTRA_CITY_CONTENT.md` §10. *(Does not block schema work — can happen in
  parallel with Phase 1.)*
- `[AI→USER]` **Work through §4.1's gap audit.** Two items there are **Phase 1 blockers because
  they shape the schema itself**, not later polish: the **deterministic-randomness test seam**
  (without it, §8's whole verification plan is unexecutable) and **building supply limits**
  (finite vs. unlimited changes what `city_assets`/`city_matches` must track). The rest —
  accessibility, post-match flow, the missing `/tools` page, `classroomSafe`, deck reshuffle,
  detention detail, trade contents, action-log growth, analytics, sound, collusion, trademark —
  can be sequenced alongside the slices, but should be decided deliberately rather than discovered.

### Phase 1 — Schema & server commands (migration `0063`+)

- `[AI]` Design and write the DDL for the five `city_*` tables (§2.3), against the now-real board
  content — `city_assets` rows map directly to the content doc's 40-space table.
- `[AI]` RLS policies, with deliberate care on the deck-order leak risk (§7 Critical) — card/dice
  outcomes must never be selectable ahead of reveal.
- `[AI]` `is_seated_in_match()` helper, mirroring the existing `is_member_of_room()` convention.
- `[AI]` Command RPCs following the established conventions from §5: `auth.uid()`-derived identity,
  `pg_advisory_xact_lock` per match, `*_attempts` rate-limit triggers, explicit grant/revoke.
- `[AI]` Extend `rooms_type_check` to accept `'city'` — **must land before any `/create` UI change
  is testable against real Supabase.**
- `[AI]` Extend `cleanup_inactive_rooms()` with City's longer inactivity threshold (§3 decision).

### Phase 2+ — Implementation, as vertical slices

Deliberately sliced rather than built in one pass: this is by far the largest feature in the repo
(the other 14 games are small self-contained activities; this is a stateful economy with ~5 tables,
a dozen RPCs, and board/trade/auction UI). Each slice should be independently verifiable and
committed on its own.

- `[AI]` **Slice 1 — Room type, lobby, seats, match start.** No gameplay at all. Adds the `GAMES`
  entry, `RoomType`, `RAW_ROOM_TYPES`, the `RoomGameArea` branch, and `CityMatchShell`'s skeleton.
  **This slice is the real architectural proof** — it exercises the room-shell reuse, the RPC
  pattern, and realtime-as-notifier while course-correcting is still cheap. Do not skip ahead of it.
- `[AI]` **Slice 2 — Roll → move → land**, plus the board rendering. No buying.
- `[AI]` **Slice 3 — Buy / rent / bankruptcy.** The economic core.
- `[AI]` **Slice 4 — Development tiers + mortgaging.**
- `[AI]` **Slice 5 — Trading** (`city_trade_offers` + its UI).
- `[AI]` **Slice 6 — Auctions, detention, both card decks.**
- `[AI]` **Slice 7 — Timed mode, end-of-match recap, XP/Scoreboard integration** (§4 decision).

### Verification (per slice, not saved for the end)

- `[AI]` `npm run verify` clean; migrations applied against a **local Docker Supabase** first, never
  straight to production.
- `[AI]` Playwright coverage for the multiplayer loop, extended per slice.
- `[AI]` **Genuine multi-client concurrency testing** on the racy paths (simultaneous trade
  accepts, turn races, auction bids). This repo has a documented history of "verified live"
  meaning single-client checks that later missed real concurrency bugs — see `AI_CONTEXT.md`'s
  Session 61 notes. Treat concurrency here as a first-class test target, not a spot check.

### Documentation (at the end, per `START_HERE.md`)

- `[AI]` Retire this doc in favour of an ADR in `DECISIONS.md` (§2.2/§2.3 are already ADR-shaped),
  a new `ARCHITECTURE.md` section, and normal `TASKS.md`/`CHANGELOG_AI.md` entries.

---

## 9. Source of this document

Built up across three passes, none of which involved writing any code:
1. Transcribed directly from a design conversation the user had with an AI assistant *outside*
   this Claude Code session — the user pasted the transcript and asked for a handoff doc so a
   different AI model could continue.
2. A correction pass that actually checked richup.io (the first pass's claims about it had never
   been independently verified), finding and fixing one factual error.
3. A deep research pass (two parallel research agents) covering player-facing UX across richup.io
   and a second comparable product (Rento Fortune), plus a concrete, file-level integration plan
   produced by directly reading this repo's actual current code rather than inferring from
   `ARCHITECTURE.md`'s prose alone — which also surfaced one unrelated, pre-existing doc/code
   drift (the nonexistent `.glass`/`.glass-card` utility classes) along the way.

Fidelity to the original conversation was prioritized over polishing it into a cleaner spec in
pass 1, specifically so nothing gets silently upgraded from "proposed" to "decided" in the
handoff. Later passes add corrections and research inline rather than rewriting history, so the
provenance of every claim stays traceable.
