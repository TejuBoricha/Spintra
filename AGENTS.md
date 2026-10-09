# AGENTS.md

This file is the repository's AI bootstrap and onboarding guide.

Every AI coding assistant working in this repository must treat this file as the first document to follow before making any code changes.

Workflow:

1. **Internal Initialization**
   - Read `AGENTS.md`.
   - Execute the Startup Checklist in `docs/START_HERE.md`.
   - Use `docs/INDEX.md` to determine which documentation is required for the current task.
   - Read only the necessary documents.
   - Build an understanding of the current project state.

2. **Pre-Implementation Impact Assessment**
   - For every non-trivial feature, bug fix, refactor, database change, API change, infrastructure change, or architectural change, perform a concise impact assessment before modifying any files.
   - Start with the Risk Level (Low/Medium/High); the rest scales with it. Low: one line (what, why, what could break). Medium: a few bullets covering Affected Areas, Blast Radius and the Validation Plan (the pull request description is fine). High: all of Objective, Why, Affected Areas, Dependency Analysis, Blast Radius, Risk Assessment, Architecture Alignment, Alternative Approaches, Implementation Plan, Validation Plan and Documentation Impact.
   - Keep it concise: a line for Low, 3–5 bullets for Medium, 5–15 for High.

3. **User-Facing Initialization**
   - In your response text, briefly summarize your understanding of the current project state and present the Pre-Implementation Impact Assessment at the depth its risk calls for: one line for Low risk, a few bullets for Medium (they can live in the pull request description), the full structure for High (`docs/AI_RULES.md` §10).
   - Mention any active assumptions or ambiguities.
   - If the task is straightforward and unambiguous, immediately continue with implementation in the same response. Only stop and ask for clarification if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.

4. **Implementation**
   - Perform the requested work in the same response. There is no need to wait for another conversational turn unless clarification is required.

5. **Verification**
   - Run `npm run verify`, then the tests that cover the change (`npm run test:related`). The full suite runs in CI; run it locally only for the cases in `docs/AI_RULES.md` §11.
   - Synchronize the documentation the change actually affects, one place per fact (`docs/AI_RULES.md` §11).

6. **Completion**
   - Present the change report directly in the conversation: compact by default, the full template for High-risk changes (`docs/AI_RULES.md` §9).
   - Confirm that the Definition of Done and all Completion Gates have been satisfied.
