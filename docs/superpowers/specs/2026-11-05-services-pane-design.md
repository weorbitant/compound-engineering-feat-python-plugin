# Services Pane — design

**Status:** draft for approval (builder check done) · 2026-11-05

## Intent

When work spans several services in a monorepo, the person running py-micro-superpowers has to keep in their head which services are in scope, what the plan says will change in each, what has actually changed so far, and what can start next. The Services Pane is a Claude Code **mod** (a pane beside the chat) that shows this at a glance and lets them start the planned work for one service with a click.

Success: during a multi-service `/workflows:plan` → `/workflows:work` run, the person never has to open plan files or run `git diff` to know where each service stands.

## Goals

- List the monorepo's services.
- Per service, show **planned** changes (from its plan file) and **actual** changes (from git) side by side.
- Show run order (waves) and which services are waiting on others.
- Start a service's planned work from the pane.
- Extra signals: plan progress, last test result, out-of-scope edits, open review todos.

## Non-goals

- Running tests, git commands or workflows by itself. It only observes, except when the person clicks an action.
- Editing plans or todos.
- Anything outside a Claude Code terminal session (desktop/mobile surfaces may render it, but terminal is the target).
- Replacing the workflow commands. It is a view and a launcher for them.

## Anti-goals (failure even if it works)

- A change in the early-access mod API breaks `/workflows:*`. The pane must be removable or broken without affecting the main plugin.
- The pane slows the session noticeably or floods the transcript.
- It shows stale or wrong state with confidence (for example, "tests passing" from a run three edits ago with no hint of age).

## Packaging (decided by the person)

- A **separate plugin in this repository**, e.g. `mods/services-pane/`, with its own `.claude-plugin/plugin.json`, `hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`) and hooks module.
- Listed as a second entry in this repo's `.claude-plugin/marketplace.json`, so it installs independently: `/plugin install services-pane@py-micro-superpowers`.
- The main plugin does not depend on it. The repo's release rules apply (CHANGELOG, README, version bumps). `scripts/validate.sh` must keep passing, and must not count the mod's files as main-plugin components.

## Data sources (my calls, agreed in conversation)

| Shown | Source |
|-------|--------|
| Services | Top-level folders containing `pyproject.toml` (same rule as `microservice-focus`: `Glob("*/pyproject.toml")`). |
| Current work | Newest root plan under `docs/superpowers/plans/` whose YAML frontmatter has a `services:` section (the format `/workflows:plan` writes). The person can switch to another plan from the pane. With no such plan, the pane still lists services and actual changes. |
| Planned changes | Each service's plan `{service}/docs/superpowers/plans/<same filename>.md`: task titles, checkbox state (`- [x]` / `- [ ]`), and files each task names. |
| Watched checkout *(decided by the person)* | The worktree where the current plan's work is happening (found from the ledger's workspace or `git worktree list`), else the session's folder. The pane header names the watched checkout. All git, ledger and test reads use it. |
| Actual changes | `git diff` against the branch's merge-base with the default branch, plus uncommitted changes, grouped by top-level folder: files and +/− lines. |
| Run order | Waves from the root plan's `services:` → `depends_on`. A service is "waiting on X" until X is **done** (see Done signal). |
| Done signal *(decided by the person)* | A service is done when its per-service plan's frontmatter has `status: completed`. `/workflows:work` writes this (see Main-plugin changes). |
| Progress | While a run is live: `Task <N>: complete` lines in that plan's ledger (`.superpowers/sdd/<workspace>/progress.md`) out of the plan's task count. After the ledger is deleted: `status: completed` → N/N, otherwise 0/N. Plan checkboxes are per step and nobody ticks them, so they are not a progress source. |
| Test status | Observed only: when Claude runs pytest (Bash tool) with the working directory or `cd` inside a service, record pass/fail and time from the result. Show age ("2 min ago") and mark it stale once files in that service change after the run. |
| Out-of-scope warning | Actual changes in a **service folder** that is not in the current plan's `services:` get a ⚠. Non-service folders (`docs/`, `todos/`, root files) are never flagged. *(my call, from the builder check)* |
| Ledger ↔ service mapping | Per-service plans share a basename, so superpowers names their workspaces `<slug>`, `<slug>-2`, …. Match each workspace to its plan through the workspace's `plan-path` marker, never by directory name. *(my call, from the builder check)* |
| Review findings | Count of `todos/*-pending-*.md` files that mention the service's folder name. |

## Interface (my calls)

- **Pane** titled "Services", opened by a `/services` command (toggle). Layout as sketched:

  ```
  ┌ Services ─────────────── branch: feat/refunds ┐
  │ Wave 1                                        │
  │ ● lib-common   plan 3/3 ✓   +42 −3  2 files   │
  │ Wave 2                                        │
  │ ▶ orders       plan 1/4     +18 −0  1 file    │
  │ ○ payments     plan 0/5     waiting on orders │
  │                                               │
  │ orders › tasks                                │
  │   ✓ Add REFUNDED to OrderStatus               │
  │   · POST /orders/{id}/refund                  │
  │ [Start work]  [Open plan]  [Show diff]        │
  └───────────────────────────────────────────────┘
  ```
  Selecting a service expands its tasks and files below the list.
- **Actions** on the selected service:
  - **Start work**: submits `/workflows:work <service plan path> --services <service> --no-ship` as if typed, adding `--method <m>` when the method chosen at plan time is known. Disabled while the service is "waiting" or done.
  - **Ship** *(decided by the person)*: shown once every service in the plan is done. It submits `/workflows:work <root plan path>` in ship-only mode (see Main-plugin changes), which opens one PR for the whole branch.
  - **Open plan**: asks Claude to show the plan file.
  - **Show diff**: asks Claude to summarize that service's changes.
- **Status line**: one line when there is a current plan, e.g. `3 services · orders 1/4 · tests ✗ payments`.
- **Refresh**: after file-editing tool calls and Bash calls finish, and when the pane opens. Not on a polling timer faster than a few seconds.

## Main-plugin changes (needed by the person's decisions)

These change `commands/workflows/plan.md` and `work.md`. They are useful without the pane, and the main plugin still does not depend on it:

1. **`/workflows:work --no-ship`**: run tasks and the Python quality gate (Step 4), then stop before Step 5. No PR.
2. **Ship-only run**: `/workflows:work <root plan>` when every per-service plan is `status: completed` skips execution and goes straight to the quality gate and Step 5 (one PR).
3. **`status: completed` on per-service plans**: when a run finishes, set it on each per-service plan it completed, not only on the input plan.
4. **Per-service plans carry no `services:` frontmatter** (`plan.md` Step 4), so a per-service run cannot pick up the whole dependency graph and run every wave.

## Constraints

- Mod API is early access (Claude Code build 2.1.318 at time of writing). The type file shipped with the engine is the authority.
- The mod has no Node or DOM. Filesystem and process access go through the engine interface (`$.fs`, `$.process`).
- A pane opened unasked needs about 110+ terminal columns. When the person runs `/services`, it opens at any width.
- Must not add noticeable latency to tool calls. Expensive reads (git diff) happen after the call completes, not before.

## Left to the builder

- Exact hooks, state shape, and component tree.
- How to parse plan markdown robustly (task headings, checkboxes, file lists).
- Debouncing and caching.
- Test files (`claude plugin test`), and whether CI runs them.
