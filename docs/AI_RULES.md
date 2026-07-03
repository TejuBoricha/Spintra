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
- **Mandatory Change Report:** Every significant refactor, bug fix, or feature update must include a report containing:
  - **Status:** (e.g., Completed, In Progress)
  - **Issue:** Summary of the problem
  - **Severity:** (Critical / High / Medium / Low / Informational)
  - **Root Cause:** Detailed explanation of why the problem occurred
  - **Impact:** What parts of the system or users were affected
  - **Solution:** Explanation of the code changes applied
  - **Files Modified:** List of file paths
  - **Verification:** Step-by-step commands and test results
  - **Risk:** Assessment of potential side effects or regressions
  - **Future Recommendation:** Architectural cleanup or scaling suggestions

---

## 7. AI Collaboration & Transition Guidelines

To ensure a seamless transition between different AI sessions and models, follow this workflow:

### Startup Checklist
1. **Inspect Documentation:**
   - Read the roadmap tasks list to identify active objectives.
   - Read the current context file to verify the current progress status.
   - Read the handoff summary to check the exact stopping point of the previous session.
2. **Verify Codebase Health:** Run the compiler/typecheck command to verify the codebase compiles before making any changes.

### End-of-Session Checklist
1. **Verify Quality Gates:** Run compilation, linting, and build commands. All must pass.
2. **Synchronize Documentation:**
   - Update the tasks log (mark completed items, document technical debt).
   - Update the current context (completed features, blockers, next objective).
   - Append a new chronological changelog log entry.
   - Write a portable handoff summary detailing the exact stopping point and next immediate tasks.
3. **No Stale Memory:** Ensure all reasoning, assumptions, or database state constraints are fully written down so the next AI can start working immediately.
