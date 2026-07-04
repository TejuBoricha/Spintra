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

2. **User-Facing Initialization**
   - In your response text, briefly summarize your understanding of the current project state.
   - Mention any active assumptions or ambiguities.
   - If clarification is required, stop and ask the user before making changes.

3. **Implementation**
   - Perform the requested work in the same response. There is no need to wait for another conversational turn unless clarification is required.

4. **Verification**
   - Run the appropriate quality gates/checks (`npm run verify`).
   - Synchronize all affected documentation in the `docs/` folder.

5. **Completion**
   - Present the Mandatory Change Report directly in the conversation.
   - Confirm that the Definition of Done and all Completion Gates have been satisfied.
