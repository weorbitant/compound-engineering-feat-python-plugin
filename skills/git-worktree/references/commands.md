# Commands Reference

Entry point: `bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh <command>`

## `create <branch-name> [from-branch]`

Creates new worktree. `from-branch` defaults to `main`.

```bash
worktree-manager.sh create feature-login
```

What it does:
1. Checks if worktree already exists
2. Updates base branch from remote
3. Creates new worktree + branch
4. Copies all `.env*` files from main repo
5. Shows path for `cd`

## `list` / `ls`

Lists all worktrees with branches and status. Current worktree marked with ✓.

## `switch <name>` / `go <name>`

Switches to an existing worktree and `cd`s into it. If name omitted, lists available and prompts.

## `copy-env <name>`

Copies `.env*` files to an existing worktree (e.g., if created manually).

## `cleanup` / `clean`

Interactively cleans up inactive worktrees with confirmation. Cleans empty directories.

# Workflow Examples

## Code review with worktree

```bash
# Create isolated worktree for review (copies .env automatically)
worktree-manager.sh create pr-123-feature-name
cd .worktrees/pr-123-feature-name
# Review...
cd ../..
worktree-manager.sh cleanup
```

## Parallel feature development

```bash
worktree-manager.sh create feature-login
worktree-manager.sh create feature-notifications
worktree-manager.sh list
worktree-manager.sh switch feature-login
# Later
worktree-manager.sh cleanup
```

# Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Worktree already exists" | Script asks to switch to it instead |
| "Cannot remove worktree: it is the current worktree" | `cd $(git rev-parse --show-toplevel)` then `cleanup` |
| Lost in a worktree | `worktree-manager.sh list` |
| `.env` files missing | `worktree-manager.sh copy-env feature-name` |

# Technical Details

## Directory layout

```
.worktrees/
├── feature-login/          # branch: feature-login
├── feature-notifications/  # branch: feature-notifications
└── ...
.gitignore  # includes .worktrees
```

## How it works

- Uses `git worktree add` under the hood
- Each worktree = its own branch, shared git history
- Changes isolated per worktree
- Push from any worktree

## Performance

Worktrees are lightweight (file system links, no repo duplication). Shared git objects. Much faster than cloning or stash/switch.
