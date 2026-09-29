---
inclusion: manual
---

# Workflow Guide (task setup)

How to set up a spec task for good results on Homemade Uno. Pull this in with `#workflow` when planning a work session.

## Before starting a task

1. **Verify assets exist.** The task references screen IDs (e.g. `03-game-2v2`, `08a-paused`) and tokens. Confirm the screen exists under `design/uno-design/screens/` and the tokens exist in `theme.css` before building UI.
2. **Verify tokens.** If a visual value has no token, stop and resolve per `token-policy.md` (closest token, or add a semantic token) rather than inlining a literal.
3. **Check prerequisites.** Follow the Task Dependency Graph in `tasks.md` — build the engine before the Edge Functions that wrap it, components before the screens that use them.

## Running tasks

- **Run one task first, then check it** before parallelizing. For UI, view the screen against its PNG reference. For the engine, run its property tests.
- Prefer completing a whole wave (from the Task Dependency Graph) before the next, so integration stays coherent.
- Follow TDD and test only the file/component you are on during development. Run the full gate (typecheck + lint + full test suite) and self-review your diff only before marking a task done. See `verification.md`.
- Playwright runs in only two cases: (1) building a specific screen — capture just that screen and compare to its PNG; (2) after all tasks are done — full suite as a smoke check, no design comparison. See `verification.md`.

## Giving good feedback

- Point at the specific screen ref and what differs from the PNG ("the turn pill in `03-game-2v2` should use `text-label`, not `text-body`").
- For rule bugs, name the requirement and property ("stacking +2 onto +4 should reject — Req 9.5 / Property 10").

## Steering quick reference

| File                           | Loads                    | Governs                                                                                  |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| `design-fidelity.md`           | always                   | the non-negotiable design-fidelity principle; points to `token-policy.md` / `styling.md` |
| `verification.md`              | always                   | TDD, scoped-vs-full test phases, Playwright two-case policy, self-review, done-criteria  |
| `git-workflow.md`              | always                   | per-task branch (from previous branch), commit+push when green, open PR titled with the task |
| `token-policy.md`              | src tsx/ts/css           | which visual values are allowed (tokens only)                                            |
| `styling.md`                   | src tsx/css              | how classes are written (no dynamic strings, `cn()`)                                     |
| `component-architecture.md`    | src ts/tsx               | folder layout, naming, reuse, named exports                                              |
| `conventions/supabase-data.md` | supabase/realtime        | server-authoritative access, versioned actions, RLS                                      |
| `conventions/game-engine.md`   | engine/functions         | purity, injected RNG, invariants, property tests                                         |
| `conventions/animation.md`     | components/design/routes | Motion presets, shared-layout throw, reduced motion                                      |
| `workflow.md`                  | manual (`#workflow`)     | this task-setup checklist                                                                |

## TL;DR

Tokens only, never literals. Server is authoritative — clients send versioned intents, never write game tables. The engine is pure and property-tested. Real elements with aria labels. During development: TDD, test only the file you are on. Playwright only for the one screen you are building (vs its PNG) or as a final full smoke check. Before completing: run the full gate and review your own diff.
