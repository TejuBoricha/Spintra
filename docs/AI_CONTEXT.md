# AI_CONTEXT.md — Spintra Project Living Memory
> The authoritative source of truth for the **current state** of the project — nothing else.
> Historical implementation details live in `CHANGELOG_AI.md`. Architecture, tech stack, and the
> DB schema live in `ARCHITECTURE.md`. Session-to-session handoff lives in `HANDOFF.md`. Backlog
> and roadmap live in `TASKS.md`. Do not duplicate those here — link to them instead.
> Always update this file after every significant milestone.
> Last updated: 2026-07-04T12:10 IST

---

## Current Milestone

Migrated all static activity content (Trivia questions and Word Scramble word banks) to dynamic, database-driven Supabase schemas with full offline BroadcastChannel fallbacks (Session 28).

---

## Overall Progress

All planned modularisation (14/14 activities), invite and QR sharing systems, realtime discovery feeds, client profile synchronizations, database-driven activity prompt migrations, security hardening, CI/dependency automation, and documentation-workflow work is complete. Build/lint/typecheck are clean. No known regressions.

---

## Current Objective

All room joining flows, discovery pages, profile state sync optimizations, database prompts migrations, and workflow rules are complete. Ready for new goals or feature requests.

---

## Current Focus

No area of the codebase is under active work right now. The user intends to publish the site live on the public internet once ready, so `TASKS.md`'s new High Priority "pre-launch hardening" tier (abuse/moderation controls, rate limiting, legal basics, error monitoring) takes precedence over the Medium Priority engagement features (visual scoreboard, tournament bracket UI, XP system, room settings panel).

---

## Known Issues

None identified.

---

## Current Assumptions

Load-bearing assumptions a new session should be aware of before making changes:

- **No verified user identity.** Every client is a Supabase anonymous auth session (`auth.uid()`) or, if Supabase isn't configured, a random `localStorage` ID — never a verified account. RLS restricts *what shape of data* a request can touch, but cannot confirm a client is who it claims to be. Treat this as "good enough to stop casual abuse," not a secure identity system (see migration `0001`'s header comment).
- **BroadcastChannel fallback is same-browser-only.** When Supabase env vars are absent, multiplayer "works" only across tabs in the same browser — it does not sync across devices or real users. Local-dev/demo convenience only.
- **No session persistence across visits.** Closing a room tab and reopening it does not restore a prior session beyond whatever `localStorage` already holds.
- **Static prompt/question content is English-only, no i18n.**

---

## Next Recommended Task

No task is queued. If picking up unprompted work, consult `TASKS.md` and start from the top of the new High Priority "pre-launch hardening" tier — the site is planned for a public launch, so abuse controls, rate limiting, legal basics, and error monitoring outrank the Medium Priority engagement features.

---

## See Also

- **Architecture, tech stack, DB schema/ER diagram, coding standards** → `ARCHITECTURE.md`
- **Why a past decision was made** → `DECISIONS.md`
- **Full chronological implementation history** → `CHANGELOG_AI.md`
- **Exactly where the previous session stopped** → `HANDOFF.md`
- **Backlog, technical debt, roadmap, priority** → `TASKS.md`
