# Spintra

[![CI](https://github.com/TejuBoricha/Spintra/actions/workflows/ci.yml/badge.svg)](https://github.com/TejuBoricha/Spintra/actions/workflows/ci.yml)

A party/game-room web app: 14 standalone single-player tools plus a
Supabase-backed multiplayer room feature (chat, live participants, shared
activities synced in real time).

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Development notes](#development-notes)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Deployment](#deployment)
- [License](#license)

## Features

Every tool below works standalone (single-player, at `/tools/<name>`) and as
a synced multiplayer activity inside a room (`/room/[code]`):

| Game | Description |
|---|---|
| Team Maker | Build balanced teams instantly |
| Lucky Wheel | Physics-based 3D spinning wheel |
| Name Draw | Random winner picker, with elimination mode |
| Tournament | Single/double elimination and round-robin brackets |
| Coin Flip | Flip a coin, settle debates |
| Dice Roller | Roll custom dice sets |
| Guess Number | Number guessing game with live hints |
| Rock Paper Scissors | Classic showdown with synchronized reveals |
| Truth or Dare | Party question/dare draws |
| Would You Rather | Vote on impossible choices |
| Never Have I Ever | Icebreaker confessions |
| Trivia | Multiple-choice trivia, race to the top score |
| Bingo | Classic number bingo, call and mark |
| Word Scramble | Unscramble the word before anyone else |

Two additional room modes bundle several of the above into one room:
**Party Mode** (all games unlocked) and **Classroom** (teacher-friendly picks/teams).

## Room platform features

Beyond the games themselves, every multiplayer room includes:

- **Moderation Dashboard** — message reporting, kick/ban with an action history audit log, host-scoped via server-verified RPCs
- **Scoreboard + XP/Leveling** — server-verified score awards (RPS, Bingo, Trivia) with a live leaderboard and rank tiers
- **Room Settings panel** — host controls for max participants, chat moderation, activity timers
- **Automatic host migration** — if the host disconnects, the room elects a new host without interrupting the game
- **Connection status banner** — live indicator when realtime sync degrades or reconnects

## Tech stack

- Next.js 16 (App Router) + React 19
- Supabase (`@supabase/supabase-js`) for multiplayer realtime sync — client-side only, no server/API routes
- Tailwind CSS 4 + shadcn-style components (`@base-ui/react`, `vaul`)
- Playwright for e2e smoke testing

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

The multiplayer room feature needs a Supabase project. Without one
configured, the app still runs — rooms fall back to a same-browser-tab demo
mode via `BroadcastChannel` (see `src/lib/supabase/client.ts`), which does
**not** sync across different devices/users.

To enable real multiplayer:

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the Project URL and anon public key into `.env.local` (see `.env.example`).
3. Apply every migration in `supabase/migrations/` in order (61 files as of
   this writing) via `supabase db push` (or `supabase link` once, then
   `supabase db push`) — this creates the full schema (`rooms`,
   `room_participants`, `chat_messages`, moderation, scoring/XP, tournament
   state, etc.), enables Row Level Security, and turns on realtime. On
   `main`, `.github/workflows/deploy.yml` pushes any new migration files
   automatically on every push that touches `supabase/migrations/**` — see
   [Deployment](#deployment) for the secrets it needs.

Spintra uses Supabase **Anonymous Auth**: each client gets a real
`auth.users` row (no email/password), and RLS/trigger policies key off
`auth.uid()` rather than a client-supplied identity. See
`supabase/migrations/0001_init_schema_and_rls.sql` for the baseline policy
set and later migrations for the moderation/scoring/host-election hardening
built on top of it.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | For real multiplayer | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For real multiplayer | Supabase anon public key |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Error monitoring. Without it, Sentry never initializes (see `sentry.*.config.ts`) — the app runs exactly the same |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Optional | Only needed to upload source maps for readable production stack traces |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run docs:check` | Verify `docs/` hasn't drifted from the real filesystem |
| `npm run verify` | typecheck + lint + docs:check |
| `npm run verify:migration [name]` | Confirms a migration's objects actually exist live in the linked Supabase project (not just tracked as "applied") — run after every `supabase db push` |
| `npm run test:smoke` | Playwright smoke test (room create/join flow) |
| `npm run ci` | verify + npm audit + build + test:smoke (full CI gate, locally) |

## Project structure

```
src/app/tools/*             standalone single-player game/utility pages
src/app/room/[code]/        multiplayer room (chat, participants, header)
src/app/room/[code]/activities/  per-game room UI, one file per game
src/app/room/[code]/components/  moderation dashboard, scoreboard, room settings
src/app/create/              room creation flow
src/app/explore/             public room discovery / browse
src/app/settings/            user preferences (username, theme, etc.)
src/app/api/health/          liveness endpoint for uptime monitors / deploy checks
src/lib/games.ts             single source of truth for the game catalog
src/lib/supabase/client.ts   browser Supabase client (returns null if unconfigured)
src/lib/room-user.ts         client-side identity, backed by Supabase Anonymous Auth
src/lib/moderation.ts        moderation RPC client wrappers (kick/ban/dismiss)
src/lib/xp.ts                XP/rank tier calculations
src/lib/tournament-engine.ts bracket generation for all 4 tournament formats
proxy.ts                     redirects /room?code=X to /room/X
supabase/migrations/         schema + RLS for the Supabase-backed tables
```

## Development notes

> This Next.js version has breaking changes vs. older docs/training
> data — see [`AGENTS.md`](AGENTS.md) and `node_modules/next/dist/docs/`
> before assuming an API works the way you remember. Notably, the routing
> hook file is `proxy.ts` (Next 16 renamed `middleware.ts`), not `middleware.ts`.

## Testing

Playwright specs in `tests/`: `smoke.spec.ts` and `comprehensive-smoke.spec.ts`
(room create/join flow), `multiplayer-loop.spec.ts` (two genuinely distinct
participants — join, activity sync, moderation), `comprehensive-tournament-audit.spec.ts`
and `tournament-double-elimination.spec.ts` (bracket generation and scoring
across all formats).

`.github/workflows/ci.yml` runs two jobs on every push: `validate` (dependency
security audit, typecheck, lint, docs drift check, build, and the Playwright
suite against the demo/`BroadcastChannel` fallback — no Supabase needed) and
`db-integration` (spins up an ephemeral local Supabase via Docker, applies
every migration fresh, and re-runs the suite against real RLS/triggers/realtime
instead of the demo fallback).

## Known limitations

- Bingo's async host-side win verification has no arbitration between two
  players who achieve a genuinely simultaneous valid win — a narrow,
  code-reviewed (not yet live-reproduced) race.
- The daily DB backup and automatic migration-deploy workflows
  (`.github/workflows/db-backup.yml`, `deploy.yml`) require repo secrets
  that aren't configured yet — see [Deployment](#deployment).
- Production error monitoring (Sentry) is scaffolded but not wired up
  (no `NEXT_PUBLIC_SENTRY_DSN` configured yet).

## Deployment

Any Next.js host works (e.g. [Vercel](https://vercel.com/new)). Set the
`NEXT_PUBLIC_SUPABASE_*` (and optionally `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_*`)
environment variables in your hosting provider's dashboard before deploying.

Two GitHub Actions workflows handle Supabase-side operations and need repo
secrets to function:

| Workflow | Trigger | Required secrets |
|---|---|---|
| `deploy.yml` | Push to `main` touching `supabase/migrations/**` (or manual dispatch) | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` |
| `db-backup.yml` | Daily at 03:00 UTC (+ manual dispatch) | `SUPABASE_DB_URL`, `AWS_BACKUP_ACCESS_KEY_ID`, `AWS_BACKUP_SECRET_ACCESS_KEY`, `AWS_BACKUP_S3_BUCKET`, `AWS_BACKUP_R2_ENDPOINT` |

`db-backup.yml` uploads to Cloudflare R2 (S3-API-compatible, free tier,
zero egress fees) rather than real AWS S3 — `AWS_BACKUP_R2_ENDPOINT` is the
bucket's R2 endpoint URL, and the region is hardcoded to `auto` in the
workflow itself (R2's documented value, not a real AWS region).

Without these secrets set (`gh secret set <NAME>`), both workflows run but
fail every time — migrations must then be pushed manually
(`supabase db push`) and no backups are retained.

## License

All rights reserved. This repository is source-available for portfolio and
reference purposes only — reuse, modification, or redistribution of this
code is not permitted without the author's permission.
