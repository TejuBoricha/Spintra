# AI_CONTEXT.md — Spintra Project Living Memory
> The authoritative source of truth for the current state of the project.
> **Always update this file after every significant milestone.**
> Last updated: 2026-07-03T19:34 IST

---

## Project Summary

**Spintra** is a real-time multiplayer party game and activity platform built with Next.js 16 (App Router), React 19, TypeScript, and Supabase Realtime. Users create "rooms" via a 6-character code; all participants play 14 different games together in real time.

**Stack:** Next.js 16.2.9 · React 19 · TypeScript · Supabase (Realtime + DB + Auth) · Framer Motion · Tailwind CSS 4 · Three.js/R3F (for lucky wheel) · canvas-confetti · shadcn/ui

---

## Current Completion Status

```
Phase 1 — Foundation & Bugs     ████████████ 100%  COMPLETE
Phase 2 — Activity Improvements ████████████ 100%  COMPLETE
Phase 3 — Modularisation        ████████████ 100%  COMPLETE (14/14 activities)
Phase 4 — Full Gut of root      ████████████ 100%  COMPLETE
```

**Overall project health:** ✅ Builds clean · ✅ 0 TypeScript errors · ✅ 0 ESLint warnings

---

## Active Branch

Unknown (not tracked in sessions). Assume `main` unless the user specifies otherwise.

---

## Features Completed

### Core Platform
- ✅ Room creation and join flow (`/create`, `/room/[code]`)
- ✅ Supabase anonymous auth (`signInAnonymously`)
- ✅ Real-time presence via Supabase Realtime channel
- ✅ BroadcastChannel fallback for local dev without `.env.local`
- ✅ Room lock/unlock (host-only)
- ✅ Host-controlled activity switching
- ✅ Chat with emoji reactions
- ✅ Mobile sidebar with sheet
- ✅ Participant list with online/offline status
- ✅ Room close (host-only, with confirmation dialog)
- ✅ Confetti on wins (`fireConfetti()`)
- ✅ AnimatePresence on chat messages and participant entries
- ✅ Tools pages for all 14 games at `/tools/[slug]`
- ✅ Explore page, Home page
- ✅ Dynamic Trivia Question Bank (50 questions, categorized, with host category & difficulty filters and non-repeat shuffler)
- ✅ GitHub Actions CI Pipeline (npm audit, typescript typecheck, eslint code lint, production build verification, Playwright E2E smoke tests)
- ✅ Dynamic Prompt Migration (Truth or Dare, Would You Rather, Never Have I Ever statements loaded dynamically from Supabase schemas)

### Bugs Fixed
- ✅ **Hydration mismatch** — `isHost` is now gated behind `hasMounted` state
- ✅ **is_online presence** — updates to `false` on `beforeunload` / `pagehide` / unmount
- ✅ **Host self-healing presence** — host batch-updates stale rows on disconnect detection
- ✅ **Biased shuffle** — replaced `sort(() => Math.random() - 0.5)` with Fisher-Yates `shuffleArray` in Bingo, Trivia, WordScramble, TeamMaker, and Tournament
- ✅ **Chat message duplication** — resolved optimistic local echo duplications by matching database and client UUID layouts, and comparing parsed datetime integers robustly

### DB Migrations Applied
- ✅ `0001` — init schema and RLS
- ✅ `0002` — room close cascade
- ✅ `0003` — disable RLS for realtime delete
- ✅ `0004` — foreign keys and composite indexes
- ✅ `0005` — enable anonymous auth RLS
- ✅ `0006` — allow host promotion update
- ✅ `0007` — allow host to update participants rows (needed for presence healing)
- ✅ `0008` — create and seed public activity prompts table (Truth or Dare, Would You Rather, Never Have I Ever)

### Modularisation (Complete — 14/14)
- ✅ Created `RoomActivityContext` (stable) and `RoomParticipantsContext` (dynamic) to split state re-renders
- ✅ Created `ACTIVITY_REGISTRY` plugin registry for dynamically loading activities
- ✅ Added `ErrorBoundary` around active game to isolate crashes
- ✅ Migrated all 14 activities to zero-prop context patterns

---

## Features In Progress

None.

---

## Remaining Roadmap (Future Sessions — Not Approved Yet)

- Add visual scoreboard / leaderboard for trivia
- Tournament bracket UI (currently just shows matches as a list)
- Add XP reward system when users win games
- Improve mobile layout for game activities
- Add room share link / QR code
- Add room settings panel (max participants, time limits)
- Investigate Zustand for game state (noted as available but unused)

---

## Current Objective

Trivia bank expansion and host filters are successfully completed.
**Ready for new goals or feature requests.**

---

## Exact Point Where Development Stopped

Session completed with the Trivia activity enhancements fully executed.
- Build status: SUCCESS
- Typecheck: PASS (0 errors)
- Linter: PASS (0 warnings)

---

## Next Task to Perform

No immediate active tasks. Wait for new instructions or feature requests (e.g., visual scoreboard for trivia or tournament bracket visual tree rendering).

---

## Known Issues

None identified.

---

## Technical Debt

- Trivia question bank is static file — could be migrated to a database table if dynamic administrative editing is needed.
- Tournament activity shows bracket as a flat list, not a visual bracket tree
- No pagination on chat messages — could get very long in active rooms
- `generateId()` in `room-client.tsx` (line 47) uses `Math.random()` — could collide for message IDs
- Several activities have static prompt lists hardcoded (Truth or Dare, WYR, NHIE) — should be database-driven

---

## Backend Status

- **Supabase Project:** Active (remote)
- **Connection:** configured via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — never record the raw database connection string or password here; treat this file as version-controlled and world-readable.
- **Auth:** Anonymous sign-ins enabled
- **Realtime:** Broadcast channel per room (`room_{code}`)
- **RLS:** Enabled on all tables. Latest policy: `0007_allow_host_update_participants`
- **Migrations:** All 7 applied. No new migrations needed for the 5-step plan.

---

## Database Status

### Tables
| Table | Purpose |
|---|---|
| `rooms` | Room metadata (code, name, type, host_id, is_locked, max_participants) |
| `room_participants` | Per-user room membership (user_id, role, is_online, joined_at) |
| `chat_messages` | Room chat (user_id, content, created_at) |
| `users` | User profiles (username, avatar_url, xp, rank) |

**Primary key for rooms:** `code` (6-char string, NOT UUID)
**Auth ID type:** UUID returned as text from `auth.uid()::text`

---

## Frontend Status

- **Framework:** Next.js 16.2.9 App Router — all pages use RSC where possible; only room client is a full client component
- **Styling:** Tailwind CSS 4 + custom CSS in `src/app/globals.css` (`glass`, `glass-card` utility classes)
- **Animations:** Framer Motion 12 — used extensively for enter/exit and game animations
- **UI components:** shadcn/ui (`Button`, `Badge`, `Dialog`, `Sheet`, `Input`, `ScrollArea`, `Tooltip`, `Avatar`)
- **Icons:** lucide-react ^1.21

---

## APIs Implemented

- **Supabase Realtime** — broadcast channel for activity events and activity switching
- **Supabase Realtime** — presence channel for participants
- **Supabase DB** — rooms, participants, chat messages via `@supabase/supabase-js`
- **BroadcastChannel** (Web API) — local fallback when Supabase is not configured

No custom REST or GraphQL APIs. All communication is via Supabase Realtime.

---

## Recent Architectural Changes

### Session 5 & 6 (Full Modularisation)
1. **Dynamic Import Registry:** Replaced monolithic switch case loops in `room-client.tsx` with a single centralized plugin registry mapping game types to dynamic React imports.
2. **Re-render Optimization:** Split context hook into stable parameters (`RoomActivityContext`) and dynamic rosters (`RoomParticipantsContext`) to prevent game panel re-renders when participants enter/leave.
3. **Class-based ErrorBoundary:** Wrapped the dynamic active game view inside a localized ErrorBoundary to isolate crashes.
4. **Discriminated Union Event Types:** Fully typed all 14 multiplayer game broadcast payloads inside `src/lib/types.ts`.

### Session 7 (Trivia Expansion & Chat Duplicate Hotfix)
1. **Categorized Trivia Bank:** Expanded the hardcoded trivia question collection to a 50-card local database with Category and Difficulty properties.
2. **Host Settings Dropdowns:** Created interactive category/difficulty selectors for the Host to filter questions before launching trivia rounds.
3. **duplicate Prevention shuffler:** Handled question reuse within session decks using local ledger index lists sorted by the Fisher-Yates helper.
4. **Chat Echo Duplicate Fix:** Synced client-generated UUID message IDs directly to database inserts, and compared parsed timestamp milliseconds (`.getTime()`) to filter optimistic local echoes correctly.

---

## Architectural Decisions

All detailed architectural choices and justifications (e.g. Strangler Fig migration, Stable/Dynamic Context separation, Lazy registries, Event Bus, UUID chat message syncing) are documented in detail inside the [Architecture Decisions log (ADR)](file:///c:/Users/tejas/Desktop/Spintra-1/docs/DECISIONS.md). Please refer to it before making design modifications.
