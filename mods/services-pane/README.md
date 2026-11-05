# services-pane

An optional mod for [py-micro-superpowers](../../README.md): a pane beside the chat that shows where each service in a monorepo stands during a multi-service `/workflows:plan` → `/workflows:work` run.

> **Early access.** This mod uses Claude Code's mod API, which is still changing. The main plugin does not depend on it; removing or breaking the mod never affects `/workflows:*`.

## Install

```
/plugin install services-pane@py-micro-superpowers
```

Open or close the pane with `/services`. A one-line summary also appears in the status line while a plan with `services:` is current (for example `3 services · orders 1/4 · tests ✗ payments`).

## What the pane shows

Services are the top-level folders that contain `pyproject.toml`. The current plan is the newest root plan in `docs/superpowers/plans/` with a `services:` section; use **Switch plan** to pick another. The header names the branch and the watched checkout (the worktree where the plan's work is happening, else the session folder).

| Column | Meaning |
|--------|---------|
| `Wave N` | Run order from the plan's `depends_on`. Services in a cycle are treated as independent (wave 1). |
| `●` / `○` / `▶` | Done / not done / selected. |
| `plan 1/4` | Tasks complete out of tasks in the per-service plan. `✓` once the plan has `status: completed`. `no plan` when the service has no per-service plan file. |
| `+18 −0  1 file` | Actual changes from git: merge-base with the default branch plus uncommitted, per service. `git unavailable` outside a git repo. |
| `⚠ not in plan` | The service folder has changes but is not in the current plan's `services:`. |
| `waiting on X` | Dependencies not yet done. |
| `tests ✓ · 2 min ago` | Last pytest run Claude made in that service, with its age. `(stale)` is added once files in the service change after the run. Observed only; the mod never runs tests. |

Select a service to see its tasks and changed files below the list.

## Actions

- **Start work**: submits `/workflows:work <service plan> --services <service> --no-ship`, the same as typing it. Never passes `--method`. Hidden while the service is waiting, done, or has no plan.
- **Ship**: shown once every service in the plan is done. Submits `/workflows:work <root plan>`, which opens one PR for the branch.
- **Open plan**: asks Claude to show the plan file.
- **Show diff**: asks Claude to summarize that service's changes.

Start work and Ship go through the engine's command API.

## Limits

Read-only git (`rev-parse`, `merge-base`, `diff --numstat`, `ls-files`, `worktree list`). It never commits, edits files or runs tests. Without a plan that has `services:`, the pane lists services and actual changes but shows no waves and no actions. In a single-service repo it says `No services found (single-service repo).`
