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
- **Mandatory Change Report:** Every significant refactor, bug fix, or feature update must end with a structured engineering report, displayed directly in the conversation — updating documentation alone is not sufficient. See Section 9 for the mandatory completion gate, the exact report template, and when a report is required vs. optional.

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
   - Briefly summarize your understanding of the current project state and present the Pre-Implementation Impact Assessment in your response text before touching any production code.
   - Mention any assumptions or ambiguities.
   - If the task is straightforward and unambiguous, immediately continue with implementation in the same response. Only stop and ask for clarification if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.

4. **Implementation**
   - Perform the requested work in the same response (no need to wait for another conversational turn unless clarification is required).

5. **Verification**
   - Run the appropriate quality gates/checks (`npm run verify`).
   - Synchronize all affected documentation in the `docs/` folder (including backlog checkmarks in `docs/TASKS.md`, milestone logs in `docs/AI_CONTEXT.md`, and stopping points in `docs/HANDOFF.md`).

6. **Completion**
   - Present the Mandatory Change Report in the conversation (following the exact template in §9).
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
3. Relevant documentation has been updated and synchronized (including `docs/TASKS.md`, `docs/AI_CONTEXT.md`, `docs/HANDOFF.md`, and `docs/CHANGELOG_AI.md`).
4. A Mandatory Change Report has been presented in the conversation.
5. Confirm that all Completion Gates have been satisfied.

If any of the above is missing, the task must be treated as incomplete. Never finish a task without satisfying every completion gate.

### Mandatory Change Report

Every significant change MUST end with a structured engineering report, displayed directly in the conversation. Updating documentation alone is NOT sufficient — the report must always be presented to the user, using exactly this structure:

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

Mandatory Change Reports are **REQUIRED** for: bug fixes, new features, refactoring, database changes, API changes, UI changes, security improvements, performance optimizations, configuration changes, dependency updates, infrastructure changes, and architecture changes.

Reports are **OPTIONAL** for: documentation-only edits, formatting-only changes, typo corrections, and comment-only updates.

### Engineering Communication

Do not optimize for shorter responses. Prioritize complete engineering communication over response brevity. Assume the recipient is another engineer who must understand what changed, why it changed, how it was verified, what risks remain, and what should happen next. Never simply state "fixed" or "done" — always explain the engineering reasoning behind significant changes.

### Final Rule

Before ending every task, verify that the Mandatory Change Report has been presented. If it has not been presented, continue the response until it has been fully completed. Treat the report as part of the implementation rather than an optional summary.

---

## 10. Pre-Implementation Impact Assessment (PIIA)

Before modifying any files for any non-trivial feature, bug fix, refactor, database change, API change, infrastructure change, or architectural change, you must perform a concise Pre-Implementation Impact Assessment.

The assessment must be presented in the user-facing initialization and follow this structure:

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

### 4. Blast Radius (Mandatory)
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

The purpose of the PIIA is to think before coding, not to slow development. It should remain concise (typically 5–15 bullet points total).
- If the task is clear and unambiguous, **immediately continue with implementation in the same response** after presenting the assessment.
- **Only stop and ask for clarification** if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.
