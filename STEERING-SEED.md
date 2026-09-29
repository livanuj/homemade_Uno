# Steering Seed — Coding Convention Guide for a New Project

Give this file to the AI agent in a new project and ask it to generate `.kiro/steering/*.md` files that fit that project. This describes *what conventions to capture and how to structure them* — not the specifics of any one project. The agent should inspect the target codebase (framework, styling approach, data layer, folder layout) and adapt each section to what it actually finds. Skip any section that doesn't apply (e.g. no design system, no Tailwind, no Phoenix backend).

## How steering files work

- Live in `.kiro/steering/`, one concern per file, written as markdown.
- Each file starts with YAML frontmatter controlling when it loads:
  - `inclusion: always` (default) — always in context.
  - `inclusion: fileMatch` + `fileMatch: "<glob>"` — loads only when a matching file is touched. Use this for language/area-specific rules to save context.
  - `inclusion: manual` — loaded on demand by the developer.
  - `inclusion: auto` + `description` — loaded when the request matches the description.
- Keep each file focused and scannable. Prefer short rules with a good/bad code example over long prose.
- Every rule should show the FORBIDDEN pattern and the REQUIRED pattern side by side.

## Recommended file set

Generate only the ones relevant to the project. Group into subfolders (`frontend/`, `backend/`, `conventions/`) if the project is large.

### 1. Verification convention (`verification.md`)
Two-phase testing strategy: run targeted tests during development, run the full suite (typecheck + lint + tests) before marking work done. State the exact commands for each app/package and the expected outcome (zero type errors, zero lint errors, all tests passing).

### 2. Styling standards (only if a utility-CSS or design system exists)
If the project uses Tailwind (or similar), capture:
- No arbitrary values / no hardcoded colors, sizes, spacing — everything through tokens or the theme scale.
- No dynamic class-name string interpolation (breaks static compilers). Approved alternatives: static mapping objects, CSS variables for runtime values, full conditional strings.
- Use a class-merge helper (e.g. `tailwind-merge`) instead of template-literal concatenation.
- Class ordering convention, mobile-first responsive prefixes, state variants (`hover:`, `focus-visible:`, `disabled:`).
- A short pre-generation checklist.

If a design system / design tokens file exists (colors, typography, spacing scale), add a **token policy** file: all visual values map to semantic tokens; document the workflow for adding a missing token; semantic names describe purpose, not literal values. If the project has no design system, skip this entirely.

### 3. Component / module architecture
- Directory structure and placement rules (shared vs feature-scoped vs layout).
- Naming conventions (file case, export case, hook/type/constant naming).
- Size limits, single responsibility, composition over configuration, named exports.
- "Reuse before create" — search existing components first.

### 4. Data & library conventions (`conventions/`)
One file per cross-cutting library pattern the project standardizes on. For each: state the rule, show the preferred custom-hook/wrapper pattern, list key conventions (query keys, cache invalidation, where hooks live), and show the "what NOT to do" anti-patterns. Common candidates:
- Data fetching / mutations (e.g. React Query — `useQuery`/`useMutation`, never raw fetch in components).
- Forms (validation, submit handling).
- Auth / session access.
- API transport client (the thin layer hooks call into).

### 5. Backend context guides (only for a substantial backend)
One file per bounded context/module, scoped with `fileMatch` to that module's paths. Each documents: purpose, public API (functions with signatures and return shapes), related modules, business rules, database schema, and test file locations. These are inherently project-specific — generate them by reading the actual code, not by copying another project.

### 6. Workflow guide (`inclusion: manual`)
A checklist for the developer on how to set up a task/spec for good results: verify assets exist, verify tokens, run one task first and check visually before parallelizing, and how to give specific feedback. Include a quick-reference table of the steering files and a TL;DR.

## Instructions for the receiving agent

1. Detect the stack: framework(s), styling approach, data layer, test runner, folder layout, monorepo vs single app.
2. For each recommended file above, decide if it applies. Skip cleanly if not.
3. Adapt commands, globs, and paths to the real project — do not carry over another project's folder names.
4. Write each rule as: short statement → FORBIDDEN example → REQUIRED example.
5. Use `fileMatch` inclusion for area-specific files so they only load when relevant.
6. Keep files concise; a rule with one clear example beats three paragraphs.
