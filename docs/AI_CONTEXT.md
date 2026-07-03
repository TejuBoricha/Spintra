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

### Bugs Fixed
- ✅ **Hydration mismatch** — `isHost` is now gated behind `hasMounted` state
- ✅ **is_online presence** — updates to `false` on `beforeunload` / `pagehide` / unmount
- ✅ **Host self-healing presence** — host batch-updates stale rows on disconnect detection
- ✅ **Biased shuffle** — replaced `sort(() => Math.random() - 0.5)` with Fisher-Yates `shuffleArray` in Bingo, Trivia, WordScramble, TeamMaker, and Tournament

### DB Migrations Applied
- ✅ `0001` — init schema and RLS
- ✅ `0002` — room close cascade
- ✅ `0003` — disable RLS for realtime delete
- ✅ `0004` — foreign keys and composite indexes
- ✅ `0005` — enable anonymous auth RLS
- ✅ `0006` — allow host promotion update
- ✅ `0007` — allow host to update participants rows (needed for presence healing)

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
- **Connection:** `postgresql://postgres.qjxaehxwuqntyqrdmihs:57AFDvzvLn4C9VFO@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`
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

## Recent Architectural Changes (Session 4)

1. **Created `RoomActivityContext`** — shared context providing `isHost`, `currentUser`, `participants`, `sendActivityEvent`, `registerEventListener` to all activities
2. **Added Pub/Sub fan-out** — `listenersRef` (Set of callbacks) + `registerEventListener` + `handleActivityEvent` dispatcher in `room-client.tsx`
3. **Introduced lazy loading** — 4 activities now use `next/dynamic` with `ssr: false`
4. **Migrated 4 activities** to zero-prop pattern — they subscribe to events via `registerEventListener` and own their state locally
5. **Added `shuffleArray`** to `src/lib/utils.ts`

---

## Important Assumptions & Reasoning

### Why Strangler Fig (not big-bang rewrite)?
The app must remain functional at every step. A full rewrite of `room-client.tsx` in one commit would break the entire room experience. Incremental migration keeps the app shippable throughout.

### Why split Context into Stable + Dynamic?
A single context that includes `participants` causes every mounted activity to re-render when someone joins or leaves. With 14 activities potentially mounted, this is a significant unnecessary re-render budget. Only 3 activities (TeamMaker, Tournament, NameDraw) actually need the participants list.

### Why `key={activeActivity.type}` on the dynamic component?
Forces a full unmount+remount when the activity type changes, cleanly resetting all local state. This is intentional — it prevents stale state from the previous game bleeding into the next.

### Why BroadcastChannel fallback?
The project works with or without Supabase configured (useful for demos, local dev, or offline). `getSupabaseBrowserClient()` returns `null` when `.env.local` is absent; the fallback synchronises tabs on the same machine via `BroadcastChannel`.

### Why not Zustand for game state?
Zustand is installed but not used in rooms. The Pub/Sub + local state pattern is sufficient for per-activity state and avoids introducing a global store that would couple activities to each other.

### Why `shuffleArray` instead of `.sort()`?
`Array.prototype.sort(() => Math.random() - 0.5)` is statistically biased — some permutations are significantly more likely than others due to how comparison-based sort algorithms interact with random comparators. Fisher-Yates produces a provably uniform distribution.

### Why discriminated union for ActivityEvent?
The current `Record<string, unknown> & { kind: string }` type requires `as any` to read any field, suppressing the entire TypeScript safety net. The discriminated union lets TypeScript narrow the type automatically on `event.kind`, giving full IDE autocomplete and catching wrong field names at compile time.
