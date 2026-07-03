# Spintra Engineering Contribution Guidelines

Welcome! This repository maintains a highly structured engineering and documentation workflow to support collaborative human and AI-driven development. Please read and follow these instructions before contributing.

---

## 1. Quick Start

### Prerequisites
- Node.js version `>=20.9.0`
- NPM version `>=10`

### Local Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Configure local environment parameters:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   *Note: If no Supabase URL is provided, Spintra automatically boots in local fallback mode using browser `BroadcastChannel` APIs.*
3. Run the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 2. Repository Quality Gates

Before submitting any pull request or ending a session, your changes must pass all three validation gates:

### Gate 1: TypeScript Compilation
Ensures type constraints, event bus schemas, and interface implementations align accurately.
```bash
npm run typecheck
```

### Gate 2: Static Analysis Linting
Checks codebase consistency and enforces style conventions.
```bash
npm run lint
```

### Gate 3: Production Compilation
Validates dynamic routes, dynamic registry packages, Next.js page generation, and code-split packaging optimization.
```bash
npm run build
```

---

## 3. Playwright E2E Smoke Tests

To run the automated smoke testing suite:
```bash
npm run test:smoke
```
*Note: Make sure your local server is running at http://localhost:3000 before executing the tests.*

---

## 4. Documentation Compliance

Documentation is considered part of the project code. Every significant change must update the corresponding living document file:
- **Major refactors or bug fixes:** File a Mandatory Change Report inside `docs/CHANGELOG_AI.md`.
- **Roadmap updates:** Update tasks checklists inside `docs/TASKS.md`.
- **Architectural updates:** Document design justifications as a new Architecture Decision Record (ADR) in `docs/DECISIONS.md`.
- **Context changes:** Align active objective notes inside `docs/AI_CONTEXT.md`.
