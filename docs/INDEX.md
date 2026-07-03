# Documentation Index

## If I am performing X task, which documents should I read?

| Task | Read |
|---|---|
| Resume work | `AI_CONTEXT.md` → `HANDOFF.md` |
| Bug fix | `AI_CONTEXT.md` → `HANDOFF.md` |
| Architecture change | `ARCHITECTURE.md` → `DECISIONS.md` |
| New feature | `TASKS.md` → `AI_CONTEXT.md` |
| Security review | `AI_RULES.md` → `ARCHITECTURE.md` |
| Historical reasoning ("why was X built this way?") | `DECISIONS.md` |
| Previous implementation ("what exactly changed, and when?") | `CHANGELOG_AI.md` |
| Planning / prioritizing new work | `TASKS.md` |
| Reviewing the documentation system itself | `ENGINEERING_GOVERNANCE_REVIEW_V2.md` (current; V1 is historical) |

Load only what the row tells you to. Don't read every document by default — see `AI_RULES.md` §8 (Context Optimization).

---

## Document reference (one-line purpose)

| File | Purpose |
|---|---|
| `START_HERE.md` | Onboarding entry point — how to navigate this system. Start every session here. |
| `AI_RULES.md` | The engineering constitution — decision priorities, quality gates, security rules, Definition of Done. Rarely changes. |
| `AI_CONTEXT.md` | Current project state only — milestone, progress, objective, focus, known issues, assumptions, next task. |
| `HANDOFF.md` | Session continuity only — last completed task, current task, blockers, next recommended task. |
| `TASKS.md` | The backlog — High/Medium/Low priority, in progress, completed (pointers to `CHANGELOG_AI.md`, not narrative). |
| `ARCHITECTURE.md` | Why and how the system is built — tech stack, folder structure, DB ER diagram, design patterns, coding standards. |
| `DECISIONS.md` | Architecture Decision Records — what was decided, why, alternatives considered, trade-offs. Never a changelog. |
| `CHANGELOG_AI.md` | Full chronological implementation history. Append-only — never edit past entries. |
| `ENGINEERING_GOVERNANCE_REVIEW_V2.md` | The **current** point-in-time audit of this documentation system (dated 2026-07-04). Not part of daily workflow. |
| `ENGINEERING_GOVERNANCE_REVIEW.md` | The **superseded** V1 audit (dated 2026-07-03) — kept as historical record, not current. |

Not sure where to start? `TASKS.md` + `HANDOFF.md` together answer "what's happening and where did we leave off."
