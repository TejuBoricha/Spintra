# Wave 4: full-screen Spintra City layout — impact assessment (draft, read-only research)

Status (updated 2026-09-29, end of day): **step 1 is built** (branch `claude/loving-noether-1iz9ku`, no PR yet; see `TASKS.md`); steps 2 and 3 are not started. The rest of this page is the original assessment, kept as the plan. Merge policy: the assistant does not merge a wave 4 PR until the owner has looked at its Vercel preview.

## What the code does today (read, not guessed)

- `room-client.tsx:877`: `min-h-screen flex flex-col md:flex-row`. Left: `RoomHeader` + `RoomGameArea` (padding, `overflow-y-auto`). Right (md+): a fixed `md:w-80` chat/people sidebar that sits in the page flow (no viewport height) -> R-13.
- `city-match-shell.tsx:545`: the match view is one `max-w-5xl` column, stacked top to bottom: banners, seat badges + turn countdown + Retire, error, **board**, **dice**, **action buttons**, auction, holdings, trade, activity feed, status line.
- `city-board.tsx:324`: the board is a **fixed `w-175` (700px)** square inside an `overflow-x-auto` wrapper. Its own comment explains why: at 700px every city name (longest: "Melbourne") still sets on one line, and a fluid width once pushed the top row off screen. That comment is the main design constraint: **scaling the board means scaling or changing the tile text**.
- Result (already measured in the 26 Sep playtest): Roll / End turn / holdings / trades / feed / chat are below the fold on every laptop size (C-19); 24% of a 1080p screen is board (C-30); 248px of the board is cut off on a portrait iPad (C-31); phones scroll sideways (C-3); dice paint over the board (C-17).

## Proposal (client only, no migration, no server change)

Three PRs, each shippable and revertible on its own, in this order:

1. **Responsive board + board-centre HUD** (C-3, C-17, C-13, part of C-26). Replace `w-175` with a width from the container (`aspect-square`, container query units so text scales with the board). Move the dice, the Roll / End turn / Roll again / Buy / Pass row, the turn banner and the countdown into the empty 530x530 board centre. Mark "You" on your seat badge and token. Small tiles (phones) show colour, flag and price only; tapping a tile opens a detail panel (this is C-12, and it is what makes the smaller text acceptable).
2. **Desktop/tablet three-zone layout** (C-19, C-30, C-31, C-18 part 1). At >= ~1024px and landscape tablets: player panel left (all seats with cash and +/- changes, my holdings), board centre sized to `min(available width, 100dvh - header)`, tabbed panel right (Activity | Trade | Holdings | Chat). No page scroll. Portrait tablet and phone: board full width, the same tabs below it, action row sticky at the bottom.
3. **Chat and ledger** (R-13, C-18 part 2). A viewport-height sidebar with the input pinned (or the Chat tab above replacing it in City rooms), and the per-player money ledger built from the events C-10 now records (must add up to the database's cash).

## Impact assessment (AGENTS.md format)

- **Risk:** Medium (client-only, but it is the whole City screen, and layout is subjective).
- **Blast radius:** every City player on every device. PR 3 can touch the shared room sidebar used by all game types (Trivia, tools...), so it must be scoped to City rooms (a prop / `roomType` branch) unless the owner wants the sidebar change everywhere. No effect on non-City rooms for PRs 1-2.
- **Dependencies:** none server-side. C-10 (done) supplies the data for the ledger. `city-board.tsx`, `city-match-shell.tsx`, `city-dice.tsx`, `city-activity-feed.tsx`, `city-holdings.tsx`, `city-trade.tsx`, `room-client.tsx`, `room-sidebar.tsx`.
- **Tests at risk:** 11 e2e specs assert on viewport, overflow or bounding boxes (qa-x6 devices/tap targets, qa-x9 layout, qa-x20 R-15 scroll, qa-x19...); most City specs locate by role/name, which should survive if buttons keep their labels. They will need updating where they assume the old stacking.
- **Alternatives considered:** (A) only make the board fluid (cheapest, but leaves the fold problem and the empty centre); (B) the three-PR plan above (recommended); (C) a separate full-screen "game mode" route (cleanest layout, but duplicates realtime wiring and breaks room chat/people/host controls).
- **Validation:** Playwright at the 8 screen sizes from the audit (no page scroll at desktop sizes; Roll / End turn inside the viewport; board fully visible; no horizontal overflow on phones); the full suite; a screenshot set per PR; and the **Vercel preview URL** on each PR so you can judge it by eye (I can't judge feel from screenshots).
- **Docs:** ARCHITECTURE (client layout), TASKS, HANDOFF, AI_CONTEXT, CHANGELOG_AI; audit page statuses.
- **Rollback:** revert the PR (client only).

## Decisions I'd default unless you say otherwise

- Chat becomes a tab in the City layout on desktop (and stays a slide-over sheet on phones), instead of a separate column.
- Tile detail on tap for small screens (C-12) ships with PR 1.
- Sound (C-24), celebrations (C-27), card reveals (C-28) and player colours (C-29) stay in wave 6, not here.

## Open questions

1. Is a fixed minimum board size (say 520px) acceptable, with a scroll wrapper below that, or must phones always fit the whole board? (I'd scale everything and use tap-for-detail.)
2. Do you want to review PR 1's Vercel preview before I start PR 2? (I'd suggest yes: it is the riskiest visual change.)
