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
3. Run `supabase/migrations/0001_init_schema_and_rls.sql` in the Supabase SQL
   editor (or via `supabase db push`) to create the `rooms`, `room_participants`,
   and `chat_messages` tables, enable Row Level Security, and turn on realtime
   for them.

**Important caveat:** Spintra does not use Supabase Auth — every client
generates its own random `user_id` in `localStorage`. The RLS policies in the
migration close the most damaging gaps (host-role races, unrestricted
deletes) but cannot cryptographically verify a client's claimed identity.
Read the comment at the top of that migration file before treating this as a
fully secure setup; migrating to Supabase Anonymous Auth is the real fix.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | For real multiplayer | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For real multiplayer | Supabase anon public key |

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
src/app/create/             room creation flow
src/lib/games.ts            single source of truth for the game catalog
src/lib/supabase/client.ts  browser Supabase client (returns null if unconfigured)
src/lib/room-user.ts        client-side identity (localStorage-based, no auth)
proxy.ts                    redirects /room?code=X to /room/X
supabase/migrations/        schema + RLS for the Supabase-backed tables
```

## Development notes

> This Next.js version has breaking changes vs. older docs/training
> data — see [`AGENTS.md`](AGENTS.md) and `node_modules/next/dist/docs/`
> before assuming an API works the way you remember. Notably, the routing
> hook file is `proxy.ts` (Next 16 renamed `middleware.ts`), not `middleware.ts`.

## Testing

- `tests/smoke.spec.ts` — the only automated coverage today (Playwright,
  room create/join flow).
- `.github/workflows/ci.yml` — runs a dependency security audit, typecheck,
  lint, a documentation drift check, build, and the smoke test on every push.

## Known limitations

- No test coverage beyond the one smoke spec.
- Multiplayer authorization relies on RLS, not verified user identity (see
  [Environment variables](#environment-variables) above).

## Deployment

Any Next.js host works (e.g. [Vercel](https://vercel.com/new)). Set the two
`NEXT_PUBLIC_SUPABASE_*` environment variables in your hosting provider's
dashboard before deploying.

## License

All rights reserved. This repository is source-available for portfolio and
reference purposes only — reuse, modification, or redistribution of this
code is not permitted without the author's permission.
