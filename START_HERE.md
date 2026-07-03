# Spintra AI Engineering Workflow — Start Here

Welcome to the Spintra repository! This codebase employs a standardized, production-ready AI Engineering Workflow designed for seamless collaboration between human developers and different AI coding assistants (Antigravity, Claude Code, Cursor, Windsurf, Gemini CLI, etc.).

---

## 1. Documentation is the Single Source of Truth

The files located in the [`docs/`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/) folder represent the authoritative state of this repository. **Historical conversation logs or AI memory slots must never be treated as authoritative over these documents.**

Before writing any code or making architectural decisions, all contributors (humans and AI assistants) must read the following files in order:

1. **[`docs/AI_RULES.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/AI_RULES.md):** The permanent engineering constitution. Defines code style, validation gates, security guidelines, and session protocols.
2. ****[`docs/AI_CONTEXT.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/AI_CONTEXT.md):** Living project memory detailing implemented features, dependencies, and database status.
3. **[`docs/HANDOFF.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/HANDOFF.md):** Transition checklist mapping the exact stopping point of the previous session and the next immediate tasks.
4. **[`docs/TASKS.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/TASKS.md):** Active roadmaps, task lists, and technical debt backlogs.
5. **[`docs/ARCHITECTURE.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/ARCHITECTURE.md):** Project structure, naming conventions, event bus models, and module registers.
6. **[`docs/DECISIONS.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/DECISIONS.md):** Architecture Decision Records (ADRs) explaining the context and justification of major structural changes.
7. **[`docs/CHANGELOG_AI.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/CHANGELOG_AI.md):** Historical log of sessions and Mandatory Change Reports.

---

## 2. Developer & AI Core Workflow

### Setup & Local Verification
- Refer to [`CONTRIBUTING.md`](file:///c:/Users/tejas/Desktop/Spintra-1/CONTRIBUTING.md) for quick-start execution parameters, environment setups, and Playwright verification.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` locally to verify changes before push.

### Session Startup Loop
1. Inspect the roadmap files ([`docs/TASKS.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/TASKS.md) and [`docs/HANDOFF.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/HANDOFF.md)) to identify the current objective.
2. Confirm the codebase is in a compiling state before making edits.

### Session Teardown Loop
Before concluding a work session:
1. Ensure all quality checks (TypeScript compilation, linting rules, and Next production builds) pass cleanly.
2. Synchronize documentation files to accurately mirror the updated state of the codebase.
3. Append a new session log and change report to [`docs/CHANGELOG_AI.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/CHANGELOG_AI.md).
4. Update [`docs/HANDOFF.md`](file:///c:/Users/tejas/Desktop/Spintra-1/docs/HANDOFF.md) with resume instructions for the next contributor.
