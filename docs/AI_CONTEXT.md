# AI_CONTEXT.md — Spintra Project Living Memory
> The authoritative source of truth for the **current state** of the project — nothing else.
> Historical implementation details live in `CHANGELOG_AI.md`. Architecture, tech stack, and the
> DB schema live in `ARCHITECTURE.md`. Session-to-session handoff lives in `HANDOFF.md`. Backlog
> and roadmap live in `TASKS.md`. Do not duplicate those here — link to them instead.
> Always update this file after every significant milestone.
> Last updated: 2026-07-04T14:30 IST

---

## Current Milestone

Working through the "pre-launch hardening" tier: Legal Basics (Session 30), Rate Limiting (Session 31), and Abuse & Moderation Controls (Session 32, migration `0012_moderation_controls.sql`) are done. Only Production Error Monitoring remains.

---

## Overall Progress

All planned modularisation (14/14 activities), invite and QR sharing systems, realtime discovery feeds, client profile synchronizations, database-driven activity prompt migrations, security hardening, CI/dependency automation, and documentation-workflow work is complete. Build/lint/typecheck are clean. No known regressions.

---

## Current Objective

All room joining flows, discovery pages, profile state sync optimizations, database prompts migrations, and workflow rules are complete. Ready for new goals or feature requests.

---

## Current Focus

Working through `TASKS.md`'s High Priority "pre-launch hardening" tier one item at a time. Legal Basics (Session 30), Rate Limiting (Session 31), and Abuse & Moderation Controls (Session 32) are done — all migrations (`0011`, `0012`) are applied to the live Supabase project and verified end-to-end against production. Only Production Error Monitoring remains, ahead of the Medium Priority engagement features (visual scoreboard, tournament bracket UI, XP system, room settings panel).

**Workflow change for future sessions:** the Supabase CLI is now linked to the live project (`qjxaehxwuqntyqrdmihs`) — `supabase/config.toml` was created via `supabase init`, the user ran `supabase login` once, and the AI ran `supabase link` + `supabase db push` directly. Future migrations no longer need manual copy-paste into the Supabase Dashboard SQL Editor; run `npx supabase db push --linked --yes` after adding a new migration file. Note: the remote migration-history table was out of sync with reality before this (many migrations 0001-0011 were originally applied by hand) — this was fixed once via `supabase migration repair --status applied <versions> --linked`. Future migrations pushed through the CLI going forward will stay in sync automatically.

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

Production Error Monitoring (`docs/TASKS.md` High Priority tier, item 4 — the last one) — wire up error tracking/alerting (e.g. Sentry). Legal Basics, Rate Limiting, and Abuse & Moderation Controls (items 1–3) are complete.

---

## See Also

- **Architecture, tech stack, DB schema/ER diagram, coding standards** → `ARCHITECTURE.md`
- **Why a past decision was made** → `DECISIONS.md`
- **Full chronological implementation history** → `CHANGELOG_AI.md`
- **Exactly where the previous session stopped** → `HANDOFF.md`
- **Backlog, technical debt, roadmap, priority** → `TASKS.md`
