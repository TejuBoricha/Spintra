# AI Engineering Workflow

Version: 1.0.0

Status: Stable

This document defines the permanent AI Engineering Workflow for this repository.

Changes to this document should be rare and only made when they provide clear long-term value.

Avoid changing the engineering workflow during normal feature development.

Feature development should follow this workflow rather than modifying it.

---

# AI Constitution — Repository Engineering Rules

This constitution governs all engineering activities in this repository. Every AI assistant (Antigravity, Claude Code, VS Code Agent, Cursor, Windsurf, Gemini CLI, or any other) must follow these rules strictly before, during, and after executing any task.

---

## 1. Engineering Governance & Decision Priority

When multiple technical solutions exist, engineers must prioritize choices in the following strict order:
1. **Correctness:** Does the code solve the problem accurately under all edge cases?
2. **Security:** Does it enforce least privilege and avoid common vulnerabilities (OWASP)?
3. **Reliability:** Is it resilient to unexpected failures or downstream crashes?
4. **Data Integrity:** Does it preserve accurate states and database schemas?
5. **Maintainability:** Can other developers read, locate, and modify this code easily?
6. **Testability:** Can it be easily verified by automated mock structures or smoke tests?
7. **Scalability:** Will the patterns hold as usage or traffic grows?
8. **Performance:** Does it satisfy resource and rendering budgets?
9. **Readability:** Is it simple, clean, and self-documenting?
10. **Developer Experience (DX):** Does it provide clean typing and compiler assistance?
11. **Feature Velocity:** Does it support rapid iterations without compromising items 1-10?

- **Rules Modifications:** Do not modify `AI_RULES.md` unless:
  - A recurring issue has been observed across multiple development sessions,
  - The improvement benefits future development,
  - And the change has been evaluated for long-term maintainability.
  Treat `AI_RULES.md` as a stable engineering standard rather than a document that changes frequently.

---

## 2. Core Development Principles

- **KISS (Keep It Simple, Stupid):** Avoid premature abstraction, unnecessary complex state machinery, or over-engineered design patterns.
- **YAGNI (You Aren't Gonna Need It):** Do not write code or features that are not explicitly requested.
- **DRY (Don't Repeat Yourself):** Consolidate duplicate styles, utility functions, or repeated layouts.
- **SOLID:** Maintain single-responsibility classes/components and clean interfaces.
- **Defensive Programming:** Always check for undefined states, empty lists, or null values.

### Minimal-Code Decision Ladder

*(Adapted from the [Ponytail](https://github.com/dietrichgebert/ponytail) ruleset — operationalizes YAGNI/KISS/DRY above into a concrete order of operations.)*

Before writing any code, stop at the first rung that holds:
1. Does this need to be built at all?
2. Does it already exist in this codebase? Reuse the existing helper, util, or pattern rather than re-writing it.
3. Does the standard library already do this?
4. Does a native platform feature cover it?
5. Does an already-installed dependency solve it?
6. Can this be one line?
7. Only then: write the minimum code that works.

The ladder runs after the problem is understood, not instead of it — read the task and the code it touches, trace the real flow end to end, then climb. A bug fix means the root cause, not the symptom: grep every caller of the function being touched and fix the shared function once, rather than patching only the path the ticket named.

Additional rules:
- No abstractions that weren't explicitly requested. No new dependency if it can be avoided. No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once the problem is understood — the smallest change in the wrong place is a second bug, not a fix.
- When two stdlib/library approaches are the same size, pick the edge-case-correct one — lazy means less code, not a flimsier algorithm.
- A deliberate simplification that cuts a real corner with a known ceiling (a global lock, an O(n²) scan, a naive heuristic) gets a comment naming the ceiling and the upgrade path.

Not subject to minimization: understanding the problem itself, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, and anything explicitly requested. Non-trivial logic leaves one runnable check behind (an assert-based check or a small test) — trivial one-liners don't need one.

---

## 3. Review Gates & Quality Standards

Every modification must pass through three mandatory quality gates before the turn ends:
1. **Compilation Gate:** Code must compile cleanly without errors (e.g. strict type checks).
2. **Linter Gate:** Code must meet static analysis checks and style standards.
3. **Build Gate:** Production assets or bundles must compile and serialize successfully.

If any check fails, do not proceed. Revert or repair the changes immediately.

---

## 4. Security & Data Integrity

- **No Credentials:** Never commit API keys, database passwords, private certificates, or secret keys to the source code.
- **Input Validation:** Enforce string length validation, type parsing, and content sanitization at both the user interface level and the storage engine/database level.
- **Error Handling:** Implement descriptive boundaries or catch blocks to isolate failures. Never let a single local element crash the entire system.

---

## 5. Refactoring Rules

- **Respect Existing Patterns:** Adapt your coding approach to the existing architecture of the project. Do not introduce new libraries or architectural paradigms without an approved plan.
- **Incremental Refactoring:** When modifying legacy structures, follow incremental patterns (e.g. Strangler Fig). Keep the code fully operational after every step.
- **Technical Debt Logging:** If you encounter bugs, dead code, or design inefficiencies outside the active task, do not repair them on the spot. Document them in the tracking tasks system and continue.

---

## 6. Documentation Policies

- **Synchronized Reality:** Documentation is a first-class citizen of the codebase. All updates to features or database schemas must be mirrored in their respective documentation files immediately.
- **Change report:** Every significant refactor, bug fix, or feature update ends with an engineering report, displayed directly in the conversation — updating documentation alone is not sufficient. See Section 9 for the completion gate, the compact report (and the full template for High-risk changes), and when a report is required vs. optional.

---

## 7. AI Collaboration & Transition Guidelines

To ensure a seamless transition between different AI sessions and models, follow this workflow:

### Startup and Execution Workflow
In every new session, you MUST execute this workflow (normally completed in a single response):

1. **Internal Initialization**
   - Read `AGENTS.md`.
   - Execute the Startup Checklist: Consult `docs/START_HERE.md`, `docs/TASKS.md`, and `docs/HANDOFF.md` first.
   - Use `docs/INDEX.md` to determine which documentation is required for the current task.
   - Read only the necessary documents to build an understanding of the current project state.

2. **Pre-Implementation Impact Assessment**
   - For every non-trivial feature, bug fix, refactor, database change, API change, infrastructure change, or architectural change, perform a concise impact assessment before modifying any files. See §10 for the required structure.

3. **User-Facing Initialization**
   - Briefly summarize your understanding of the current project state, and present the Pre-Implementation Impact Assessment at the depth its risk level calls for (§10): one line for Low risk, a few bullets for Medium (they can live in the pull request description), the full structure for High. It never blocks the work: if the task is clear, go on in the same response.
   - Mention any assumptions or ambiguities.
   - If the task is straightforward and unambiguous, immediately continue with implementation in the same response. Only stop and ask for clarification if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.

4. **Implementation**
   - Perform the requested work in the same response (no need to wait for another conversational turn unless clarification is required).

5. **Verification**
   - Run `npm run verify`, then the tests that cover the change (`npm run test:related`). The full suite is CI's job, except for the cases in §11.
   - Synchronize the documentation the change actually affects, one place per fact (§11).

6. **Completion**
   - Present the change report in the conversation (§9: compact by default, the full template for High-risk changes).
   - Confirm that the Definition of Done and all Completion Gates have been satisfied.

---

## 8. Context Optimization

Documentation exists to be used efficiently, not read exhaustively. To keep sessions fast and avoid burning context on irrelevant material:

- **Read only the documentation required for the current task.** Most tasks only touch a handful of files in `docs/` — reading the rest wastes context without adding value.
- **Never load all documentation by default.** Reading every file "just in case" at the start of a session is not the expected workflow.
- **Use `docs/START_HERE.md` first.** It is the entry point for every session and explains this workflow.
- **Use `docs/INDEX.md` to determine which documents are needed.** It lists every document with a one-line description of what it covers and when to read it — use it to select only the relevant files.
- **Prefer summaries before detailed sections.** Where a document has a summary or status section (e.g. `AI_CONTEXT.md`'s completion-status block), read that first and only descend into full detail if the task requires it.
- **Avoid re-reading unchanged documentation during the same session.** Once a file has been read and nothing has modified it since, treat its content as still valid rather than reloading it.
- **Keep documentation concise, and archive historical information when appropriate.** Trim or archive detail that no longer informs current decisions rather than letting files grow indefinitely. `CHANGELOG_AI.md` is the deliberate exception — it is append-only by design, since its value is being a complete historical record.

---

## 9. Definition of Done & Mandatory Change Reporting

### Definition of Done (Mandatory Completion Gate)

A task is NOT considered complete until ALL of the following conditions have been satisfied:

1. The requested implementation has been completed.
2. Relevant verification has been performed (run the appropriate verification/lint commands like `npm run verify` before considering the task complete).
3. Relevant documentation has been updated, one place per fact (§11): the changelog entry always, `docs/TASKS.md` when a status changed, `docs/HANDOFF.md` only when the resume point changed (and always when stopping), `docs/AI_CONTEXT.md` only for architecture or milestones.
4. A change report has been presented in the conversation.
5. Confirm that all Completion Gates have been satisfied.

If any of the above is missing, the task must be treated as incomplete. Never finish a task without satisfying every completion gate.

### Mandatory Change Report

Every significant change ends with an engineering report, displayed directly in the conversation. Updating documentation alone is NOT sufficient. **Use the compact form by default; use the full template below it for High-risk changes (database, security, authentication, architecture, infrastructure) and whenever the owner asks for it.**

Compact form:

```
# Status
Fixed / Improved / Added / Refactored / Removed, and the severity, in one line.

# Why
The problem and its root cause, in plain words.

# What changed
What was done, with the files that matter.

# Verification
What was run and what it showed (name the tests). Say what was NOT verified.

# Risk and rollback
What could still go wrong, and how to revert it.

# Next
Optional follow-ups.
```

Full template:

```
# Status
Fixed / Improved / Added / Refactored / Optimized / Removed

# Severity
Critical / High / Medium / Low / Informational

# Issue
What problem existed?

# Root Cause
Why did it happen?

# Impact
What functionality or users were affected?

# Solution
Exactly what was changed?

# Before
Describe the previous behaviour.

# After
Describe the new behaviour.

# Files Modified
List every modified file.

# Verification
Explain how the change was verified. Include commands executed if applicable
(e.g. npm run lint, npm run typecheck, npm run build, tests executed, manual verification).

# Testing Performed
Describe what was actually tested
(e.g. functional testing, regression testing, database migration validation,
API validation, UI validation, offline mode validation).

# Performance Impact
If applicable, describe any performance improvements or regressions.

# Risk
Describe any remaining risks or side effects. If there are none, explicitly
state "No known risks."

# Rollback Plan
Briefly explain how this change could be reverted if necessary.

# Related Decisions
Reference any relevant entry in DECISIONS.md if applicable.

# Future Recommendations
List optional future improvements.
```

### Reporting Requirements

A change report (compact by default, §9) is **REQUIRED** for: bug fixes, new features, refactoring, database changes, API changes, UI changes, security improvements, performance optimizations, configuration changes, dependency updates, infrastructure changes, and architecture changes.

A report is **OPTIONAL** for: documentation-only edits, formatting-only changes, typo corrections, and comment-only updates.

### Engineering Communication

Be direct: say each thing once, plainly. Complete does not mean long. Assume the recipient is another engineer who must understand what changed, why it changed, how it was verified, what risks remain, and what should happen next. Never simply state "fixed" or "done": give the reasoning behind significant changes. The pull request description is where the detail belongs; the conversation carries the report.

### Final Rule

Before ending every task, verify that the change report has been presented. If it has not been presented, continue the response until it has. Treat the report as part of the implementation rather than an optional summary.

---

## 10. Pre-Implementation Impact Assessment (PIIA)

Before modifying any files for any non-trivial feature, bug fix, refactor, database change, API change, infrastructure change, or architectural change, you must perform a concise Pre-Implementation Impact Assessment.

Think it through at the depth the risk calls for. It need not be a separate message: Low risk is one line, Medium a few bullets (in the pull request description is fine), High the full structure below, presented in the user-facing initialization:

### 1. Risk Level
Classify the task as one of the following:
- **Low Risk**: Documentation, comments, formatting, minor styling, typos, or variable renames.
- **Medium Risk**: Localized bug fixes, component enhancements, UI behaviour changes, or small refactors.
- **High Risk**: New features, multi-module changes, database changes, API changes, authentication, state management, infrastructure, performance, security, architecture, or cross-cutting refactors.

*The depth of the PIIA should automatically scale according to this risk level (e.g., highly abbreviated for Low Risk, standard concise for Medium, thorough for High Risk).*

### 2. Objective & Why
- What is being changed, and why is this change required?

### 3. Affected Areas & Dependency Analysis
- Which modules, components, pages, services, APIs, database tables, hooks, contexts, utilities, or infrastructure are affected?
- What existing systems depend on this functionality, and what does this functionality depend on?

### 4. Blast Radius (mandatory for Medium and High risk)
Always determine the potential impact before implementation:
- What existing functionality could be affected or accidentally broken?
- Which modules or services are tightly coupled?
- Which user journeys require regression testing?
- Could this impact: **Performance**, **Security**, **Accessibility**, **SEO**, **Build pipeline**, **CI/CD**, **Database**, **APIs**, **State management**, or **User experience**?
- Does this introduce deployment or migration risks?

### 5. Risk Assessment
- Potential regressions, edge cases, backward compatibility concerns, and failure scenarios.

### 6. Architecture Alignment
- Can an existing pattern or abstraction be reused?
- Is this introducing unnecessary complexity? Is there a simpler implementation?
- Should this become an Architecture Decision Record (ADR)?

### 7. Alternative Approaches & Implementation Plan
- Alternatives evaluated and why the preferred one was chosen.
- High-level implementation steps before writing code.

### 8. Validation Plan & Documentation Impact
- How the implementation will be verified (typecheck, lint, build, tests, manual, UI, DB, performance, security).
- Which docs will require updates (AI_CONTEXT.md, HANDOFF.md, TASKS.md, CHANGELOG_AI.md, ARCHITECTURE.md, DECISIONS.md).

---

### PIIA Engineering Principle

The purpose of the PIIA is to think before coding, not to slow development. It stays concise and scales with the risk: one line for Low, 3–5 bullets for Medium, 5–15 for High.
- If the task is clear and unambiguous, **immediately continue with implementation in the same response** after presenting the assessment.
- **Only stop and ask for clarification** if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.

---

## 11. Working Agreement: tests, previews, reviews, documentation (ADR-013)

Measured on 9 and 10 October 2026, a large share of the time went into repeating work that CI already does, handing over local links, and writing the same facts in four places. These rules remove that without removing a check that found a real defect (the revert evidence, the review round before the merge and the class sweeps all did).

### Tests: three tiers
1. **Always: `npm run verify`.** Typecheck, lint, docs drift and the dependency audit: the static gates CI runs first, so a red audit shows up before the push instead of ten minutes into CI. The audit needs the network, so it is the last step. Offline, `verify` fails there, after the useful checks: run the first three on their own (`npm run typecheck && npm run lint && npm run docs:check`), say in the report that the audit was not run, and let CI run it.
2. **After each change: `npm run test:related`.** It runs the specs that cover the files changed since `main`, finding them by the routes they visit (following their imports, so a spec that reaches a page through a helper counts), and runs the full suite for anything it cannot place (shared components, hooks, libraries, configuration, migrations, dependencies). A spec that reaches a page some other way can be missed: CI is the backstop. Tests written for a change are first run against the old build to show they fail there (revert evidence), then against the new one.
3. **The full suite locally: only when the change can reach everything,** such as a framework or dependency upgrade, a shared component or primitive, global CSS or the Playwright configuration, and then once, not after every follow-up. For everything else the full suite runs in CI on the pull request, and that run on the exact head is the evidence.

### Previews: one link per session
Start one dev server on a fixed port and leave it running: `npm run dev -- -p 3200 -H 127.0.0.1`, then http://127.0.0.1:3200. It follows whichever branch is checked out and reloads on every edit, so the link never changes and nothing needs building. `npm run test:related` runs against this checkout's own preview server automatically (it finds it through `.next/dev/lock`, which `next dev` writes, so another checkout's server is never used; a dev server is slower on the first visit to each page, and it is not production, so for specs that read server-rendered output the result is only indicative and the proof is the CI run on the pull request); with no preview server for this checkout Playwright builds and starts its own, which takes minutes. A production build is the final proof for something that depends on one (performance, hydration, the real Playwright run), not a way to hand over a link. A second build beside a running server uses `NEXT_DIST_DIR=.next-x` and is deleted afterwards.

### Reviews
- Self-review the diff before opening the pull request, then run **one** `/code-review high` on the final diff **before** the merge, never after.
- A second round only if the first found a defect in the behaviour the change ships. Stop when a round finds none.
- Siblings of the bug being fixed (the same defect elsewhere) are swept and fixed in the same pull request, with a test that would have caught them. A different class of problem found on the way (a hardening idea, a new audit finding) is reported as its own item in `docs/TASKS.md` and fixed in its own pull request.
- Merge when the required checks are green on the exact head and the last review round found nothing new.

### Documentation: one place per fact
- **Pull request description:** the full detail (findings, evidence, alternatives, what was not verified).
- **`docs/CHANGELOG_AI.md`:** a short entry (about eight lines: task, change, why, evidence, what is not verified) with the pull request number, written once, after the last review round.
- **`docs/TASKS.md`:** one status line per item.
- **`docs/HANDOFF.md`:** only the facts that decide where the next session starts (the state of `main`, open pull requests, what is in flight). Update it when stopping, not after every step.
- **`docs/AI_CONTEXT.md`:** architecture and milestones only.
Never copy the same finding table into several of these.

### CI
`ci.yml` runs once per pull request head (it tests the merge of the branch into its base) and once for every push to `main`, and a newer push to a pull request cancels the older run. A branch without a pull request runs nothing, so push work in progress freely. A pull request with merge conflicts runs nothing either (GitHub does not start `pull_request` workflows for it; `gh pr view --json mergeStateStatus` says `DIRTY` and the pull request page shows the conflict banner), so merge `main` into the branch to get a run.
