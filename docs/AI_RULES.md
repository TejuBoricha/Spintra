# AI_RULES.md — Spintra AI Collaboration Rules
> **MANDATORY.** Every AI assistant (Antigravity, Claude Code, VS Code Agent, Cursor, Windsurf, Gemini CLI, or any other) MUST follow these rules before, during, and after any work on this project.
> Last updated: 2026-07-03

---

## BEFORE You Write a Single Line of Code

### 1. Read These Files First — In This Order
```
1. docs/AI_CONTEXT.md      ← Current state, active task, what's done, what's next
2. docs/ARCHITECTURE.md    ← How and why the project is built this way
3. docs/CHANGELOG_AI.md    ← What every previous AI session did
4. AI_HANDOFF.md           ← Resume instructions and exact stopping point
```
If you skip any of these, you WILL repeat completed work, break existing patterns, or make decisions that contradict the established architecture.

### 2. Confirm What Is Already Done
- Check `AI_CONTEXT.md` → "Current Completion Status" section.
- Check `CHANGELOG_AI.md` → Read the last 3 entries minimum.
- **Never implement something listed as already completed.**

### 3. Confirm What the Next Task Is
- Check `AI_CONTEXT.md` → "Next Immediate Task" section.
- Check `AI_HANDOFF.md` → "Next immediate action" section.
- These must agree. If they don't, treat `AI_CONTEXT.md` as the authority.

### 4. Understand the Architecture Before Designing Anything
- Do NOT introduce a new pattern if an existing pattern solves the problem.
- Do NOT install a new package without checking if functionality already exists.
- Do NOT create new files in locations that violate the established folder structure.
- Read `docs/ARCHITECTURE.md` → "Design Patterns" section before any structural change.

---

## DURING Development

### Coding Standards
- All activity components → **named exports** only (never default export)
- All client components → `"use client"` as first line
- All `useEffect` subscriptions → return the cleanup/deregister function
- All stable functions passed to Context → `useCallback` with correct deps
- No `as any` without a comment explaining why it's acceptable
- No `eslint-disable` without a comment explaining the exception
- Use `shuffleArray<T>()` from `src/lib/utils.ts` — never `.sort(() => Math.random() - 0.5)`
- Call `fireConfetti()` from `src/components/celebration.tsx` on game wins

### Architectural Consistency
- All new game activities → must be registered in `src/app/room/[code]/activities/activity-registry.ts`
- All new game activities → must have zero props (consume `useRoomActivity()` from context)
- All new game activities → must handle `activity_reset` event to clear their state
- All new game activities → must use `registerEventListener` (not `onActivityEventRef`)
- Context shape is defined in `src/app/room/[code]/context/room-activity-context.tsx` — do not duplicate it

### Naming Conventions
| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `CoinFlipActivity` |
| Files | kebab-case | `coin-flip-activity.tsx` |
| Activity event kinds | snake_case | `coin_flip`, `activity_reset` |
| Game type slugs | kebab-case | `coin-flip`, `team-maker` |
| Custom hooks | camelCase, `use` prefix | `useRoomActivity` |
| Supabase table names | snake_case | `room_participants` |

### Change Scope Rules
- **Prefer improving existing code over rewriting** — if something works, don't touch it unless it's in the plan.
- **Keep changes modular** — a change to one activity file should not require changes to another.
- **Do not break working functionality** — run `npm run typecheck` after every file change.
- **Do not refactor outside the plan scope** — if you notice unrelated issues, document them in `AI_CONTEXT.md` under "Technical Debt" and continue.

### Verification After Every File Change
```bash
npm run typecheck    # run after every file change
npm run lint         # run after every step
npm run build        # run at the end of every major step
```
If `npm run typecheck` fails, fix it before touching the next file.

---

## AFTER Each Major Milestone

### Always Update These Three Files
After completing any step in the active plan, you MUST update:

```
1. docs/AI_CONTEXT.md
   → Update "Features in Progress", "Features Completed", "Next Immediate Task"

2. docs/CHANGELOG_AI.md
   → Append a new entry with: Date, Task, Files modified, Outcome

3. AI_HANDOFF.md
   → Update "Current State" and "Next immediate action" sections
```

Only update `docs/ARCHITECTURE.md` if the architecture itself changed (new pattern, new context shape, new folder, etc.).

---

## BEFORE Ending Your Session

Checklist — do not end the session without completing all of these:

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm run build` passes successfully
- [ ] `docs/AI_CONTEXT.md` reflects the latest project state
- [ ] `docs/CHANGELOG_AI.md` has a new entry for this session's work
- [ ] `AI_HANDOFF.md` "Next immediate action" is up to date
- [ ] No uncommitted important reasoning — if you made a significant architectural decision, document WHY in `AI_CONTEXT.md` → "Important Assumptions & Reasoning"
- [ ] The next AI can start working without re-analysing the whole codebase

---

## Hard Rules (Never Violate)

1. **Never delete migrations.** Database migrations are append-only. Never modify or remove an existing `.sql` file.
2. **Never commit credentials.** The Supabase password is in `AI_HANDOFF.md` for resume context only — it must NOT appear in any source file.
3. **Never add new games or features outside the active plan.** Scope creep destroys context. If you want to propose additions, add them to `AI_CONTEXT.md` → "Remaining Roadmap" for a future session.
4. **Never skip verification steps.** If the plan says run `npm run typecheck`, run it. Do not assume it passes.
5. **Never rewrite documentation from scratch.** Append to `CHANGELOG_AI.md`. Update (not replace) `AI_CONTEXT.md`. Merge into existing docs.
6. **Never change the execution order of the active plan.** Step 1 → 2 → 3 → 4 → 5. The order exists to prevent breaking changes.
7. **Never mark a step as complete until `npm run build` passes.**

---

## Quick Reference — Current Active Plan

The approved 5-step modularisation plan is in `AI_HANDOFF.md` (Section 6) and `AI_CONTEXT.md`.
Steps MUST be executed in order. None have been executed yet as of the last handoff.

```
Step 1 → Typed ActivityEvent discriminated union   [types.ts]
Step 2 → Split Context + Activity Registry         [context/ + new activity-registry.ts]
Step 3 → Migrate 10 remaining legacy activities    [10 activity files]
Step 4 → Gut room-client.tsx                       [room-client.tsx]
Step 5 → Update 4 already-migrated activities      [4 activity files]
```
