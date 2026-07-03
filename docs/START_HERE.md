# Start Here

This repository follows an **AI Engineering Workflow**. The documentation in `docs/` — not chat history, memory, or assumptions from training data — is the authoritative source of truth for this project's current state, architecture, and past decisions.

## Before you start

Don't read every file in `docs/`. Read only what's relevant to the task in front of you.

Open **[`docs/INDEX.md`](./INDEX.md)** first — it lists every document with a one-line description of what it covers and when to read it. Use it to decide what you actually need, then go read just that.

Two files are worth checking almost regardless of task: `docs/TASKS.md` (what's active right now) and `docs/HANDOFF.md` (where the previous session left off).

## The engineering rules

This repo's engineering constitution — decision priorities, quality gates, security rules, refactoring policy — lives in `docs/AI_RULES.md`. Read it once per session if you haven't already; it isn't repeated here.

## Before you end a session

Documentation must reflect reality by the time you stop, not just the code. At minimum:
- Update `docs/AI_CONTEXT.md` if the project's status changed.
- Append a new entry to `docs/CHANGELOG_AI.md` (append-only — never edit past entries).
- Update `docs/TASKS.md` if you completed or discovered work items.
- Leave `docs/HANDOFF.md` pointing at wherever you actually stopped.

If the docs don't match the code, the next session — human or AI — starts from a false premise.
