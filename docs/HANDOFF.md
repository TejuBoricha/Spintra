# HANDOFF.md — Session Resume

Portable session-continuity note for any AI assistant (Antigravity, Claude Code, VS Code Agent, Cursor, Windsurf, Gemini CLI, etc.) to resume work immediately. This file intentionally does not restate architecture, tech stack, or progress history — see `ARCHITECTURE.md`, `AI_CONTEXT.md`, and `CHANGELOG_AI.md` for those.

---

## Last Completed Task

Completed Session 32: implemented Abuse & Moderation Controls via migration `supabase/migrations/0012_moderation_controls.sql` plus four client-side pieces:
- **Ban-on-kick**: kicking a participant (host-only feature that already existed) now also inserts a `room_bans` row; a before-insert trigger on `room_participants` rejects any rejoin attempt from a banned `user_id`. Closes a real gap found while investigating: kicked users could previously just walk right back in.
- **Message reporting**: any participant can flag a message via `message_reports` (insert-only, no select policy — reviewed manually via the Supabase SQL editor since there's no admin backend).
- **Client-side block/mute**: `src/lib/blocked-users.ts`, `localStorage`-based, available to everyone (not just the host) — hides a blocked user's messages from your own view only.
- **Chat content filter**: `src/lib/chat-filter.ts` — basic profanity/slur blocklist + repeated-character spam heuristic, checked before send.

Verified end-to-end with a headless Playwright script (two isolated browser contexts, host + guest) driving the real UI: profanity/spam correctly rejected client-side, block/unblock correctly hides/restores messages, kick still succeeds and redirects the kicked user. Found and fixed one real bug during this testing: the profanity regex used `\b(word)\b`, so inflections like "fucking" never matched (trailing boundary requirement) — fixed to `\b(word)` (leading boundary only). `npm run verify` passes.

**Update:** migration `0012` has been applied to the live Supabase project — but not via manual dashboard paste this time. The user ran `supabase login` once; the AI then ran `supabase init` (created `supabase/config.toml`), `supabase link --project-ref qjxaehxwuqntyqrdmihs`, repaired the out-of-sync remote migration history (`supabase migration repair --status applied 0001 0002 0003 0008 0009 0010 0011 --linked`, since those were originally applied by hand and never recorded), and pushed `0012` with `supabase db push --linked --yes`. Re-verified live with Playwright against the real production DB: report succeeds, kick succeeds, and rejoining after a kick is now correctly blocked with "You have been banned from this room by the host."

**Going forward:** the CLI is linked. Future migrations can be pushed directly with `npx supabase db push --linked --yes` — no more manual SQL Editor paste needed.

---

## Current Task

None in progress. All four pre-launch hardening items except Production Error Monitoring are done and live (see below).
**Reminder carried forward:** the legal pages (`/legal/terms`, `/legal/privacy`) ship with bracketed placeholders (company/entity name, jurisdiction, support/privacy emails) that need real values — and ideally legal review — before actual public launch.

---

## Current Blockers

None.

---

## Next Recommended Task

Working through `docs/TASKS.md`'s High Priority "Pre-launch hardening" tier one item at a time, per the user's request:
1. ~~**Legal Basics**: Terms of Service, Privacy Policy, cookie/consent notice.~~ Done — Session 30.
2. ~~**Rate Limiting**: throttle anonymous room/message creation.~~ Done — Session 31, applied live.
3. ~~**Abuse & Moderation Controls**: ban-on-kick, report, block, chat filter.~~ Done — Session 32, applied live and verified against production.
4. **Production Error Monitoring**: Sentry or equivalent, wired up before real public traffic. **← pick up here next (last item in this tier).**

Medium Priority (Visual Scoreboard, Tournament Bracket Tree UI, XP/Leveling, Room Settings Panel) remains queued behind it.
