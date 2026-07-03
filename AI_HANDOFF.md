# AI_HANDOFF.md — Spintra Project
> **Portable handoff for Antigravity IDE, Claude Code, VS Code Agent, Cursor, Windsurf, Gemini CLI, or any AI coding assistant.**
> Last updated: 2026-07-03 (session ended — plan approved, execution NOT yet started)

---

## 1. Project Overview

**Spintra** is a real-time multiplayer party game and activity platform. Users create "rooms" (identified by a 6-character code), and all participants play games together in real time via Supabase Realtime.

- **Dev URL:** http://localhost:3000
- **Room URL pattern:** `/room/[code]` (e.g. `/room/3NJUZL`)
- **Host vs Participant:** The user who created the room is the "host" and controls which activity is active. Other users are participants.
- **14 games:** coin-flip, dice, lucky-wheel, guess-number, bingo, word-scramble, truth-or-dare, would-you-rather, never-have-i-ever, rps, team-maker, tournament, name-draw, trivia
- **2 room modes:** `party` (host picks any game), `classroom` (educational subset)

---

## 2. Current Architecture

### Room Client

```
/room/[code]/page.tsx                       Server component, passes code prop
/room/[code]/room-client.tsx                1,855-line Client component — main orchestrator
/room/[code]/context/
  room-activity-context.tsx                 React Context providing shared state to activities
/room/[code]/activities/
  activity-picker-dialog.tsx               Host-only dialog to switch games
  idle-screen.tsx                           Shown when no activity selected (single-game room)
  aggregate-idle-screen.tsx                 Shown when no activity selected (party/classroom room)
  lucky-wheel-activity.tsx                  MIGRATED — context-driven, no props
  bingo-activity.tsx                        MIGRATED — context-driven, no props
  guess-number-activity.tsx                 MIGRATED — context-driven, no props
  word-scramble-activity.tsx                MIGRATED — context-driven, no props
  coin-flip-activity.tsx                    LEGACY — prop-fed, uses onActivityEventRef
  dice-activity.tsx                         LEGACY — prop-fed, uses onActivityEventRef
  truth-or-dare-activity.tsx               LEGACY — prop-fed, uses onActivityEventRef
  would-you-rather-activity.tsx            LEGACY — prop-fed, uses onActivityEventRef
  never-have-i-ever-activity.tsx           LEGACY — prop-fed, uses onActivityEventRef
  rps-activity.tsx                         LEGACY — prop-fed, uses onActivityEventRef
  team-maker-activity.tsx                  LEGACY — prop-fed, uses onActivityEventRef
  tournament-activity.tsx                  LEGACY — prop-fed, uses onActivityEventRef
  name-draw-activity.tsx                   LEGACY — prop-fed, uses onActivityEventRef
  trivia-activity.tsx                      LEGACY — prop-fed, uses onActivityEventRef
```

### How Real-Time Events Work

1. Activity calls `sendActivityEvent({ kind: "coin_flip", result: "Heads" })`
2. Broadcasts to Supabase Realtime channel (or BroadcastChannel fallback for local dev without .env.local)
3. ALL room clients receive the broadcast and call `handleActivityEvent(payload)`
4. `handleActivityEvent` fans out to: (a) `onActivityEventRef.current` (legacy bridge), (b) all `listenersRef` subscribers
5. Migrated activities subscribe via `registerEventListener`; legacy activities receive state via props

### Current Context Shape

```ts
interface RoomActivityContextType {
  roomCode: string;
  roomType: RoomType;
  isHost: boolean;
  currentUser: User;
  participants: RoomParticipant[];
  supabase: SupabaseClient | null;           // UNUSED — to be removed (Step 2)
  getChannel: () => RealtimeChannel | null;  // UNUSED — to be removed (Step 2)
  sendActivityEvent: (event: ActivityEvent) => void;
  registerEventListener: (listener: (event: ActivityEvent) => void) => () => void;
}
```

### Legacy Bridge (lines 325–397 of room-client.tsx — to be deleted in Step 4)

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
onActivityEventRef.current = (event: any) => {
  const { kind } = event;
  switch (kind) {
    case "coin_flip": setCoinResult(event.result); setCoinFlipping(false); break;
    case "dice_roll": setDiceResults(event.results); setDiceRolling(false); break;
    // ... 18 more cases for all 10 legacy activities
    case "activity_reset": /* resets all 10 games state at once */ break;
  }
};
```

---

## 3. Technologies Used

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.9 | Framework (App Router, RSC) |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Type safety |
| Supabase JS | ^2.108.2 | Realtime, DB, anonymous auth |
| Framer Motion | ^12.40.0 | Animations, AnimatePresence |
| Tailwind CSS | ^4 | Styling |
| Three.js / R3F | ^0.184 / ^9.6 | 3D lucky wheel rendering |
| canvas-confetti | ^1.9.4 | Win celebrations |
| Zustand | ^5.0.14 | Available but not yet used in room |
| lucide-react | ^1.21.0 | Icons |
| shadcn/ui | various | UI primitives (Button, Badge, Dialog, etc.) |
| Playwright | ^1.40.0 | E2E tests |

**Scripts:**
```bash
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test:smoke # playwright e2e tests
```

---

## 4. Current Progress

### Session 1-2: Foundation & Bug Fixes (COMPLETE)
- Fixed hydration mismatch: isHost gated behind hasMounted state
- Fixed is_online presence: users update is_online=false on beforeunload/pagehide/unmount
- Added host self-healing presence: host batch-updates stale rows on disconnect detection
- Added DB migration 0007_allow_host_update_participants.sql

### Session 3: Activity Improvements (COMPLETE)
- Fixed biased shuffle in Bingo, Trivia, WordScramble: sort(() => Math.random()) replaced with shuffleArray (Fisher-Yates)
- Added shuffleArray<T>(arr: T[]): T[] to src/lib/utils.ts
- Added fireConfetti() on wins in all 4 migrated activities
- Added AnimatePresence on chat messages and participant list entries

### Session 4: Modular Architecture Partial (COMPLETE — 4 of 14 activities)
- Created src/app/room/[code]/context/room-activity-context.tsx
- Migrated: lucky-wheel, bingo, guess-number, word-scramble to zero-prop context pattern
- Added listenersRef, registerEventListener, handleActivityEvent to room-client.tsx
- Converted 4 static imports to next/dynamic with ssr: false
- Added RoomActivityContext.Provider wrapping game render area
- VERIFIED: npm run build passes, 22 pages, 0 errors, 0 warnings

---

## 5. Files Changed

### MODIFIED: src/lib/utils.ts
Added: `shuffleArray<T>(arr: T[]): T[]` — Fisher-Yates unbiased shuffle

### NEW: supabase/migrations/0007_allow_host_update_participants.sql
RLS policy allowing host to UPDATE other participants rows (needed for presence healing)

### NEW: src/app/room/[code]/context/room-activity-context.tsx
RoomActivityContextType, RoomActivityContext, useRoomActivity() hook
NOTE: supabase and getChannel fields will be removed in Step 2

### MODIFIED: src/app/room/[code]/room-client.tsx
Added: listenersRef, registerEventListener, handleActivityEvent, RoomActivityContext.Provider
Added: next/dynamic for 4 activities
STILL CONTAINS LEGACY: static imports lines 29-38, game useState lines 136-157, onActivityEventRef line 177, switch block lines 325-397, conditional JSX blocks

### MIGRATED (zero-prop, context-driven):
- src/app/room/[code]/activities/lucky-wheel-activity.tsx
- src/app/room/[code]/activities/bingo-activity.tsx
- src/app/room/[code]/activities/guess-number-activity.tsx
- src/app/room/[code]/activities/word-scramble-activity.tsx

### UNCHANGED (still legacy prop pattern):
- src/app/room/[code]/activities/coin-flip-activity.tsx
- src/app/room/[code]/activities/dice-activity.tsx
- src/app/room/[code]/activities/truth-or-dare-activity.tsx
- src/app/room/[code]/activities/would-you-rather-activity.tsx
- src/app/room/[code]/activities/never-have-i-ever-activity.tsx
- src/app/room/[code]/activities/rps-activity.tsx
- src/app/room/[code]/activities/team-maker-activity.tsx
- src/app/room/[code]/activities/tournament-activity.tsx
- src/app/room/[code]/activities/name-draw-activity.tsx
- src/app/room/[code]/activities/trivia-activity.tsx

---

## 6. Pending Work — The Approved 5-Step Plan

### INDUSTRY PATTERNS USED:
1. Strangler Fig — incremental migration, app stays working at every step
2. Plugin Registry — activity-registry.ts maps type->component, one file to add new games
3. Pub/Sub Event Bus — registerEventListener/sendActivityEvent, decoupled routing
4. Stable Context Separation — split stable vs dynamic context, prevents cascade re-renders

---

### STEP 1: Typed Event Discriminated Union [MODIFY src/lib/types.ts]

Replace line 12 (`export type ActivityEvent = Record<string, unknown> & { kind: string }`) with:

```ts
type CoinFlippingEvent    = { kind: "coin_flipping" };
type CoinFlipEvent        = { kind: "coin_flip"; result: "Heads" | "Tails" };
type DiceRollingEvent     = { kind: "dice_rolling" };
type DiceRollEvent        = { kind: "dice_roll"; results: number[] };
type TodPromptEvent       = { kind: "tod_prompt"; promptType: "truth" | "dare"; text: string };
type WyrPromptEvent       = { kind: "wyr_prompt"; a: string; b: string };
type WyrVoteEvent         = { kind: "wyr_vote"; userId: string; username: string; option: "A" | "B" };
type NhiePromptEvent      = { kind: "nhie_prompt"; text: string };
type NhieConfessEvent     = { kind: "nhie_confess"; userId: string; username: string; choice: "have" | "never" };
type RpsChoiceEvent       = { kind: "rps_choice"; userId: string; username: string; choice: string };
type RpsResetEvent        = { kind: "rps_reset" };
type TmTeamsEvent         = { kind: "tm_teams"; teams: { name: string; members: string[] }[] };
type NdWinnerEvent        = { kind: "nd_winner"; winner: string };
type TriviaQuestionEvent  = { kind: "trivia_question"; text: string; options: string[]; correctIndex: number; num: number };
type TriviaAnswerEvent    = { kind: "trivia_answer"; userId: string; username: string; choiceIndex: number; correct: boolean };
type ActivityResetEvent   = { kind: "activity_reset" };

export type ActivityEvent =
  | CoinFlippingEvent | CoinFlipEvent
  | DiceRollingEvent  | DiceRollEvent
  | TodPromptEvent
  | WyrPromptEvent    | WyrVoteEvent
  | NhiePromptEvent   | NhieConfessEvent
  | RpsChoiceEvent    | RpsResetEvent
  | TmTeamsEvent      | NdWinnerEvent
  | TriviaQuestionEvent | TriviaAnswerEvent
  | ActivityResetEvent
  | (Record<string, unknown> & { kind: string }); // catch-all: wheel/bingo/scramble/guess
```

Verify: `npm run typecheck` passes.

---

### STEP 2: Split Context + Activity Registry [MODIFY context + NEW registry]

#### 2a. Modify src/app/room/[code]/context/room-activity-context.tsx

Replace entire file with two contexts:

```ts
"use client";
import { createContext, useContext } from "react";
import type { User, RoomParticipant, ActivityEvent, RoomType } from "@/lib/types";

// STABLE — memoized, never changes after mount
export interface RoomActivityContextType {
  roomCode: string;
  roomType: RoomType;
  isHost: boolean;
  currentUser: User;
  sendActivityEvent: (event: ActivityEvent) => void;
  registerEventListener: (fn: (event: ActivityEvent) => void) => () => void;
}

// DYNAMIC — only participants list
export interface RoomParticipantsContextType {
  participants: RoomParticipant[];
}

export const RoomActivityContext = createContext<RoomActivityContextType | null>(null);
export const RoomParticipantsContext = createContext<RoomParticipantsContextType | null>(null);

export function useRoomActivity() {
  const ctx = useContext(RoomActivityContext);
  if (!ctx) throw new Error("useRoomActivity must be used within RoomActivityContext.Provider");
  return ctx;
}

export function useRoomParticipants() {
  const ctx = useContext(RoomParticipantsContext);
  if (!ctx) throw new Error("useRoomParticipants must be used within RoomParticipantsContext.Provider");
  return ctx;
}
```

#### 2b. Create src/app/room/[code]/activities/activity-registry.ts (NEW FILE)

```ts
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const ACTIVITY_REGISTRY: Record<string, ComponentType> = {
  "coin-flip":         dynamic(() => import("./coin-flip-activity").then(m => m.CoinFlipActivity),         { ssr: false }),
  "dice":              dynamic(() => import("./dice-activity").then(m => m.DiceActivity),                  { ssr: false }),
  "lucky-wheel":       dynamic(() => import("./lucky-wheel-activity").then(m => m.LuckyWheelActivity),     { ssr: false }),
  "guess-number":      dynamic(() => import("./guess-number-activity").then(m => m.GuessNumberActivity),   { ssr: false }),
  "bingo":             dynamic(() => import("./bingo-activity").then(m => m.BingoActivity),                { ssr: false }),
  "word-scramble":     dynamic(() => import("./word-scramble-activity").then(m => m.WordScrambleActivity), { ssr: false }),
  "truth-or-dare":     dynamic(() => import("./truth-or-dare-activity").then(m => m.TruthOrDareActivity),  { ssr: false }),
  "would-you-rather":  dynamic(() => import("./would-you-rather-activity").then(m => m.WouldYouRatherActivity), { ssr: false }),
  "never-have-i-ever": dynamic(() => import("./never-have-i-ever-activity").then(m => m.NeverHaveIEverActivity), { ssr: false }),
  "rps":               dynamic(() => import("./rps-activity").then(m => m.RpsActivity),                   { ssr: false }),
  "team-maker":        dynamic(() => import("./team-maker-activity").then(m => m.TeamMakerActivity),       { ssr: false }),
  "tournament":        dynamic(() => import("./tournament-activity").then(m => m.TournamentActivity),      { ssr: false }),
  "name-draw":         dynamic(() => import("./name-draw-activity").then(m => m.NameDrawActivity),         { ssr: false }),
  "trivia":            dynamic(() => import("./trivia-activity").then(m => m.TriviaActivity),              { ssr: false }),
};
```

Also update room-client.tsx providers:
```tsx
// Wrap game area with BOTH providers
<RoomActivityContext.Provider value={stableCtxValue /* useMemo */}>
  <RoomParticipantsContext.Provider value={{ participants }}>
    {/* ... */}
  </RoomParticipantsContext.Provider>
</RoomActivityContext.Provider>
```

Verify: `npm run typecheck` passes.

---

### STEP 3: Migrate All 10 Remaining Activities [MODIFY 10 files]

For EACH of the 10 legacy activities, apply this pattern:

```ts
// REMOVE: the Props interface entirely
// REMOVE: function signature with props
// ADD: import { useRoomActivity } from "../context/room-activity-context"
// ADD (for team-maker, tournament, name-draw only): import { useRoomParticipants }
// ADD: const { isHost, currentUser, sendActivityEvent, registerEventListener } = useRoomActivity();
// ADD: const { participants } = useRoomParticipants(); // only where needed
// ADD: local state with useState for game-specific state
// ADD: useEffect(() => registerEventListener((event) => { ... }), [registerEventListener])
// REMOVE: all `if (onActivityEventRef.current) onActivityEventRef.current(...)` calls

// Example for coin-flip:
export function CoinFlipActivity() {
  const { isHost, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [coinResult, setCoinResult] = useState<"Heads" | "Tails" | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  useEffect(() => registerEventListener((event) => {
    if (event.kind === "coin_flip")      { setCoinResult((event as { result: "Heads"|"Tails" }).result); setCoinFlipping(false); }
    if (event.kind === "coin_flipping")  { setCoinFlipping(true); }
    if (event.kind === "activity_reset") { setCoinResult(null); setCoinFlipping(false); }
  }), [registerEventListener]);
  // ...JSX unchanged...
}
```

SPECIAL CASES:
- team-maker-activity.tsx: add `useRoomParticipants()`, fix `sort(() => Math.random() - 0.5)` to `shuffleArray`
- tournament-activity.tsx: add `useRoomParticipants()`, fix same biased shuffle
- name-draw-activity.tsx: add `useRoomParticipants()`

Verify after each file: `npm run typecheck`. Verify after all 10: `npm run build`.

---

### STEP 4: Gut room-client.tsx [MODIFY room-client.tsx]

ONLY after Step 3 passes typecheck and build.

DELETE from room-client.tsx:
- Lines 29-38: static imports for 10 legacy activities
- Lines 136-157: ~20 game useState declarations (coinResult, diceResults, todPrompt, wyrPrompt, wyrVotes, nhiePrompt, nhieConfessions, rpsChoices, tmTeams, ndWinner, triviaQuestion, triviaAnswers, coinFlipping, diceRolling)
- Line 177: `const onActivityEventRef = ...`
- Lines 325-397: entire `onActivityEventRef.current = (event: any) => { switch(kind) { ... } }` block
- Lines 185-190: the call to `onActivityEventRef.current` inside `handleActivityEvent`
- All conditional JSX blocks like `{activeActivity?.type === "coin-flip" && <CoinFlipActivity isHost={...} ... />}`

ADD to room-client.tsx:
```tsx
// Import registry
import { ACTIVITY_REGISTRY } from "./activities/activity-registry";

// Replace 15 JSX blocks with:
const ActiveGame = activeActivity?.type
  ? (ACTIVITY_REGISTRY[activeActivity.type] ?? null)
  : null;

// In JSX:
{ActiveGame && <ActiveGame key={activeActivity!.type} />}
```

ADD ErrorBoundary around ActiveGame:
```tsx
// Create a simple ErrorBoundary component or import one
// Wrap: <ErrorBoundary fallback={<ActivityError />}>{ActiveGame && <ActiveGame ... />}</ErrorBoundary>
```

UPDATE room-client.tsx context provider:
- Change single RoomActivityContext.Provider to nested Stable + Dynamic providers
- memoize stableCtxValue with useMemo

Verify: `npm run typecheck && npm run lint && npm run build`

---
### STEP 5: Update 4 Already-Migrated Activities to Typed Events [MODIFY 4 files]

Update event handlers in lucky-wheel, bingo, guess-number, word-scramble to use typed discriminated union field access instead of `event as any` patterns.

## 7. Current State

WHERE WE STOPPED: Refactoring of all 14 activities completed, and Trivia Question Bank expanded to 50 questions with host filters.

LAST COMPLETED: Session 7 (Trivia database expansion and host settings dropdown selectors).

NEXT IMMEDIATE ACTION: No active tasks. Wait for new directions or roadmap issues.

DEPENDENCIES: None.

---

## 8. Important Context

### Conventions
- All activity components are NAMED exports (not default)
- "use client" at top of every activity file
- useEffect cleanup: always return the deregister function from registerEventListener
- useCallback on stable functions passed to context
- No `as any` without a comment

### Database
- Tables: rooms, room_participants, chat_messages, users
- Auth: Supabase anonymous auth, auth.uid() returns UUID as text
- Room primary key: 6-char code string (NOT UUID)
- Latest migration: 0007_allow_host_update_participants.sql

### Key Utilities
- `shuffleArray<T>()` in src/lib/utils.ts — Fisher-Yates, use instead of .sort(() => Math.random())
- `fireConfetti()` in src/components/celebration.tsx — call on game wins
- `getSupabaseBrowserClient()` returns null without .env.local (local dev fallback uses BroadcastChannel)

### Supabase Remote
- Connection: postgresql://postgres.qjxaehxwuqntyqrdmihs:57AFDvzvLn4C9VFO@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
- Password: 57AFDvzvLn4C9VFO

---

## 9. Verification

### Already Tested
- npm run typecheck: PASS (0 errors)
- npm run lint: PASS (0 warnings)
- npm run build: PASS (22 pages, 0 errors, 14 dynamically split game chunks)

### Still Needs Testing
- npm run test:smoke after deployment or in staging (Playwright smoke tests)

---

## 10. Resume Instructions for Another AI

The refactoring plan has been fully implemented, verified, and compiled. 

QUICK ORIENT:
- Review the `/docs` folder for detailed rules, architecture patterns, and context.
- Refer to `docs/AI_CONTEXT.md` for any future tasks or roadmap directions.

ENVIRONMENT:
- OS: Windows, Shell: PowerShell
- Working dir: c:\Users\tejas\Desktop\Spintra-1
- Dev server: npm run dev
