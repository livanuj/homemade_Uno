---
inclusion: always
---

# Git Workflow (per task)

Every task runs on its own branch, is committed and pushed when green, and ends with a PR. Branches **stack** — each task branches from the previous task's branch, never from `main`.

## 1. Before starting a task — branch from the previous branch

- Branch off the branch the previous task used (the current `HEAD`), NOT `main`/`master`. This stacks each task on the work before it, matching the incremental task order.
- Name the branch after the task: `task/<number>-<short-slug>`, e.g. `task/2-firebase-firestore-rules`, `task/3.1-engine-deck-shuffle`.

```bash
# from the previous task's branch (do NOT checkout main first)
git checkout -b task/<number>-<slug>
```

- FORBIDDEN: `git checkout main && git checkout -b ...` (breaks the stack).
- REQUIRED: create the new branch from wherever HEAD currently is (the prior task's branch).
- If several sibling sub-tasks run in the same session, group them on one sensibly-named branch rather than one branch per trivial sub-task — use judgment, but keep a task's work isolated from unrelated tasks.

## 2. After the task is complete (all tests passing) — commit and push

Only after the full gate passes (typecheck + lint + tests green, per `verification.md`) and you have self-reviewed the diff:

```bash
git add <specific files you changed>      # prefer explicit paths over `git add -A`
git commit -m "<task number>: <concise description>"
git push -u origin task/<number>-<slug>
```

- REQUIRED: commit only when tests pass; never commit on red.
- REQUIRED: stage specific files; do not blindly `git add .`. Flag any file that looks like it holds secrets (`.env`, credentials) before committing.
- Do NOT commit until the task's work is done and verified — one clean commit per task is the default (amend/squash your own un-pushed WIP if needed).

## 3. After pushing — open a PR

Open a pull request for the branch. **Title = the task's title.** Description = a brief summary of what you did.

```bash
gh pr create \
  --base <previous-branch> \
  --head task/<number>-<slug> \
  --title "<task title>" \
  --body "<brief summary of the changes>"
```

- Set `--base` to the **previous task's branch** (the branch you forked from), so the PR diff shows only this task's changes — consistent with the stacked-branch model. The user reviews all PRs together later.
- If the `gh` CLI is unavailable or not authenticated, still push the branch, then surface the GitHub "compare" URL (`https://github.com/livanuj/homemade_Uno/compare/<previous-branch>...task/<number>-<slug>`) so the user can open the PR manually. Report this clearly rather than failing the task.
- Keep the title under ~70 chars; put detail in the body (what changed, what was tested, anything deferred).

## Safety

- Never push to `main`/`master` directly, never force-push, never modify git config, never skip hooks (`--no-verify`) unless the user explicitly asks.
- Use non-interactive git commands only.

## TL;DR

Branch from the previous branch (not main), named for the task → build + get tests green → commit specific files + push → open a PR titled with the task, based on the previous branch. One PR per task; the user reviews them in a batch.
