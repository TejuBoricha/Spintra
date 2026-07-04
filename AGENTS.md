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
   - The assessment must include: Risk Level (Low/Medium/High), Objective, Why, Affected Areas, Dependency Analysis, Blast Radius (Mandatory), Risk Assessment, Architecture Alignment, Alternative Approaches, Implementation Plan, Validation Plan, and Documentation Impact.
   - Keep it concise (typically 5–15 bullet points).

3. **User-Facing Initialization**
   - In your response text, briefly summarize your understanding of the current project state and present the Pre-Implementation Impact Assessment.
   - Mention any active assumptions or ambiguities.
   - If the task is straightforward and unambiguous, immediately continue with implementation in the same response. Only stop and ask for clarification if the assessment identifies ambiguity, conflicting requirements, architectural uncertainty, or unacceptable risk.

4. **Implementation**
   - Perform the requested work in the same response. There is no need to wait for another conversational turn unless clarification is required.

5. **Verification**
   - Run the appropriate quality gates/checks (`npm run verify`).
   - Synchronize all affected documentation in the `docs/` folder.

6. **Completion**
   - Present the Mandatory Change Report directly in the conversation.
   - Confirm that the Definition of Done and all Completion Gates have been satisfied.
