# Spintra

Party/game-room web app: 11 standalone single-player tools (coin flip, dice,
lucky wheel, name draw, tournament brackets, truth-or-dare, etc.) plus a
Supabase-backed multiplayer room feature (chat, live participants, shared
activities).

## Stack

- Next.js 16 (App Router) + React 19
- Supabase (`@supabase/supabase-js`) for multiplayer realtime sync — client-side only, no server/API routes
- Tailwind CSS 4 + shadcn-style components (`@base-ui/react`, `vaul`)
- Playwright for e2e smoke testing

> This Next.js version has some breaking changes vs. older docs/training data
> — see `AGENTS.md` and `node_modules/next/dist/docs/` before assuming an API
> works the way you remember. Notably, the routing hook file is `proxy.ts`
> (Next 16 renamed `middleware.ts`), not `middleware.ts`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

The multiplayer room feature needs a Supabase project. Without one configured,
the app still runs — rooms fall back to a same-browser-tab demo mode via
`BroadcastChannel` (see `src/lib/supabase/client.ts`), which does **not**
sync across different devices/users.

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

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:smoke` | Playwright smoke test (room create/join flow) |

## Project layout

- `src/app/tools/*` — standalone single-player game/utility pages
- `src/app/room/[code]` — multiplayer room (chat, participants, shared activities)
- `src/app/create` — room creation flow
- `src/lib/supabase/client.ts` — browser Supabase client (returns `null` if unconfigured)
- `src/lib/room-user.ts` — client-side identity (localStorage-based, no auth)
- `proxy.ts` — redirects `/room?code=X` to `/room/X`
- `supabase/migrations/` — schema + RLS for the Supabase-backed tables

## Known limitations

- No test coverage beyond the one smoke spec — see `tests/smoke.spec.ts`.
- No CI pipeline is configured beyond `.github/workflows/ci.yml` (lint + typecheck + build + smoke test).
- Multiplayer authorization relies on RLS, not verified user identity (see Supabase setup above).

## Deploy

Any Next.js host works (e.g. [Vercel](https://vercel.com/new)). Set the two
`NEXT_PUBLIC_SUPABASE_*` environment variables in your hosting provider's
dashboard before deploying.
